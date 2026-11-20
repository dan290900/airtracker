import type { AirportInfo, EnrichedFlightInfo, LiveFlight } from '../types/aviation'

interface AdsbdbRouteResponse {
  response?: {
    flightroute?: {
      callsign?: string
      origin?: {
        iata_code?: string
        icao_code?: string
        name?: string
        municipality?: string
        country_name?: string
        country_iso_name?: string
        latitude?: number
        longitude?: number
      }
      destination?: {
        iata_code?: string
        icao_code?: string
        name?: string
        municipality?: string
        country_name?: string
        country_iso_name?: string
        latitude?: number
        longitude?: number
      }
    }
  }
}

interface PlanespottersResponse {
  photos?: Array<{
    thumbnail_large?: { src?: string }
    thumbnail?: { src?: string }
    photographer?: string
    link?: string
  }>
}

const enrichmentCache = new Map<string, EnrichedFlightInfo>()
const CACHE_TTL_MS = 15 * 60 * 1000

function mapAirport(raw?: NonNullable<AdsbdbRouteResponse['response']>['flightroute'] extends infer R
  ? R extends { origin?: infer O }
    ? O
    : never
  : never): AirportInfo | null {
  if (!raw || !raw.iata_code || typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') {
    return null
  }
  return {
    iata: raw.iata_code,
    icao: raw.icao_code ?? '',
    name: raw.name ?? raw.iata_code,
    municipality: raw.municipality ?? '',
    country: raw.country_name ?? '',
    countryIso: raw.country_iso_name ?? '',
    lat: raw.latitude,
    lon: raw.longitude,
  }
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function minAngleDiffDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180)
  return diff
}

/** Exact spherical cross-track distance from aircraft P to great circle O -> D */
function crossTrackDistanceKm(
  oLat: number,
  oLon: number,
  dLat: number,
  dLon: number,
  pLat: number,
  pLon: number
): number {
  const delta13 = haversineKm(oLat, oLon, pLat, pLon) / EARTH_RADIUS_KM
  const theta13 = toRad(initialBearingDeg(oLat, oLon, pLat, pLon))
  const theta12 = toRad(initialBearingDeg(oLat, oLon, dLat, dLon))
  const xt = Math.asin(Math.max(-1, Math.min(1, Math.sin(delta13) * Math.sin(theta13 - theta12))))
  return Math.abs(xt * EARTH_RADIUS_KM)
}

/**
 * Verifies whether a static callsign route (e.g. from adsbdb.com) geometrically matches
 * the aircraft's live GPS position & heading. Airlines frequently reassign alphanumeric
 * ATC callsigns (e.g. DLH8HL) across different routes, so outdated entries MUST be rejected.
 */
function isRoutePlausibleForFlight(
  flight: LiveFlight,
  origin: AirportInfo,
  destination: AirportInfo
): boolean {
  const dRoute = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon)
  const dOrig = haversineKm(origin.lat, origin.lon, flight.lat, flight.lon)
  const dDest = haversineKm(destination.lat, destination.lon, flight.lat, flight.lon)

  if (dRoute < 30) return false

  // On ground: aircraft must actually be at (or very near) origin or destination airport
  if (flight.onGround) {
    return dOrig <= 35 || dDest <= 35
  }

  // Detour check: total distance via current position cannot wildly exceed direct great-circle route
  const maxTotalDist = Math.max(dRoute * 1.32 + 150, dRoute + 350)
  if (dOrig + dDest > maxTotalDist) {
    return false
  }

  // Cross-track corridor check: aircraft cannot be hundreds of km sideways off the route corridor
  const xtKm = crossTrackDistanceKm(
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon,
    flight.lat,
    flight.lon
  )
  const maxXtKm = Math.min(400, Math.max(165, dRoute * 0.2))
  if (xtKm > maxXtKm) {
    return false
  }

  // Enroute heading check (outside 75 km SID/STAR terminal maneuvering zones)
  if (flight.trackDeg !== null && dOrig > 75 && dDest > 75) {
    const bearingToDest = initialBearingDeg(
      flight.lat,
      flight.lon,
      destination.lat,
      destination.lon
    )
    const headingError = minAngleDiffDeg(flight.trackDeg, bearingToDest)
    if (headingError > 60) {
      return false
    }
  }

  return true
}

/**
 * Enriches a selected live flight with:
 * 1) Origin & destination airports via api.adsbdb.com (free, keyless, CORS-open),
 *    strictly validated against the aircraft's live GPS position & heading!
 * 2) Exact airframe registration photo via api.planespotters.net (free, keyless, CORS-open)
 * Never fabricates or displays stale mismatched routes.
 */
export async function enrichSelectedFlight(
  flight: LiveFlight,
  signal?: AbortSignal
): Promise<EnrichedFlightInfo> {
  const cacheKey = `${flight.hex}:${flight.callsign}:${Math.round(flight.lat)}:${Math.round(flight.lon)}`
  const cached = enrichmentCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  let origin: AirportInfo | null = null
  let destination: AirportInfo | null = null
  let routeSource: 'adsbdb' | 'none' = 'none'
  let routeRejectedNotice: string | undefined
  let photoUrl: string | null = null
  let photoAuthor: string | null = null
  let photoLink: string | null = null
  let photoSource: 'planespotters' | 'wikimedia' | 'none' = 'none'

  const cleanCallsign = flight.callsign.trim().toUpperCase()
  const cleanReg = flight.registration?.trim().toUpperCase() ?? ''

  const tasks: Promise<void>[] = []

  // 1. Route lookup from adsbdb.com (only if callsign looks like an airline flight callsign)
  if (/^[A-Z]{3}[0-9A-Z]{1,5}$/.test(cleanCallsign)) {
    tasks.push(
      fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cleanCallsign)}`, {
        signal,
      })
        .then(async (res) => {
          if (!res.ok) return
          const json = (await res.json()) as AdsbdbRouteResponse
          const fr = json.response?.flightroute
          if (fr) {
            const candidateOrigin = mapAirport(fr.origin)
            const candidateDest = mapAirport(fr.destination)
            if (candidateOrigin && candidateDest) {
              if (isRoutePlausibleForFlight(flight, candidateOrigin, candidateDest)) {
                origin = candidateOrigin
                destination = candidateDest
                routeSource = 'adsbdb'
              } else {
                routeRejectedNotice = `Veralteter Routeneintrag (${candidateOrigin.iata} → ${candidateDest.iata}) in adsbdb.com passt nicht zur aktuellen GPS-Position/Flugrichtung und wurde ausgeblendet (ATC-Callsigns werden von Airlines häufig neu vergeben).`
              }
            }
          }
        })
        .catch(() => {
          // Graceful degradation: route simply remains unavailable
        })
    )
  }

  // 2. Exact registration photo lookup from Planespotters.net public API
  if (cleanReg && /^[A-Z0-9-]{4,10}$/.test(cleanReg)) {
    tasks.push(
      fetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(cleanReg)}`, {
        signal,
      })
        .then(async (res) => {
          if (!res.ok) return
          const json = (await res.json()) as PlanespottersResponse
          const first = json.photos?.[0]
          const src = first?.thumbnail_large?.src ?? first?.thumbnail?.src
          if (src) {
            photoUrl = src
            photoAuthor = first?.photographer ?? 'Planespotters.net'
            photoLink = first?.link ?? 'https://www.planespotters.net'
            photoSource = 'planespotters'
          }
        })
        .catch(() => {
          // Graceful fallback to Wikimedia type photo
        })
    )
  }

  await Promise.allSettled(tasks)

  const info: EnrichedFlightInfo = {
    callsign: cleanCallsign,
    hex: flight.hex,
    origin,
    destination,
    routeSource,
    routeRejectedNotice,
    photoUrl,
    photoAuthor,
    photoLink,
    photoSource,
    fetchedAt: Date.now(),
    status: origin || destination || photoUrl ? 'loaded' : 'not_found',
  }

  enrichmentCache.set(cacheKey, info)
  return info
}
