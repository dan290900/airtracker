export type AirlineId =
  | 'DLH'
  | 'SWR'
  | 'AUA'
  | 'BEL'
  | 'EWG'
  | 'OCN'
  | 'EDW'
  | 'DLA'
  | 'LHX'
  | 'ITY'
  | 'GEC'
  | 'CLH'

export type AircraftCategory = 'widebody' | 'narrowbody' | 'regional' | 'freighter'

export type NavTab = 'radar' | 'dashboard' | 'fleet' | 'airlines' | 'settings'

export type ProviderId = 'adsblol-feed' | 'flyitalyadsb' | 'adsblol-direct' | 'adsbfi-relay'

export type UnitSystem = 'aviation' | 'metric'

export interface AirlineConfig {
  id: AirlineId
  name: string
  shortName: string
  iata: string
  icao: string
  /** All ICAO callsign prefixes actively flown by or mapped to this carrier */
  callsignPrefixes: string[]
  /** Official ATC radio telephony */
  telephony: string
  groupAffiliation: string
  status: 'active' | 'ceased'
  statusNote?: string
  brandColor: string
  secondaryColor: string
  country: string
  countryCode: string
  hubs: string[]
  alliance: string
  /** Registration prefixes frequently associated with this carrier (secondary signal) */
  registrationHints: string[]
  aircraftTypeIds: string[]
  fleetCount: number
  fleetReferenceDate: string
  description: string
  website: string
}

export interface AircraftPhoto {
  url: string
  fallbackUrl?: string
  pageUrl: string
  author: string
  license: string
  caption: string
  airlineId: AirlineId
}

export interface AirlineFleetAllocation {
  airlineId: AirlineId
  inService: number
  orders?: number
  notes?: string
}

export interface AircraftTypeSpec {
  id: string
  icaoCodes: string[]
  manufacturer: 'Airbus' | 'Boeing' | 'Embraer' | 'Bombardier'
  family: string
  model: string
  fullName: string
  category: AircraftCategory
  typicalSeats: string
  rangeKm: number
  cruiseSpeedKmh: number
  cruiseMach: string
  lengthM: number
  wingspanM: number
  heightM: number
  engineCount: 2 | 4
  engines: string
  role: string
  summary: string
  operatingAirlines: AirlineFleetAllocation[]
  photo: AircraftPhoto
  gallery?: AircraftPhoto[]
  referenceDate: string
  sources: string[]
}

export type MatchConfidence = 'callsign' | 'registration' | 'operator' | 'unknown'

export interface LiveFlight {
  hex: string
  callsign: string
  flightNumber: string | null
  airlineId: AirlineId
  airlineMatchConfidence: MatchConfidence
  airlineMatchReason: string
  registration: string | null
  icaoType: string | null
  aircraftTypeId: string | null
  aircraftDescription: string | null
  lat: number
  lon: number
  altBaroFt: number | null
  altGeomFt: number | null
  onGround: boolean
  groundSpeedKt: number | null
  groundSpeedKmh: number | null
  trackDeg: number | null
  verticalRateFpm: number | null
  squawk: string | null
  category: string | null
  seenPosSec: number | null
  lastSeenMs: number
  sourceProvider: ProviderId
  region: string
  /** Observed positions recorded during active browser session [lat, lon] */
  trail: [number, number][]
}

export interface AirportInfo {
  iata: string
  icao: string
  name: string
  municipality: string
  country: string
  countryIso: string
  lat: number
  lon: number
}

export interface EnrichedFlightInfo {
  callsign: string
  hex: string
  origin: AirportInfo | null
  destination: AirportInfo | null
  routeSource: 'adsbdb' | 'none'
  photoUrl: string | null
  photoAuthor: string | null
  photoLink: string | null
  photoSource: 'planespotters' | 'wikimedia' | 'none'
  fetchedAt: number
  status: 'loading' | 'loaded' | 'not_found' | 'error'
}

export interface CoverageZone {
  id: string
  name: string
  shortLabel: string
  lat: number
  lon: number
  radiusKm: number
  region: string
}

export interface QuotaInfo {
  limit?: number
  remaining?: number
  resetLabel?: string
  plan?: string
  monthlyQuota?: number
  monthlyUsed?: number
}

export interface FeedSnapshotMeta {
  provider: ProviderId
  providerLabel: string
  fetchedAtMs: number
  snapshotGeneratedAtMs?: number
  coverageZones: CoverageZone[]
  coverageDescription: string
  totalRawScanned?: number
  matchedCount: number
  isLiveDirect: boolean
  quota?: QuotaInfo
  warning?: string
}

export type MapStyle = 'auto' | 'street' | 'osm' | 'satellite' | 'dark'

export interface ApiSettings {
  provider: ProviderId
  flyItalyApiKey: string
  adsbLolApiKey: string
  customRelayUrl: string
  refreshIntervalSec: number
  pauseWhenHidden: boolean
  unitSystem: UnitSystem
  showCoverageOverlay: boolean
  showLabels: boolean
  mapStyle: MapStyle
  theme: 'light' | 'dark'
}

export interface FavoritesState {
  registrations: string[]
  aircraftTypes: string[]
}
