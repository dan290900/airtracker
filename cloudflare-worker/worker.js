/**
 * Lufthansa Group Radar – Kostenloser Cloudflare Worker (CORS-Relay & Weltweit-Filter für api.adsb.lol)
 *
 * Endpunkte:
 *   GET /           -> Status & Gesundheitscheck
 *   GET /lhg-live   -> Alle 33 Lufthansa-Group-Flugzeugtypen weltweit in 1 einzigen Request (Edge-Cache: 20 s)
 *   GET /v2/...     -> Optionaler CORS-Passthrough auf https://api.adsb.lol/v2/... (Edge-Cache: 10 s)
 *
 * Optionales Cloudflare-Secret (nicht zwingend erforderlich):
 *   ADSBLOL_API_KEY -> Erhöht das adsb.lol-Kontingent auf 1.000–7.200 Req/Tag
 *   ALLOWED_ORIGIN  -> Zusätzliche erlaubte Origin (Standard erlaubt dan290900.github.io & localhost)
 */

const LHG_ALL_33_TYPES = [
  'A359', 'A35K', 'A388', 'B748', 'B744', 'B789', 'B77W', 'B772', 'B77L', 'B763',
  'A333', 'A339', 'A332', 'A343', 'A346', 'BCS1', 'BCS3', 'E190', 'E195', 'CRJ9',
  'A319', 'A320', 'A20N', 'A321', 'A21N',
  'E290', 'E295', 'AT76', 'B738', 'B38M', 'E170', 'E175', 'CRJ7',
].join(',')

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

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const extraOrigin = (env && env.ALLOWED_ORIGIN) || ''
  const isAllowed =
    !origin ||
    origin === 'https://dan290900.github.io' ||
    origin === extraOrigin ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : 'https://dan290900.github.io',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, x-api-key, X-Api-Key',
    'Access-Control-Expose-Headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-lhg-cache',
    'Vary': 'Origin',
  }
}

function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

export default {
  async fetch(request, env, ctx) {
    const cors = buildCorsHeaders(request, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, cors)
    }

    const url = new URL(request.url)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    // Health check endpoint
    if (pathname === '/' || pathname === '/health') {
      return jsonResponse(
        {
          ok: true,
          service: 'lhg-adsb-relay',
          provider: 'api.adsb.lol (ODbL 1.0)',
          endpoints: ['/lhg-live', '/v2/point/{lat}/{lon}/{distNm}', '/v2/type/{types}'],
        },
        200,
        cors,
        { 'Cache-Control': 'no-store' }
      )
    }

    const upstreamApiKey =
      request.headers.get('x-api-key') || (env && env.ADSBLOL_API_KEY) || ''
    const upstreamHeaders = {
      Accept: 'application/json',
      'User-Agent': 'LufthansaGroupRadar-CFWorker/1.0 (+https://github.com/dan290900/airtracker)',
    }
    if (upstreamApiKey) {
      upstreamHeaders['x-api-key'] = upstreamApiKey
    }

    // 1) Optimized Worldwide Lufthansa Group Endpoint: 1 single upstream call, ~30 KB filtered JSON, 20s Edge Cache!
    if (pathname === '/lhg-live') {
      const cache = caches.default
      const cacheKey = new Request(`${url.origin}/lhg-live`, { method: 'GET' })
      const cached = await cache.match(cacheKey)
      if (cached) {
        const res = new Response(cached.body, cached)
        for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
        res.headers.set('x-lhg-cache', 'HIT')
        return res
      }

      const upstream = await fetch(`https://api.adsb.lol/v2/type/${LHG_ALL_33_TYPES}`, {
        headers: upstreamHeaders,
      })

      if (!upstream.ok) {
        return jsonResponse(
          { error: `api.adsb.lol returned HTTP ${upstream.status}` },
          upstream.status,
          cors
        )
      }

      const rawJson = await upstream.json()
      const rawList = Array.isArray(rawJson.ac) ? rawJson.ac : []
      const byHex = new Map()

      for (const ac of rawList) {
        if (!ac || typeof ac.hex !== 'string') continue
        if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue
        if (ac.lat === 0 && ac.lon === 0) continue
        if (!isLhgAircraft(ac)) continue
        const hex = ac.hex.toLowerCase()
        const prev = byHex.get(hex)
        const seen = typeof ac.seen_pos === 'number' ? ac.seen_pos : 999
        if (!prev || seen < (prev.seen_pos ?? 999)) {
          byHex.set(hex, compactRecord(ac))
        }
      }

      const nowMs = Date.now()
      const payload = {
        schemaVersion: 2,
        provider: 'api.adsb.lol',
        license: 'ODbL 1.0',
        mode: 'worldwide-worker-live',
        generatedAt: new Date(nowMs).toISOString(),
        generatedAtMs: nowMs,
        worldwideTypesCount: 33,
        totalRawScanned: rawList.length,
        matchedCount: byHex.size,
        aircraft: Array.from(byHex.values()),
      }

      const rateHeaders = {}
      for (const h of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
        const val = upstream.headers.get(h)
        if (val) rateHeaders[h] = val
      }

      const response = jsonResponse(payload, 200, cors, {
        'Cache-Control': 'public, max-age=20, s-maxage=20',
        'x-lhg-cache': 'MISS',
        ...rateHeaders,
      })

      ctx.waitUntil(cache.put(cacheKey, response.clone()))
      return response
    }

    // 2) Standard /v2/* CORS passthrough for api.adsb.lol
    if (pathname.startsWith('/v2/')) {
      const upstreamUrl = `https://api.adsb.lol${pathname}${url.search}`
      const upstream = await fetch(upstreamUrl, {
        headers: upstreamHeaders,
        cf: { cacheTtl: 10, cacheEverything: true },
      })

      const resHeaders = new Headers(upstream.headers)
      for (const [k, v] of Object.entries(cors)) resHeaders.set(k, v)
      resHeaders.set('Cache-Control', 'public, max-age=10')

      return new Response(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
      })
    }

    return jsonResponse({ error: 'Not found. Use /lhg-live or /v2/...' }, 404, cors)
  },
}
