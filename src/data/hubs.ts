import type { CoverageZone } from '../types/aviation'

/**
 * Strategic European + Atlantic gateway coverage zones used by the automated
 * adsb.lol live feed snapshot (250 NM ~ 460 km radius).
 */
export const LHG_COVERAGE_ZONES: CoverageZone[] = [
  {
    id: 'fra',
    name: 'Frankfurt & Rhein-Ruhr',
    shortLabel: 'FRA / DUS / BRU',
    lat: 50.35,
    lon: 8.2,
    radiusKm: 460,
    region: 'Mitteleuropa',
  },
  {
    id: 'muc-zrh-vie',
    name: 'München, Zürich & Wien',
    shortLabel: 'MUC / ZRH / VIE',
    lat: 47.9,
    lon: 12.1,
    radiusKm: 460,
    region: 'Alpenraum & Ost',
  },
  {
    id: 'ita',
    name: 'Rom & Mailand (ITA / Dolomiti)',
    shortLabel: 'FCO / LIN / MXP',
    lat: 43.2,
    lon: 11.8,
    radiusKm: 460,
    region: 'Südeuropa / Italien',
  },
  {
    id: 'north-atlantic-uk',
    name: 'Nordsee, UK & Atlantik-Korridor',
    shortLabel: 'LHR / AMS / Nordatlantik',
    lat: 53.0,
    lon: -1.5,
    radiusKm: 460,
    region: 'Westeuropa & Atlantik-Tor',
  },
  {
    id: 'nordics',
    name: 'Norddeutschland & Skandinavien',
    shortLabel: 'HAM / BER / CPH',
    lat: 55.6,
    lon: 12.2,
    radiusKm: 460,
    region: 'Nordeuropa',
  },
  {
    id: 'iberia-med',
    name: 'Westliches Mittelmeer & Balearen',
    shortLabel: 'PMI / BCN / NCE',
    lat: 41.3,
    lon: 2.8,
    radiusKm: 460,
    region: 'Mittelmeerraum',
  },
]

/**
 * Extended multi-zone sweep for FlyItalyADSB Free API Key (500 km radius per request,
 * 30 req/min limit). Covers Europe broadly plus major intercontinental Lufthansa Group hubs.
 */
export const FLYITALY_SWEEP_ZONES: CoverageZone[] = [
  {
    id: 'fi-fra',
    name: 'Frankfurt, Benelux & Rhein-Ruhr',
    shortLabel: 'FRA / BRU / DUS',
    lat: 50.5,
    lon: 7.8,
    radiusKm: 500,
    region: 'Mitteleuropa',
  },
  {
    id: 'fi-muc-vie',
    name: 'München, Zürich & Wien',
    shortLabel: 'MUC / ZRH / VIE',
    lat: 47.8,
    lon: 12.8,
    radiusKm: 500,
    region: 'Alpenraum & Ost',
  },
  {
    id: 'fi-ita',
    name: 'Italien & Adria (ITA / Dolomiti)',
    shortLabel: 'FCO / LIN / MXP',
    lat: 42.6,
    lon: 12.4,
    radiusKm: 500,
    region: 'Italien & Adria',
  },
  {
    id: 'fi-uk-atl',
    name: 'UK, Irland & Nordatlantik-Tor',
    shortLabel: 'LHR / DUB / Atlantik',
    lat: 53.0,
    lon: -2.0,
    radiusKm: 500,
    region: 'Westeuropa & Nordsee',
  },
  {
    id: 'fi-nordics',
    name: 'Norddeutschland, Skandinavien & Polen',
    shortLabel: 'HAM / BER / CPH / WAW',
    lat: 55.5,
    lon: 14.5,
    radiusKm: 500,
    region: 'Nord- & Osteuropa',
  },
  {
    id: 'fi-iberia',
    name: 'Spanien, Balearen & Südfrankreich',
    shortLabel: 'PMI / BCN / MAD',
    lat: 40.8,
    lon: 0.5,
    radiusKm: 500,
    region: 'Frankreich & Iberien',
  },
  {
    id: 'fi-balkan-greece',
    name: 'Südosteuropa & Griechenland',
    shortLabel: 'ATH / SOF / OTP',
    lat: 41.2,
    lon: 22.8,
    radiusKm: 500,
    region: 'Südosteuropa',
  },
  {
    id: 'fi-us-east',
    name: 'US-Ostküste (JFK / EWR / BOS / IAD)',
    shortLabel: 'JFK / EWR / IAD',
    lat: 40.7,
    lon: -73.8,
    radiusKm: 500,
    region: 'Nordamerika',
  },
  {
    id: 'fi-us-midwest',
    name: 'Nordamerika Zentral (ORD / YYZ)',
    shortLabel: 'ORD / YYZ / DTW',
    lat: 42.3,
    lon: -83.5,
    radiusKm: 500,
    region: 'Nordamerika',
  },
]

export interface HubPreset {
  id: string
  label: string
  code: string
  lat: number
  lon: number
  zoom: number
}

export const MAP_HUB_PRESETS: HubPreset[] = [
  { id: 'europe', label: 'Europa', code: 'EUR', lat: 48.6, lon: 10.2, zoom: 5 },
  { id: 'fra', label: 'Frankfurt', code: 'FRA', lat: 50.0379, lon: 8.5622, zoom: 8 },
  { id: 'muc', label: 'München', code: 'MUC', lat: 48.3538, lon: 11.7861, zoom: 8 },
  { id: 'zrh', label: 'Zürich', code: 'ZRH', lat: 47.4647, lon: 8.5492, zoom: 8 },
  { id: 'vie', label: 'Wien', code: 'VIE', lat: 48.1103, lon: 16.5697, zoom: 8 },
  { id: 'bru', label: 'Brüssel', code: 'BRU', lat: 50.9014, lon: 4.4844, zoom: 8 },
  { id: 'fco', label: 'Rom FCO', code: 'FCO', lat: 41.8003, lon: 12.2389, zoom: 8 },
  { id: 'jfk', label: 'New York', code: 'JFK', lat: 40.6413, lon: -73.7781, zoom: 6 },
]

export function classifyRegion(lat: number, lon: number): string {
  if (lat >= 46 && lat <= 55.5 && lon >= 5 && lon <= 17.5) return 'DACH & Mitteleuropa'
  if (lat >= 36 && lat < 46 && lon >= 6 && lon <= 19) return 'Italien & Adria'
  if (lat >= 48 && lat <= 60 && lon >= -11 && lon < 5) return 'Benelux, UK & Nordsee'
  if (lat > 55.5 && lon >= 4 && lon <= 32) return 'Nordeuropa & Baltikum'
  if (lat >= 35 && lat < 48 && lon >= -10 && lon < 6) return 'Frankreich & Iberien'
  if (lat >= 34 && lat <= 50 && lon > 17.5 && lon <= 35) return 'Südost- & Osteuropa'
  if (lon < -11 && lon >= -55 && lat >= 25) return 'Nordatlantik'
  if (lon < -55 && lat >= 15) return 'Nordamerika'
  if (lon > 35 && lat >= 10) return 'Naher Osten & Asien'
  if (lat < 35 && lon >= -20 && lon <= 50) return 'Afrika & Kanaren'
  return 'International'
}
