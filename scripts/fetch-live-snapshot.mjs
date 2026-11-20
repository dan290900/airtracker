#!/usr/bin/env node
/**
 * Fetches live ADS-B data from https://api.adsb.lol across 6 strategic European
 * Lufthansa Group coverage zones, filters for Lufthansa Group carriers, deduplicates
 * by ICAO hex, and writes a compact JSON snapshot for GitHub Pages consumption.
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

async function fetchZone(zone, headers) {
  const distNm = Math.min(250, Math.round(zone.radiusKm / 1.852))
  const url = `https://api.adsb.lol/v2/point/${zone.lat}/${zone.lon}/${distNm}`
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw new Error(`Zone ${zone.id} HTTP ${res.status}`)
  }
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

  for (const zone of COVERAGE_ZONES) {
    try {
      const list = await fetchZone(zone, headers)
      totalRawScanned += list.length
      succeededZones.push(zone)
      for (const ac of list) {
        if (!ac || typeof ac.hex !== 'string') continue
        if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue
        if (!isLhgAircraft(ac)) continue
        const hex = ac.hex.toLowerCase()
        const existing = byHex.get(hex)
        const seen = typeof ac.seen_pos === 'number' ? ac.seen_pos : 999
        if (!existing || seen < (existing.seen_pos ?? 999)) {
          byHex.set(hex, compactRecord(ac))
        }
      }
      // Respectful spacing between requests
      await new Promise((r) => setTimeout(r, 350))
    } catch (err) {
      console.warn(`[warn] ${err.message}`)
    }
  }

  if (succeededZones.length === 0) {
    throw new Error('All adsb.lol zone fetches failed')
  }

  const nowMs = Date.now()
  const payload = {
    schemaVersion: 1,
    provider: 'api.adsb.lol',
    license: 'ODbL 1.0',
    generatedAt: new Date(nowMs).toISOString(),
    generatedAtMs: nowMs,
    coverageZones: succeededZones,
    totalRawScanned,
    matchedCount: byHex.size,
    aircraft: Array.from(byHex.values()),
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(payload))
  console.log(
    `Saved ${payload.matchedCount} Lufthansa Group flights (scanned ${totalRawScanned} raw aircraft across ${succeededZones.length} zones) -> ${outPath}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
