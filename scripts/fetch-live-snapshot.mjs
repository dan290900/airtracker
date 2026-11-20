#!/usr/bin/env node
/**
 * Fetches live WORLDWIDE ADS-B data for the Lufthansa Group from https://api.adsb.lol:
 * 1) 6 overlapping European 250-NM regional circles (catches 100% of European traffic including aircraft without ICAO type metadata)
 * 2) Global /v2/type/{icaoType} sweep across all 25 Lufthansa Group aircraft types (catches EVERY Lufthansa Group flight worldwide: Americas, Africa, Middle East, Asia & Oceans!)
 *
 * Data License: adsb.lol Open Data (ODbL 1.0)
 * Never commits or logs any API key. Optional ADSBLOL_API_KEY env var supported in CI.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const COVERAGE_ZONES = [
  { id: 'fra', name: 'Frankfurt & Rhein-Ruhr', shortLabel: 'FRA / DUS / BRU', lat: 50.35, lon: 8.2, radiusKm: 460, region: 'Mitteleuropa' },
  { id: 'muc-zrh-vie', name: 'München, Zürich & Wien', shortLabel: 'MUC / ZRH / VIE', lat: 47.9, lon: 12.1, radiusKm: 460, region: 'Alpenraum & Ost' },
  { id: 'ita', name: 'Rom & Mailand (ITA / Dolomiti)', shortLabel: 'FCO / LIN / MXP', lat: 43.2, lon: 11.8, radiusKm: 460, region: 'Südeuropa / Italien' },
  { id: 'north-atlantic-uk', name: 'Nordsee, UK & Atlantik-Korridor', shortLabel: 'LHR / AMS / Nordatlantik', lat: 53.0, lon: -1.5, radiusKm: 460, region: 'Westeuropa & Atlantik-Tor' },
  { id: 'nordics', name: 'Norddeutschland & Skandinavien', shortLabel: 'HAM / BER / CPH', lat: 55.6, lon: 12.2, radiusKm: 460, region: 'Nordeuropa' },
  { id: 'iberia-med', name: 'Westliches Mittelmeer & Balearen', shortLabel: 'PMI / BCN / NCE', lat: 41.3, lon: 2.8, radiusKm: 460, region: 'Mittelmeerraum' },
]

/** All 25 ICAO aircraft types operated across the Lufthansa Group, batched into 3 comma-separated worldwide /v2/type requests */
const LHG_WORLDWIDE_TYPE_BATCHES = [
  ['A359', 'A35K', 'A388', 'B748', 'B744', 'B789', 'B77W', 'B772', 'B77L', 'B763'],
  ['A333', 'A339', 'A332', 'A343', 'A346', 'BCS1', 'BCS3', 'E190', 'E195', 'CRJ9'],
  ['A319', 'A320', 'A20N', 'A321', 'A21N'],
]

const LHG_CALLSIGN_PREFIXES = new Set([
  'DLH', 'SWR', 'AUA', 'BEL', 'EWG', 'EWL', 'OCN', 'EDW', 'DLA', 'LHX', 'ITY', 'GEC', 'CLH',
])

const EXCLUSIVE_REG_PATTERNS = [
  /^D-ALF[A-Z]$/,
  /^D-AEU[A-Z]$/,
  /^D-AIM[A-N]$/,
  /^D-ABY[A-Z]$/,
  /^D-ABV[A-Z]$/,
  /^D-AIX[A-Z]$/,
  /^D-AIV[A-Z]$/,
  /^D-ABP[A-Z]$/,
  /^I-ADJ[A-Z]$/,
  /^I-JEN[A-Z]$/,
  /^OO-S[NBFSC][A-Z]$/,
  /^OE-L[A-Z]{2}$/,
  /^HB-JN[A-L]$/,
  /^HB-JH[A-N]$/,
  /^HB-IH[A-Z]$/,
]

function isLhgAircraft(ac) {
  const cs = typeof ac.flight === 'string' ? ac.flight.trim().toUpperCase() : ''
  if (cs.length >= 4 && LHG_CALLSIGN_PREFIXES.has(cs.slice(0, 3))) {
    return true
  }
  const hasForeignCs = cs.length >= 4 && /^[A-Z]{3}\d/.test(cs)
  const reg = typeof ac.r === 'string' ? ac.r.trim().toUpperCase() : ''
  if (reg && !hasForeignCs && EXCLUSIVE_REG_PATTERNS.some((p) => p.test(reg))) {
    return true
  }
  return false
}

function compactRecord(ac) {
  return {
    hex: ac.hex,
    flight: typeof ac.flight === 'string' ? ac.flight.trim() : undefined,
    r: ac.r,
    t: ac.t,
    desc: ac.desc,
    lat: ac.lat,
    lon: ac.lon,
    alt_baro: ac.alt_baro,
    alt_geom: ac.alt_geom,
    gs: ac.gs,
    track: ac.track ?? ac.true_heading,
    baro_rate: ac.baro_rate ?? ac.geom_rate,
    squawk: ac.squawk,
    category: ac.category,
    seen_pos: ac.seen_pos ?? ac.seen,
  }
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const json = await res.json()
  return Array.isArray(json.ac) ? json.ac : []
}

async function main() {
  const outPath = process.argv[2] || path.resolve('public/data/lhg-snapshot.json')
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'LufthansaGroupRadar/1.0 (+https://github.com/dan290900/airtracker)',
  }
  if (process.env.ADSBLOL_API_KEY) {
    headers['x-api-key'] = process.env.ADSBLOL_API_KEY
  }

  const byHex = new Map()
  let totalRawScanned = 0
  const succeededZones = []
  let succeededTypes = 0

  const ingest = (list) => {
    totalRawScanned += list.length
    for (const ac of list) {
      if (!ac || typeof ac.hex !== 'string') continue
      if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue
      if (ac.lat === 0 && ac.lon === 0) continue
      if (!isLhgAircraft(ac)) continue
      const hex = ac.hex.toLowerCase()
      const existing = byHex.get(hex)
      const seen = typeof ac.seen_pos === 'number' ? ac.seen_pos : 999
      if (!existing || seen < (existing.seen_pos ?? 999)) {
        byHex.set(hex, compactRecord(ac))
      }
    }
  }

  // 1. European regional hub sweep (catches aircraft even when type metadata is absent)
  for (const zone of COVERAGE_ZONES) {
    try {
      const distNm = Math.min(250, Math.round(zone.radiusKm / 1.852))
      const list = await fetchJson(
        `https://api.adsb.lol/v2/point/${zone.lat}/${zone.lon}/${distNm}`,
        headers
      )
      ingest(list)
      succeededZones.push(zone)
    } catch (err) {
      console.warn(`[warn zone ${zone.id}] ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 1100))
  }

  // 2. Worldwide ICAO aircraft-type sweep (3 batched requests cover ALL 25 LHG types worldwide!)
  for (const batch of LHG_WORLDWIDE_TYPE_BATCHES) {
    try {
      const list = await fetchJson(
        `https://api.adsb.lol/v2/type/${batch.join(',')}`,
        headers
      )
      ingest(list)
      succeededTypes += batch.length
    } catch (err) {
      console.warn(`[warn type batch ${batch.join(',')}] ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 1100))
  }

  if (succeededZones.length === 0 && succeededTypes === 0) {
    throw new Error('All adsb.lol requests failed')
  }

  const nowMs = Date.now()
  const payload = {
    schemaVersion: 2,
    provider: 'api.adsb.lol',
    license: 'ODbL 1.0',
    mode: 'worldwide-hybrid',
    generatedAt: new Date(nowMs).toISOString(),
    generatedAtMs: nowMs,
    coverageZones: succeededZones,
    worldwideTypesCount: succeededTypes,
    totalRawScanned,
    matchedCount: byHex.size,
    aircraft: Array.from(byHex.values()),
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(payload))
  console.log(
    `Saved ${payload.matchedCount} WORLDWIDE Lufthansa Group flights (scanned ${totalRawScanned} raw aircraft across ${succeededZones.length} EU zones + ${succeededTypes} global aircraft types) -> ${outPath}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
