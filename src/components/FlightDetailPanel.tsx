import { useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Gauge,
  Globe2,
  Info,
  MapPin,
  Mountain,
  Plane,
  Radio,
  Star,
  TrendingUp,
  X,
} from 'lucide-react'
import { AIRLINE_MAP } from '../data/airlines'
import { FLEET_MAP, getBestPhotoForAircraft } from '../data/fleet'
import type { EnrichedFlightInfo, LiveFlight, UnitSystem } from '../types/aviation'
import {
  formatAltitude,
  formatCoords,
  formatFlightLevel,
  formatHeading,
  formatRelativeTime,
  formatSpeed,
  formatVerticalRate,
  getFlightPhase,
} from '../utils/formatters'
import { AircraftImage } from './AircraftImage'

interface FlightDetailPanelProps {
  flight: LiveFlight | null
  enrichedInfo: EnrichedFlightInfo | null
  isFavorite: boolean
  onToggleFavorite: (registration: string) => void
  followSelected: boolean
  onToggleFollow: () => void
  onResetOverview: () => void
  onClose: () => void
  onOpenFleetType: (typeId: string) => void
  unitSystem: UnitSystem
}

export function FlightDetailPanel({
  flight,
  enrichedInfo,
  isFavorite,
  onToggleFavorite,
  followSelected,
  onToggleFollow,
  onResetOverview,
  onClose,
  onOpenFleetType,
  unitSystem,
}: FlightDetailPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  if (!flight) return null

  const airline = AIRLINE_MAP[flight.airlineId]
  const fleetSpec = flight.aircraftTypeId ? FLEET_MAP[flight.aircraftTypeId] : null
  const fallbackPhoto = fleetSpec ? getBestPhotoForAircraft(fleetSpec, flight.airlineId) : null
  const phase = getFlightPhase(flight.altBaroFt, flight.verticalRateFpm, flight.onGround)
  const fl = formatFlightLevel(flight.altBaroFt, flight.onGround)

  const photoUrl = enrichedInfo?.photoUrl ?? fallbackPhoto?.url ?? null
  const photoAuthor =
    enrichedInfo?.photoSource === 'planespotters'
      ? enrichedInfo.photoAuthor
      : fallbackPhoto?.author ?? null
  const photoLicense =
    enrichedInfo?.photoSource === 'planespotters'
      ? 'Planespotters.net (Exakte Registrierung)'
      : fallbackPhoto?.license ?? null
  const photoLink =
    enrichedInfo?.photoSource === 'planespotters'
      ? enrichedInfo.photoLink
      : fallbackPhoto?.pageUrl ?? null

  return (
    <aside
      aria-label="Flugzeugdetails"
      className={`fixed right-0 bottom-[62px] left-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl transition-all duration-300 md:top-3 md:right-3 md:bottom-3 md:left-auto md:w-[390px] md:rounded-2xl md:border dark:border-white/15 dark:bg-[#0A163D] ${
        mobileExpanded ? 'h-[76vh] md:h-auto' : 'max-h-[44vh] md:max-h-none'
      }`}
    >
      {/* Mobile swipe / expand handle */}
      <button
        type="button"
        onClick={() => setMobileExpanded((prev) => !prev)}
        className="flex w-full items-center justify-center gap-1.5 border-b border-slate-100 py-1.5 text-[11px] font-medium text-slate-400 md:hidden dark:border-white/10"
      >
        <span className="h-1 w-9 rounded-full bg-slate-300 dark:bg-white/25" />
        {mobileExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {/* Airline Brand Accent Header */}
      <div
        className="relative flex items-start justify-between gap-3 px-4 py-3.5 text-white"
        style={{
          background: `linear-gradient(135deg, ${airline.brandColor} 0%, #05164D 100%)`,
        }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-extrabold tracking-tight text-white">
              {flight.callsign}
            </span>
            {flight.flightNumber && (
              <span className="rounded-md bg-white/18 px-1.5 py-0.5 font-mono text-xs font-semibold text-[#FFAD00]">
                {flight.flightNumber}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${phase.colorClass}`}>
              {phase.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-blue-100/90">
            {airline.name} · {airline.icao} / {airline.iata}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {flight.registration && (
            <button
              type="button"
              onClick={() => onToggleFavorite(flight.registration!)}
              title={isFavorite ? 'Aus Favoriten entfernen' : 'Registrierung als Favorit speichern'}
              className={`rounded-lg p-1.5 transition ${
                isFavorite
                  ? 'bg-[#FFAD00] text-[#05164D]'
                  : 'bg-white/12 text-white hover:bg-white/20'
              }`}
            >
              <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Details schließen"
            className="rounded-lg bg-white/12 p-1.5 text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Aircraft Photo */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
          <AircraftImage
            src={photoUrl}
            alt={`${airline.shortName} ${fleetSpec?.fullName ?? flight.icaoType ?? 'Flugzeug'}`}
            caption={
              flight.registration
                ? `${flight.registration} · ${fleetSpec?.fullName ?? flight.icaoType ?? ''}`
                : undefined
            }
            author={photoAuthor}
            license={photoLicense}
            sourceUrl={photoLink}
            aspectClass="aspect-[16/9]"
          />
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs dark:bg-[#061030]">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                {fleetSpec?.fullName ?? flight.aircraftDescription ?? flight.icaoType ?? 'Flugzeugtyp unbekannt'}
              </span>
              {flight.icaoType && (
                <span className="ml-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  ({flight.icaoType})
                </span>
              )}
            </div>
            <span className="font-mono text-xs font-bold text-[#05164D] dark:text-[#FFAD00]">
              {flight.registration ?? 'Reg. unbekannt'}
            </span>
          </div>
        </div>

        {/* Route Card (adsbdb.com enrichment — strictly honest when unavailable) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-[#061030]">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Flugroute
            </span>
            {enrichedInfo?.status === 'loading' ? (
              <span className="animate-pulse text-slate-400">Suche Route via adsbdb…</span>
            ) : enrichedInfo?.routeSource === 'adsbdb' ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#05164D] dark:bg-blue-500/20 dark:text-blue-200">
                Ergänzt · adsbdb.com
              </span>
            ) : (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Nicht verfügbar
              </span>
            )}
          </div>

          {enrichedInfo?.origin && enrichedInfo?.destination ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xl font-extrabold text-[#05164D] dark:text-white">
                  {enrichedInfo.origin.iata}
                </div>
                <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {enrichedInfo.origin.municipality || enrichedInfo.origin.name}
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  {enrichedInfo.origin.icao} · {enrichedInfo.origin.country}
                </div>
              </div>
              <div className="flex flex-col items-center px-2 text-[#FFAD00]">
                <ArrowRight className="h-5 w-5" />
                <span className="mt-0.5 text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                  Route
                </span>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="font-mono text-xl font-extrabold text-[#05164D] dark:text-white">
                  {enrichedInfo.destination.iata}
                </div>
                <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {enrichedInfo.destination.municipality || enrichedInfo.destination.name}
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  {enrichedInfo.destination.icao} · {enrichedInfo.destination.country}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {enrichedInfo?.status === 'loading'
                ? 'Abflug- und Zielflughafen werden über adsbdb.com abgefragt…'
                : 'Abflug- und Zielflughafen sind für dieses Callsign im offenen ADS-B-Datenbestand aktuell nicht hinterlegt.'}
            </p>
          )}
        </div>

        {/* Action Controls: Follow, Overview, Fleet Link */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleFollow}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              followSelected
                ? 'border-[#FFAD00] bg-[#FFAD00] text-[#05164D]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {followSelected ? 'Verfolgung aktiv' : 'Karte nachführen'}
          </button>
          <button
            type="button"
            onClick={onResetOverview}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            <Globe2 className="h-3.5 w-3.5" />
            Gesamtübersicht
          </button>
        </div>

        {/* Measured Live Telemetry Grid */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Live-Telemetrie (ADS-B gemessen)
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              HEX {flight.hex.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Mountain className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Flughöhe (Baro)
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {formatAltitude(flight.altBaroFt, flight.onGround, unitSystem)}
              </div>
              {fl && <div className="font-mono text-[10px] text-slate-400">{fl}</div>}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Gauge className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Geschwindigkeit
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {formatSpeed(flight.groundSpeedKt, flight.groundSpeedKmh, unitSystem)}
              </div>
              {flight.groundSpeedKt !== null && flight.groundSpeedKmh !== null && (
                <div className="font-mono text-[10px] text-slate-400">
                  {unitSystem === 'aviation'
                    ? `${flight.groundSpeedKmh} km/h`
                    : `${flight.groundSpeedKt} kt`}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Compass className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Flugrichtung
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {formatHeading(flight.trackDeg)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Vertikalrate
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {formatVerticalRate(flight.verticalRateFpm, unitSystem)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Position
              </div>
              <div className="mt-1 font-mono text-[11px] font-semibold text-slate-900 dark:text-white">
                {formatCoords(flight.lat, flight.lon)}
              </div>
              <div className="text-[10px] text-slate-400">{flight.region}</div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-white/10 dark:bg-[#0F1F52]/60">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Radio className="h-3.5 w-3.5 text-[#05164D] dark:text-[#FFAD00]" />
                Squawk / Alter
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {flight.squawk ?? '—'}
              </div>
              <div className="text-[10px] text-slate-400">
                Meldung: {formatRelativeTime(flight.lastSeenMs)}
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Explorer Deep Link */}
        {fleetSpec && (
          <button
            type="button"
            onClick={() => onOpenFleetType(fleetSpec.id)}
            className="flex w-full items-center justify-between rounded-xl bg-[#05164D] px-4 py-3 text-left text-white transition hover:bg-[#0B226B] dark:bg-[#FFAD00] dark:text-[#05164D] dark:hover:bg-[#E59B00]"
          >
            <div className="flex items-center gap-2.5">
              <Plane className="h-4 w-4 text-[#FFAD00] dark:text-[#05164D]" />
              <div>
                <div className="text-xs font-bold">
                  {fleetSpec.fullName} im Fleet Explorer
                </div>
                <div className="text-[11px] opacity-80">
                  Technische Daten, Flottengröße &amp; Galerie ansehen
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        )}

        {/* Airline Match Transparency & Trail Info */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:border-white/10 dark:bg-[#061030] dark:text-slate-400">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#05164D] dark:text-[#FFAD00]" />
            <div className="space-y-1">
              <p>
                <strong>Zuordnung:</strong> {flight.airlineMatchReason}. ADS-B zeigt das tatsächlich ausführende Luftfahrtunternehmen (Operating Carrier) – Codeshare-Flugnummern können abweichen.
              </p>
              <p>
                <strong>Flugweg:</strong> {flight.trail.length}{' '}
                {flight.trail.length === 1
                  ? 'Positionspunkt in dieser Sitzung erfasst (wächst mit jedem Update).'
                  : 'beobachtete Positionspunkte während dieser Sitzung aufgezeichnet.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
