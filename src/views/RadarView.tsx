import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Pause,
  Play,
  Radar,
  RefreshCw,
  Star,
  Tag,
  X,
} from 'lucide-react'
import { AIRLINES } from '../data/airlines'
import { FLEET_MAP } from '../data/fleet'
import { MAP_HUB_PRESETS } from '../data/hubs'
import type {
  AirlineId,
  ApiSettings,
  EnrichedFlightInfo,
  FavoritesState,
  FeedSnapshotMeta,
  LiveFlight,
} from '../types/aviation'
import { formatRelativeTime } from '../utils/formatters'
import { FlightDetailPanel } from '../components/FlightDetailPanel'
import { RadarMap } from '../components/RadarMap'

interface RadarViewProps {
  flights: LiveFlight[]
  allFlightsCount: number
  selectedAirlines: AirlineId[]
  onToggleAirline: (id: AirlineId) => void
  onSelectAllAirlines: () => void
  onSelectOnlyAirline: (id: AirlineId) => void
  aircraftTypeFilter: string | null
  onClearAircraftTypeFilter: () => void
  favoritesOnly: boolean
  onToggleFavoritesOnly: () => void
  favorites: FavoritesState
  onToggleFavoriteReg: (reg: string) => void
  selectedHex: string | null
  onSelectFlight: (flight: LiveFlight | null) => void
  enrichedInfo: EnrichedFlightInfo | null
  followSelected: boolean
  onToggleFollow: () => void
  settings: ApiSettings
  onUpdateSettings: (patch: Partial<ApiSettings>) => void
  isPaused: boolean
  onTogglePaused: () => void
  isLoading: boolean
  errorMessage: string | null
  feedMeta: FeedSnapshotMeta | null
  onManualRefresh: () => void
  onOpenApiKeyModal: () => void
  onOpenFleetType: (typeId: string) => void
  flyToTarget: { lat: number; lon: number; zoom: number; nonce: number } | null
  onFlyTo: (lat: number, lon: number, zoom: number) => void
  onViewportChange: (vp: { lat: number; lon: number; radiusKm: number }) => void
}

export function RadarView({
  flights,
  allFlightsCount,
  selectedAirlines,
  onToggleAirline,
  onSelectAllAirlines,
  onSelectOnlyAirline,
  aircraftTypeFilter,
  onClearAircraftTypeFilter,
  favoritesOnly,
  onToggleFavoritesOnly,
  favorites,
  onToggleFavoriteReg,
  selectedHex,
  onSelectFlight,
  enrichedInfo,
  followSelected,
  onToggleFollow,
  settings,
  onUpdateSettings,
  isPaused,
  onTogglePaused,
  isLoading,
  errorMessage,
  feedMeta,
  onManualRefresh,
  onOpenApiKeyModal,
  onOpenFleetType,
  flyToTarget,
  onFlyTo,
  onViewportChange,
}: RadarViewProps) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const selectedFlight = useMemo(
    () => (selectedHex ? flights.find((f) => f.hex === selectedHex) ?? null : null),
    [flights, selectedHex]
  )

  const countsByAirline = useMemo(() => {
    const map: Partial<Record<AirlineId, number>> = {}
    for (const f of flights) {
      map[f.airlineId] = (map[f.airlineId] ?? 0) + 1
    }
    return map
  }, [flights])

  const allSelected = selectedAirlines.length === AIRLINES.length
  const activeTypeSpec = aircraftTypeFilter ? FLEET_MAP[aircraftTypeFilter] : null

  return (
    <div className="relative h-[calc(100dvh-56px-62px)] w-full overflow-hidden md:h-[calc(100dvh-64px)]">
      {/* Interactive Leaflet World Map */}
      <RadarMap
        flights={flights}
        selectedHex={selectedHex}
        onSelectFlight={onSelectFlight}
        enrichedInfo={enrichedInfo}
        coverageZones={feedMeta?.coverageZones ?? []}
        showCoverageOverlay={settings.showCoverageOverlay}
        showLabels={settings.showLabels}
        followSelected={followSelected}
        theme={settings.theme}
        unitSystem={settings.unitSystem}
        flyToTarget={flyToTarget}
        onViewportChange={onViewportChange}
      />

      {/* Top Left Floating Controls & Airline Filter Bar (Desktop) */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 z-20 flex flex-col gap-2 md:right-[410px]">
        {/* Primary Toolbar Row */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {/* Live Counter & Data Freshness Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-[#0A163D]/95">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                errorMessage
                  ? 'bg-rose-500'
                  : isLoading
                    ? 'animate-pulse bg-[#FFAD00]'
                    : feedMeta?.isLiveDirect
                      ? 'bg-emerald-500'
                      : 'bg-[#FFAD00]'
              }`}
            />
            <span className="font-mono font-bold text-[#05164D] dark:text-white">
              {flights.length}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {flights.length === allFlightsCount
                ? 'beobachtete Flüge'
                : `von ${allFlightsCount} gefiltert`}
            </span>
            {feedMeta && (
              <span className="hidden border-l border-slate-200 pl-2 text-[11px] text-slate-500 sm:inline dark:border-white/15 dark:text-slate-400">
                Stand: {formatRelativeTime(feedMeta.snapshotGeneratedAtMs ?? feedMeta.fetchedAtMs)}
              </span>
            )}
          </div>

          {/* Refresh / Pause / Overlay / Labels Controls */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-[#0A163D]/95">
            <button
              type="button"
              onClick={onManualRefresh}
              disabled={isLoading}
              title="Daten jetzt aktualisieren"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#FFAD00]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onTogglePaused}
              title={isPaused ? 'Automatische Aktualisierung fortsetzen' : 'Aktualisierung pausieren'}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                isPaused
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ showCoverageOverlay: !settings.showCoverageOverlay })
              }
              title={
                settings.showCoverageOverlay
                  ? 'Abdeckungsradien ausblenden'
                  : 'Abdeckungsradien anzeigen'
              }
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition ${
                settings.showCoverageOverlay
                  ? 'bg-[#05164D]/10 text-[#05164D] dark:bg-[#FFAD00]/20 dark:text-[#FFAD00]'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {settings.showCoverageOverlay ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden lg:inline">Abdeckung</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showLabels: !settings.showLabels })}
              title="Callsign-Labels auf der Karte umschalten"
              className={`hidden h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition sm:flex ${
                settings.showLabels
                  ? 'bg-[#05164D]/10 text-[#05164D] dark:bg-[#FFAD00]/20 dark:text-[#FFAD00]'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Labels</span>
            </button>
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              title="Nur Favoriten anzeigen"
              className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition ${
                favoritesOnly
                  ? 'bg-[#FFAD00] text-[#05164D]'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              <Star className="h-3.5 w-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} />
              <span className="hidden xl:inline">Favoriten</span>
            </button>
          </div>

          {/* Mobile Floating Filter Button */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-[#05164D] px-3 py-2 text-xs font-semibold text-white shadow-lg md:hidden dark:border-white/15 dark:bg-[#FFAD00] dark:text-[#05164D]"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {!allSelected && (
              <span className="rounded-full bg-[#FFAD00] px-1.5 text-[10px] font-bold text-[#05164D] dark:bg-[#05164D] dark:text-white">
                {selectedAirlines.length}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Airline Filter Pills */}
        <div className="pointer-events-auto hidden flex-wrap items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={onSelectAllAirlines}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md transition ${
              allSelected
                ? 'border-[#05164D] bg-[#05164D] text-white dark:border-[#FFAD00] dark:bg-[#FFAD00] dark:text-[#05164D]'
                : 'border-slate-200 bg-white/92 text-slate-700 hover:bg-white dark:border-white/15 dark:bg-[#0A163D]/90 dark:text-slate-200'
            }`}
          >
            Alle Airlines
          </button>
          {AIRLINES.filter((a) => a.status === 'active').map((airline) => {
            const active = selectedAirlines.includes(airline.id)
            const count = countsByAirline[airline.id] ?? 0
            return (
              <button
                key={airline.id}
                type="button"
                onClick={() => onToggleAirline(airline.id)}
                onDoubleClick={() => onSelectOnlyAirline(airline.id)}
                title={`${airline.name} (${airline.icao}) – Klick: umschalten · Doppelklick: nur diese Airline`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md transition ${
                  active
                    ? 'border-slate-300/80 bg-white/95 text-slate-900 dark:border-white/25 dark:bg-[#0F1F52]/95 dark:text-white'
                    : 'border-slate-200/60 bg-white/55 text-slate-400 line-through dark:border-white/10 dark:bg-[#0A163D]/55 dark:text-slate-500'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: airline.brandColor, opacity: active ? 1 : 0.35 }}
                />
                <span>{airline.shortName}</span>
                {count > 0 && (
                  <span className="font-mono text-[10px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Active Fleet Type Filter Pill (when jumping from Fleet Explorer) */}
        {activeTypeSpec && (
          <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-xl border border-[#FFAD00]/60 bg-[#05164D] px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
            <Radar className="h-3.5 w-3.5 text-[#FFAD00]" />
            <span>Flugzeugtyp-Filter: {activeTypeSpec.fullName}</span>
            <button
              type="button"
              onClick={onClearAircraftTypeFilter}
              className="rounded p-0.5 hover:bg-white/15"
              aria-label="Typfilter entfernen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Error / Rate-Limit / CORS Banner */}
        {errorMessage && (
          <div className="pointer-events-auto flex max-w-xl items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50/95 px-3.5 py-2.5 text-xs text-rose-900 shadow-lg backdrop-blur-md dark:border-rose-500/40 dark:bg-rose-950/95 dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">{errorMessage}</p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onOpenApiKeyModal}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#05164D] px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-[#FFAD00] dark:text-[#05164D]"
                >
                  <KeyRound className="h-3 w-3" /> API-Key eingeben
                </button>
                {settings.provider !== 'adsblol-feed' && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ provider: 'adsblol-feed' })}
                    className="rounded-lg border border-rose-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-100 dark:border-rose-400/30 dark:hover:bg-rose-900/50"
                  >
                    Zum kostenlosen adsb.lol Feed wechseln
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Left Hub Quick-Jump & Transparent Coverage Indicator */}
      <div className="pointer-events-none absolute right-14 bottom-4 left-3 z-20 hidden flex-col items-start gap-2 md:flex">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/90 bg-white/92 p-1 shadow-lg backdrop-blur-md dark:border-white/15 dark:bg-[#0A163D]/92">
          {MAP_HUB_PRESETS.map((hub) => (
            <button
              key={hub.id}
              type="button"
              onClick={() => onFlyTo(hub.lat, hub.lon, hub.zoom)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-[#05164D] hover:text-white dark:text-slate-200 dark:hover:bg-[#FFAD00] dark:hover:text-[#05164D]"
            >
              {hub.code === 'EUR' ? 'Europa' : hub.code}
            </button>
          ))}
        </div>

        {feedMeta && (
          <div className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-xl border border-slate-200/80 bg-white/88 px-3 py-1.5 text-[11px] text-slate-600 shadow backdrop-blur-md dark:border-white/10 dark:bg-[#0A163D]/88 dark:text-slate-300">
            <span className="font-semibold text-[#05164D] dark:text-[#FFAD00]">
              {feedMeta.providerLabel}:
            </span>
            <span className="truncate">{feedMeta.coverageDescription}</span>
            {!feedMeta.isLiveDirect && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="ml-1 shrink-0 rounded bg-[#05164D]/10 px-1.5 py-0.5 font-semibold text-[#05164D] hover:bg-[#05164D]/20 dark:bg-[#FFAD00]/15 dark:text-[#FFAD00]"
              >
                Live-Key?
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty region notice */}
      {!isLoading && !errorMessage && flights.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-28 z-20 flex justify-center">
          <div className="pointer-events-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-4 text-center shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-[#0A163D]/95">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Keine passenden Lufthansa-Group-Flüge gefunden
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {favoritesOnly
                ? 'Keines Ihrer favorisierten Flugzeuge ist momentan in der beobachteten Region aktiv.'
                : activeTypeSpec
                  ? `Aktuell wurde kein ${activeTypeSpec.fullName} im überwachten Luftraum empfangen.`
                  : 'In der gewählten Filterung oder Region sind derzeit keine aktiven Transpondersignale vorhanden.'}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {!allSelected && (
                <button
                  type="button"
                  onClick={onSelectAllAirlines}
                  className="rounded-lg bg-[#05164D] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#FFAD00] dark:text-[#05164D]"
                >
                  Alle Airlines anzeigen
                </button>
              )}
              {activeTypeSpec && (
                <button
                  type="button"
                  onClick={onClearAircraftTypeFilter}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-white/20"
                >
                  Typfilter löschen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Flight Detail Slide-over / Mobile Bottom Sheet */}
      <FlightDetailPanel
        flight={selectedFlight}
        enrichedInfo={enrichedInfo}
        isFavorite={Boolean(
          selectedFlight?.registration &&
            favorites.registrations.includes(selectedFlight.registration)
        )}
        onToggleFavorite={onToggleFavoriteReg}
        followSelected={followSelected}
        onToggleFollow={onToggleFollow}
        onResetOverview={() => {
          onSelectFlight(null)
          onFlyTo(48.6, 10.2, 5)
        }}
        onClose={() => onSelectFlight(null)}
        onOpenFleetType={onOpenFleetType}
        unitSystem={settings.unitSystem}
      />

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#040B24]/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="pb-safe max-h-[78vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-[#0A163D]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Airlines &amp; Drehkreuze filtern
              </h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="rounded-lg p-1 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Airlines</span>
                <button
                  type="button"
                  onClick={onSelectAllAirlines}
                  className="text-[#05164D] underline dark:text-[#FFAD00]"
                >
                  Alle auswählen
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AIRLINES.filter((a) => a.status === 'active').map((airline) => {
                  const active = selectedAirlines.includes(airline.id)
                  const count = countsByAirline[airline.id] ?? 0
                  return (
                    <button
                      key={airline.id}
                      type="button"
                      onClick={() => onToggleAirline(airline.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? 'border-[#05164D] bg-[#05164D]/5 text-slate-900 dark:border-[#FFAD00] dark:bg-[#FFAD00]/10 dark:text-white'
                          : 'border-slate-200 text-slate-400 dark:border-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: airline.brandColor }}
                        />
                        <span className="truncate">{airline.shortName}</span>
                      </span>
                      <span className="font-mono text-[11px]">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-slate-500">Schnellfokus Hub</div>
              <div className="flex flex-wrap gap-1.5">
                {MAP_HUB_PRESETS.map((hub) => (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      onFlyTo(hub.lat, hub.lon, hub.zoom)
                      setMobileFilterOpen(false)
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-white"
                  >
                    {hub.label} ({hub.code})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
