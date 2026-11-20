import { resolveAircraftType } from '../data/fleet'
import { classifyRegion, LHG_COVERAGE_ZONES } from '../data/hubs'
import { matchLufthansaGroupAirline } from './airlineMatcher'
import type {
  ApiSettings,
  CoverageZone,
  FeedSnapshotMeta,
  LiveFlight,
  ProviderId,
  QuotaInfo,
} from '../types/aviation'

export interface RawAdsbAircraft {
  hex?: string
  flight?: string
  r?: string
  t?: string
  desc?: string
  ownOp?: string
  lat?: number
  lon?: number
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  true_heading?: number
  baro_rate?: number
  geom_rate?: number
  squawk?: string
  category?: string
  seen_pos?: number
  seen?: number
}

interface RawAdsbResponse {
  ac?: RawAdsbAircraft[]
  aircraft?: RawAdsbAircraft[]
  now?: number
  total?: number
}

export interface SnapshotFilePayload {
  schemaVersion: number
  provider: string
  generatedAt: string
  generatedAtMs: number
  coverageZones: CoverageZone[]
  totalRawScanned: number
  matchedCount: number
  aircraft: RawAdsbAircraft[]
}

export class AdsbApiError extends Error {
  code: 'API_KEY_REQUIRED' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'CORS_OR_NETWORK' | 'UPSTREAM_ERROR'
  status?: number
  retryAfterSec?: number

  constructor(
    code: AdsbApiError['code'],
    message: string,
    status?: number,
    retryAfterSec?: number
  ) {
    super(message)
    this.name = 'AdsbApiError'
    this.code = code
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

export interface FetchFlightsOptions {
  settings: ApiSettings
  viewportCenter: { lat: number; lon: number; radiusKm: number }
  existingFlights?: Map<string, LiveFlight>
  signal?: AbortSignal
}

export interface FetchFlightsResult {
  flights: LiveFlight[]
  meta: FeedSnapshotMeta
}

const LIVE_FEED_RAW_URL =
  'https://raw.githubusercontent.com/dan290900/airtracker/live-data/lhg-flights.json'

/** Normalize and filter raw readsb/adsb.lol/FlyItalyADSB aircraft array into Lufthansa Group flights */
export function normalizeLhgFlights(
  rawList: RawAdsbAircraft[],
  provider: ProviderId,
  referenceTimeMs: number,
  existingFlights?: Map<string, LiveFlight>,
  maxSeenPosSec = 180
): LiveFlight[] {
  const byHex = new Map<string, LiveFlight>()

  for (const raw of rawList) {
    if (!raw || typeof raw.hex !== 'string') continue
    const hex = raw.hex.trim().toLowerCase()
    if (!hex) continue

    const lat = typeof raw.lat === 'number' ? raw.lat : NaN
    const lon = typeof raw.lon === 'number' ? raw.lon : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue
    if (lat === 0 && lon === 0) continue

    const seenPos =
      typeof raw.seen_pos === 'number'
        ? raw.seen_pos
        : typeof raw.seen === 'number'
          ? raw.seen
          : null

    if (seenPos !== null && seenPos > maxSeenPosSec) continue

    const match = matchLufthansaGroupAirline(raw.flight, raw.r, raw.ownOp)
    if (!match) continue

    const existingInBatch = byHex.get(hex)
    if (
      existingInBatch &&
      existingInBatch.seenPosSec !== null &&
      seenPos !== null &&
      existingInBatch.seenPosSec <= seenPos
    ) {
      continue
    }

    const onGround = raw.alt_baro === 'ground'
    const altBaroFt =
      typeof raw.alt_baro === 'number' && Number.isFinite(raw.alt_baro)
        ? Math.round(raw.alt_baro)
        : onGround
          ? 0
          : null

    const altGeomFt =
      typeof raw.alt_geom === 'number' && Number.isFinite(raw.alt_geom)
        ? Math.round(raw.alt_geom)
        : null

    const groundSpeedKt =
      typeof raw.gs === 'number' && Number.isFinite(raw.gs) ? Math.round(raw.gs) : null
    const groundSpeedKmh = groundSpeedKt !== null ? Math.round(groundSpeedKt * 1.852) : null

    const trackDeg =
      typeof raw.track === 'number' && Number.isFinite(raw.track)
        ? ((raw.track % 360) + 360) % 360
        : typeof raw.true_heading === 'number' && Number.isFinite(raw.true_heading)
          ? ((raw.true_heading % 360) + 360) % 360
          : null

    const verticalRateFpm =
      typeof raw.baro_rate === 'number' && Number.isFinite(raw.baro_rate)
        ? Math.round(raw.baro_rate)
        : typeof raw.geom_rate === 'number' && Number.isFinite(raw.geom_rate)
          ? Math.round(raw.geom_rate)
          : null

    const callsign = (raw.flight ?? '').trim().toUpperCase() || (raw.r ?? hex).toUpperCase()
    const registration = raw.r ? raw.r.trim().toUpperCase() : null
    const icaoType = raw.t ? raw.t.trim().toUpperCase() : null
    const fleetSpec = resolveAircraftType(icaoType, match.airlineId)

    // Maintain session flight trail
    const prev = existingFlights?.get(hex)
    let trail: [number, number][] = prev ? [...prev.trail] : []
    const lastPt = trail[trail.length - 1]
    if (
      !lastPt ||
      Math.abs(lastPt[0] - lat) > 0.0025 ||
      Math.abs(lastPt[1] - lon) > 0.0025
    ) {
      trail.push([lat, lon])
      if (trail.length > 80) {
        trail = trail.slice(trail.length - 80)
      }
    }

    const lastSeenMs = seenPos !== null ? referenceTimeMs - Math.round(seenPos * 1000) : referenceTimeMs

    byHex.set(hex, {
      hex,
      callsign,
      flightNumber: match.flightNumber,
      airlineId: match.airlineId,
      airlineMatchConfidence: match.confidence,
      airlineMatchReason: match.reason,
      registration,
      icaoType,
      aircraftTypeId: fleetSpec?.id ?? null,
      aircraftDescription: raw.desc ?? fleetSpec?.fullName ?? null,
      lat,
      lon,
      altBaroFt,
      altGeomFt,
      onGround,
      groundSpeedKt,
      groundSpeedKmh,
      trackDeg,
      verticalRateFpm,
      squawk: raw.squawk ?? null,
      category: raw.category ?? null,
      seenPosSec: seenPos !== null ? Math.round(seenPos * 10) / 10 : null,
      lastSeenMs,
      sourceProvider: provider,
      region: classifyRegion(lat, lon),
      trail,
    })
  }

  return Array.from(byHex.values())
}

function parseAdsbLolQuota(headers: Headers): QuotaInfo | undefined {
  const limitHeader = headers.get('x-ratelimit-limit')
  const remHeader = headers.get('x-ratelimit-remaining')
  const resetHeader = headers.get('x-ratelimit-reset')
  if (!limitHeader && !remHeader) return undefined
  const limit = limitHeader ? Number.parseInt(limitHeader.split(',')[0], 10) : undefined
  const remaining = remHeader ? Number.parseInt(remHeader, 10) : undefined
  const resetSec = resetHeader ? Number.parseInt(resetHeader, 10) : undefined
  return {
    limit: Number.isFinite(limit) ? limit : undefined,
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    resetLabel:
      resetSec && Number.isFinite(resetSec)
        ? `Reset in ~${Math.max(1, Math.round(resetSec / 60))} Min.`
        : undefined,
  }
}

function parseFlyItalyQuota(headers: Headers): QuotaInfo | undefined {
  const plan = headers.get('x-fia-plan') ?? undefined
  const limitPerMin = headers.get('x-fia-limit-per-min')
  const monthQuota = headers.get('x-fia-quota-month')
  const monthUsed = headers.get('x-fia-used-month')
  if (!plan && !monthQuota) return undefined
  const mq = monthQuota ? Number.parseInt(monthQuota, 10) : undefined
  const mu = monthUsed ? Number.parseInt(monthUsed, 10) : undefined
  return {
    plan,
    limit: limitPerMin ? Number.parseInt(limitPerMin, 10) : undefined,
    monthlyQuota: Number.isFinite(mq) ? mq : undefined,
    monthlyUsed: Number.isFinite(mu) ? mu : undefined,
    remaining:
      mq !== undefined && mu !== undefined && Number.isFinite(mq) && Number.isFinite(mu)
        ? Math.max(0, mq - mu)
        : undefined,
  }
}

async function fetchJsonWithHandling(
  url: string,
  init: RequestInit,
  providerName: string
): Promise<{ data: unknown; headers: Headers }> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw new AdsbApiError(
      'CORS_OR_NETWORK',
      `${providerName} konnte vom Browser nicht direkt erreicht werden (CORS-Richtlinie des Anbieters oder Netzwerkfehler).`
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new AdsbApiError(
      'UNAUTHORIZED',
      `${providerName}: Zugriff verweigert (HTTP ${response.status}). Bitte API-Key oder Radius-Limit prüfen.`,
      response.status
    )
  }

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '60', 10)
    throw new AdsbApiError(
      'RATE_LIMITED',
      `${providerName}: Rate-Limit erreicht (HTTP 429). Bitte kurz warten oder Aktualisierungsintervall erhöhen.`,
      429,
      Number.isFinite(retryAfter) ? retryAfter : 60
    )
  }

  if (!response.ok) {
    throw new AdsbApiError(
      'UPSTREAM_ERROR',
      `${providerName} antwortete mit HTTP ${response.status}.`,
      response.status
    )
  }

  const data = (await response.json()) as unknown
  return { data, headers: response.headers }
}

/**
 * Mode 1: Default keyless adsb.lol live feed.
 * - In local Vite dev mode: queries real api.adsb.lol directly via Vite dev proxy across hubs!
 * - On static GitHub Pages: fetches real adsb.lol snapshot updated via GitHub Actions on `live-data` branch,
 *   falling back to bundled initial real snapshot if raw.githubusercontent.com is temporarily unreachable.
 */
async function fetchAdsbLolFeed(options: FetchFlightsOptions): Promise<FetchFlightsResult> {
  const nowMs = Date.now()

  // Local dev server has built-in Vite proxy to api.adsb.lol -> direct live queries!
  if (import.meta.env.DEV) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (options.settings.adsbLolApiKey.trim()) {
        headers['x-api-key'] = options.settings.adsbLolApiKey.trim()
      }
      // Query top 3 European Lufthansa Group core hubs in dev for fast live response
      const devZones = LHG_COVERAGE_ZONES.slice(0, 3)
      const allRaw: RawAdsbAircraft[] = []
      let quota: QuotaInfo | undefined
      for (const zone of devZones) {
        const distNm = Math.min(250, Math.round(zone.radiusKm / 1.852))
        const url = `/proxy/adsblol/v2/point/${zone.lat}/${zone.lon}/${distNm}`
        const res = await fetchJsonWithHandling(
          url,
          { headers, signal: options.signal },
          'adsb.lol (Dev Proxy)'
        )
        const payload = res.data as RawAdsbResponse
        if (Array.isArray(payload.ac)) allRaw.push(...payload.ac)
        quota = parseAdsbLolQuota(res.headers) ?? quota
      }
      const flights = normalizeLhgFlights(
        allRaw,
        'adsblol-feed',
        nowMs,
        options.existingFlights
      )
      return {
        flights,
        meta: {
          provider: 'adsblol-feed',
          providerLabel: 'adsb.lol Live (lokaler Dev-Proxy)',
          fetchedAtMs: nowMs,
          snapshotGeneratedAtMs: nowMs,
          coverageZones: devZones,
          coverageDescription:
            'Direkte Live-Abfrage über api.adsb.lol (FRA/DUS/BRU, MUC/ZRH/VIE, FCO/LIN – je 250 NM Radius)',
          totalRawScanned: allRaw.length,
          matchedCount: flights.length,
          isLiveDirect: true,
          quota,
        },
      }
    } catch {
      // Fall through to published live-data snapshot if proxy fails
    }
  }

  // Production GitHub Pages mode: fetch live-data branch snapshot generated from api.adsb.lol
  const cacheBust = Math.floor(nowMs / 60_000)
  const candidates = [
    {
      url: `${LIVE_FEED_RAW_URL}?t=${cacheBust}`,
      label: 'adsb.lol Live-Feed (GitHub Actions)',
      isFallback: false,
    },
    {
      url: `${import.meta.env.BASE_URL}data/lhg-snapshot.json`,
      label: 'adsb.lol Basis-Snapshot (Fallback)',
      isFallback: true,
    },
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate.url, {
        cache: 'no-store',
        signal: options.signal,
      })
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }
      const snapshot = (await res.json()) as SnapshotFilePayload
      if (!snapshot || !Array.isArray(snapshot.aircraft)) {
        lastError = new Error('Ungültiges Snapshot-Format')
        continue
      }
      const genMs = snapshot.generatedAtMs || Date.parse(snapshot.generatedAt) || nowMs
      const flights = normalizeLhgFlights(
        snapshot.aircraft,
        'adsblol-feed',
        genMs,
        options.existingFlights,
        600
      )
      const ageMin = Math.max(0, Math.round((nowMs - genMs) / 60_000))
      const warning = candidate.isFallback
        ? 'GitHub Live-Feed momentan nicht erreichbar – zeige letzten gespeicherten adsb.lol-Echtdaten-Snapshot.'
        : ageMin > 25
          ? `Letztes automatisches adsb.lol-Update vor ${ageMin} Min. Für 15-Sekunden-Echtzeit-Polling direkt im Browser kann ein kostenloser FlyItalyADSB API-Key in den Einstellungen hinterlegt werden.`
          : undefined

      return {
        flights,
        meta: {
          provider: 'adsblol-feed',
          providerLabel: candidate.label,
          fetchedAtMs: nowMs,
          snapshotGeneratedAtMs: genMs,
          coverageZones:
            Array.isArray(snapshot.coverageZones) && snapshot.coverageZones.length > 0
              ? snapshot.coverageZones
              : LHG_COVERAGE_ZONES,
          coverageDescription:
            '6 europäische Lufthansa-Group-Korridore (je 250 NM / 460 km Radius via api.adsb.lol, ODbL 1.0)',
          totalRawScanned: snapshot.totalRawScanned,
          matchedCount: flights.length,
          isLiveDirect: false,
          warning,
        },
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      lastError = err
    }
  }

  throw new AdsbApiError(
    'UPSTREAM_ERROR',
    `Live-Feed konnte nicht geladen werden (${lastError instanceof Error ? lastError.message : 'Unbekannter Fehler'}).`
  )
}

/**
 * Mode 2: FlyItalyADSB direct browser live polling (CORS open: Access-Control-Allow-Origin: *).
 * Uses user's free self-serve API key from localStorage (never hardcoded).
 */
async function fetchFlyItalyLive(options: FetchFlightsOptions): Promise<FetchFlightsResult> {
  const apiKey = options.settings.flyItalyApiKey.trim()
  if (!apiKey) {
    throw new AdsbApiError(
      'API_KEY_REQUIRED',
      'Für den direkten Live-Modus über FlyItalyADSB ist ein kostenloser API-Key erforderlich.'
    )
  }

  const nowMs = Date.now()
  const lat = Number(options.viewportCenter.lat.toFixed(3))
  const lon = Number(options.viewportCenter.lon.toFixed(3))
  const radiusKm = Math.max(50, Math.min(500, Math.round(options.viewportCenter.radiusKm)))

  const url = `https://api.flyitalyadsb.com/v2/lat/${lat}/lon/${lon}/dist/${radiusKm}`
  const { data, headers } = await fetchJsonWithHandling(
    url,
    {
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      signal: options.signal,
    },
    'FlyItalyADSB'
  )

  const payload = data as RawAdsbResponse
  const rawList = Array.isArray(payload.ac) ? payload.ac : []
  const flights = normalizeLhgFlights(rawList, 'flyitalyadsb', nowMs, options.existingFlights)
  const quota = parseFlyItalyQuota(headers)

  const zone: CoverageZone = {
    id: 'viewport',
    name: `Aktueller Kartenausschnitt (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`,
    shortLabel: `${radiusKm} km Radius`,
    lat,
    lon,
    radiusKm,
    region: classifyRegion(lat, lon),
  }

  return {
    flights,
    meta: {
      provider: 'flyitalyadsb',
      providerLabel: 'FlyItalyADSB Direct Live (CORS)',
      fetchedAtMs: nowMs,
      snapshotGeneratedAtMs: nowMs,
      coverageZones: [zone],
      coverageDescription: `Direkte Echtzeit-Abfrage im ${radiusKm}-km-Umkreis um das aktuelle Kartenzentrum (CC BY-SA 4.0)`,
      totalRawScanned: rawList.length,
      matchedCount: flights.length,
      isLiveDirect: true,
      quota,
    },
  }
}

/**
 * Mode 3 & 4: adsb.lol or adsb.fi via custom CORS relay URL (or Vite dev proxy in local development).
 */
async function fetchRelayLive(
  options: FetchFlightsOptions,
  kind: 'adsblol-direct' | 'adsbfi-relay'
): Promise<FetchFlightsResult> {
  const nowMs = Date.now()
  const relayBase = options.settings.customRelayUrl.trim().replace(/\/+$/, '')

  let baseUrl: string
  if (relayBase) {
    baseUrl = relayBase
  } else if (import.meta.env.DEV) {
    baseUrl = kind === 'adsblol-direct' ? '/proxy/adsblol' : '/proxy/adsbfi'
  } else {
    baseUrl = kind === 'adsblol-direct' ? 'https://api.adsb.lol' : 'https://opendata.adsb.fi/api'
  }

  const lat = Number(options.viewportCenter.lat.toFixed(3))
  const lon = Number(options.viewportCenter.lon.toFixed(3))
  const distNm = Math.max(25, Math.min(250, Math.round(options.viewportCenter.radiusKm / 1.852)))
  const radiusKm = Math.round(distNm * 1.852)

  const path =
    kind === 'adsblol-direct'
      ? `/v2/point/${lat}/${lon}/${distNm}`
      : `/v2/lat/${lat}/lon/${lon}/dist/${distNm}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (kind === 'adsblol-direct' && options.settings.adsbLolApiKey.trim()) {
    headers['x-api-key'] = options.settings.adsbLolApiKey.trim()
  }

  const label = kind === 'adsblol-direct' ? 'adsb.lol' : 'adsb.fi'
  const { data, headers: resHeaders } = await fetchJsonWithHandling(
    `${baseUrl}${path}`,
    { headers, signal: options.signal },
    label
  )

  const payload = data as RawAdsbResponse
  const rawList = Array.isArray(payload.ac)
    ? payload.ac
    : Array.isArray(payload.aircraft)
      ? payload.aircraft
      : []

  const flights = normalizeLhgFlights(rawList, kind, nowMs, options.existingFlights)
  const quota = kind === 'adsblol-direct' ? parseAdsbLolQuota(resHeaders) : undefined

  const zone: CoverageZone = {
    id: 'viewport',
    name: `Kartenausschnitt (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`,
    shortLabel: `${distNm} NM / ${radiusKm} km`,
    lat,
    lon,
    radiusKm,
    region: classifyRegion(lat, lon),
  }

  return {
    flights,
    meta: {
      provider: kind,
      providerLabel: `${label} ${relayBase ? '(Relay)' : import.meta.env.DEV ? '(Dev-Proxy)' : '(Direkt)'}`,
      fetchedAtMs: nowMs,
      snapshotGeneratedAtMs: nowMs,
      coverageZones: [zone],
      coverageDescription: `Direkte Abfrage im ${distNm}-NM-Umkreis (${radiusKm} km) um das Kartenzentrum`,
      totalRawScanned: rawList.length,
      matchedCount: flights.length,
      isLiveDirect: true,
      quota,
    },
  }
}

export async function fetchLhgFlights(options: FetchFlightsOptions): Promise<FetchFlightsResult> {
  switch (options.settings.provider) {
    case 'flyitalyadsb':
      return fetchFlyItalyLive(options)
    case 'adsblol-direct':
      return fetchRelayLive(options, 'adsblol-direct')
    case 'adsbfi-relay':
      return fetchRelayLive(options, 'adsbfi-relay')
    case 'adsblol-feed':
    default:
      return fetchAdsbLolFeed(options)
  }
}

export const PROVIDER_CATALOG: Array<{
  id: ProviderId
  name: string
  badge: string
  corsInBrowser: boolean
  requiresKey: boolean
  summary: string
  keyPortalUrl?: string
}> = [
  {
    id: 'adsblol-feed',
    name: 'adsb.lol Live-Feed (Standard)',
    badge: 'Kostenlos · Ohne Key',
    corsInBrowser: true,
    requiresKey: false,
    summary:
      'Nutzt echte api.adsb.lol-Daten (ODbL 1.0) über 6 europäische Lufthansa-Group-Korridore. Automatisch aktualisiert via GitHub Actions — sofort funktionsfähig auf GitHub Pages ohne CORS-Probleme.',
  },
  {
    id: 'flyitalyadsb',
    name: 'FlyItalyADSB Direct Live',
    badge: 'CORS-offen · Kostenloser Key',
    corsInBrowser: true,
    requiresKey: true,
    summary:
      'Direkte 15-Sekunden-Echtzeit-Abfrage direkt aus dem Browser für jeden beliebigen Kartenausschnitt weltweit (bis 500 km Radius, 300.000 Anfragen/Monat kostenlos, CC BY-SA 4.0).',
    keyPortalUrl: 'https://flyitalyadsb.com/en/data/api/',
  },
  {
    id: 'adsblol-direct',
    name: 'adsb.lol Direkt / Eigener CORS-Relay',
    badge: 'Optionaler Key · Relay nötig',
    corsInBrowser: false,
    requiresKey: false,
    summary:
      'api.adsb.lol sendet keine CORS-Header für Browser. Funktioniert lokal im Dev-Modus oder mit eigener Relay-URL (z. B. eigener Proxy). Optionaler x-api-key erhöht das Limit auf 1.000–7.200 Req/Tag.',
    keyPortalUrl: 'https://www.adsb.lol/mmb',
  },
  {
    id: 'adsbfi-relay',
    name: 'adsb.fi Open Data (via Relay)',
    badge: 'Ohne Key · Relay nötig',
    corsInBrowser: false,
    requiresKey: false,
    summary:
      'Alternative Community-ADS-B-API (opendata.adsb.fi). Benötigt für Browser-Aufrufe von GitHub Pages eine eigene CORS-Relay-URL.',
  },
]
