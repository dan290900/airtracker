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

/**
 * Enriches a selected live flight with:
 * 1) Origin & destination airports via api.adsbdb.com (free, keyless, CORS-open)
 * 2) Exact airframe registration photo via api.planespotters.net (free, keyless, CORS-open)
 * Never fabricates airports if unavailable.
 */
export async function enrichSelectedFlight(
  flight: LiveFlight,
  signal?: AbortSignal
): Promise<EnrichedFlightInfo> {
  const cacheKey = `${flight.hex}:${flight.callsign}`
  const cached = enrichmentCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  let origin: AirportInfo | null = null
  let destination: AirportInfo | null = null
  let routeSource: 'adsbdb' | 'none' = 'none'
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
            origin = mapAirport(fr.origin)
            destination = mapAirport(fr.destination)
            if (origin || destination) {
              routeSource = 'adsbdb'
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
