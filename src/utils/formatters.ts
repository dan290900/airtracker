import type { UnitSystem } from '../types/aviation'

export function formatAltitude(altFt: number | null, onGround: boolean, units: UnitSystem): string {
  if (onGround) return 'Am Boden'
  if (altFt === null) return 'Nicht verfügbar'
  if (units === 'metric') {
    const meters = Math.round(altFt * 0.3048)
    return `${meters.toLocaleString('de-DE')} m`
  }
  return `${altFt.toLocaleString('de-DE')} ft`
}

export function formatFlightLevel(altFt: number | null, onGround: boolean): string | null {
  if (onGround || altFt === null || altFt < 5000) return null
  return `FL${Math.round(altFt / 100)}`
}

export function formatSpeed(
  speedKt: number | null,
  speedKmh: number | null,
  units: UnitSystem
): string {
  if (speedKt === null || speedKmh === null) return 'Nicht verfügbar'
  if (units === 'metric') {
    return `${speedKmh.toLocaleString('de-DE')} km/h`
  }
  return `${speedKt.toLocaleString('de-DE')} kt`
}

export function formatVerticalRate(fpm: number | null, units: UnitSystem): string {
  if (fpm === null) return 'Nicht verfügbar'
  const sign = fpm > 0 ? '+' : ''
  if (units === 'metric') {
    const ms = (fpm * 0.00508).toFixed(1)
    return `${fpm > 0 ? '+' : ''}${ms} m/s`
  }
  return `${sign}${fpm.toLocaleString('de-DE')} ft/min`
}

export function formatHeading(deg: number | null): string {
  if (deg === null) return 'Nicht verfügbar'
  const rounded = Math.round(deg) % 360
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
  const cardinal = dirs[Math.round(rounded / 45) % 8]
  return `${String(rounded).padStart(3, '0')}° (${cardinal})`
}

export function formatCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'O' : 'W'
  return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`
}

export function formatRelativeTime(timestampMs: number | null | undefined): string {
  if (!timestampMs) return 'Noch nicht abgerufen'
  const diffSec = Math.max(0, Math.round((Date.now() - timestampMs) / 1000))
  if (diffSec < 10) return 'Gerade eben'
  if (diffSec < 60) return `vor ${diffSec} Sek.`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `vor ${diffMin} Min.`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `vor ${diffHr} Std.`
  return new Date(timestampMs).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatUtcTime(timestampMs: number | null | undefined): string {
  if (!timestampMs) return '—'
  return new Date(timestampMs).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

export function getFlightPhase(
  altFt: number | null,
  verticalRateFpm: number | null,
  onGround: boolean
): { label: string; colorClass: string } {
  if (onGround) {
    return {
      label: 'Am Boden / Rollen',
      colorClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200',
    }
  }
  if (verticalRateFpm !== null && verticalRateFpm >= 350) {
    return {
      label: 'Steigflug',
      colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
    }
  }
  if (verticalRateFpm !== null && verticalRateFpm <= -350) {
    return {
      label: altFt !== null && altFt < 10000 ? 'Landeanflug' : 'Sinkflug',
      colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    }
  }
  if (altFt !== null && altFt >= 20000) {
    return {
      label: 'Reiseflug',
      colorClass: 'bg-blue-100 text-[#05164D] dark:bg-blue-500/20 dark:text-blue-200',
    }
  }
  return {
    label: 'In der Luft',
    colorClass: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  }
}

/** Calculate great-circle intermediate points for clean route arcs on Leaflet */
export function buildGreatCircleArc(
  start: [number, number],
  end: [number, number],
  steps = 36
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(start[0])
  const lon1 = toRad(start[1])
  const lat2 = toRad(end[0])
  const lon2 = toRad(end[1])

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    )

  if (d < 1e-6) return [start, end]

  const points: [number, number][] = []
  let prevLon: number | null = null
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
    let lon = toDeg(Math.atan2(y, x))
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360
      while (lon - prevLon < -180) lon += 360
    }
    prevLon = lon
    points.push([lat, lon])
  }
  return points
}
