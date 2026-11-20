import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiKeyModal } from './components/ApiKeyModal'
import { HeaderNav } from './components/HeaderNav'
import { SearchModal } from './components/SearchModal'
import { ALL_AIRLINE_IDS } from './data/airlines'
import { FLEET_MAP } from './data/fleet'
import { AdsbApiError, fetchLhgFlights } from './services/adsbClient'
import { enrichSelectedFlight } from './services/enrichmentClient'
import {
  loadFavorites,
  loadSettings,
  saveFavorites,
  saveSettings,
} from './services/storage'
import type {
  AirlineId,
  ApiSettings,
  EnrichedFlightInfo,
  FavoritesState,
  FeedSnapshotMeta,
  LiveFlight,
  NavTab,
  ProviderId,
} from './types/aviation'
import { AirlinesView } from './views/AirlinesView'
import { DashboardView } from './views/DashboardView'
import { FleetExplorerView } from './views/FleetExplorerView'
import { RadarView } from './views/RadarView'
import { SettingsView } from './views/SettingsView'

function parseHashRoute(): { tab: NavTab; fleetTypeId: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [segment, sub] = hash.split('/')
  if (segment === 'dashboard') return { tab: 'dashboard', fleetTypeId: null }
  if (segment === 'fleet') {
    const typeId = sub && FLEET_MAP[sub] ? sub : null
    return { tab: 'fleet', fleetTypeId: typeId }
  }
  if (segment === 'airlines') return { tab: 'airlines', fleetTypeId: null }
  if (segment === 'settings') return { tab: 'settings', fleetTypeId: null }
  return { tab: 'radar', fleetTypeId: null }
}

export default function App() {
  const initialRoute = parseHashRoute()
  const [activeTab, setActiveTab] = useState<NavTab>(initialRoute.tab)
  const [selectedFleetTypeId, setSelectedFleetTypeId] = useState<string | null>(
    initialRoute.fleetTypeId
  )
  const [fleetAirlineFilter, setFleetAirlineFilter] = useState<AirlineId | 'ALL'>('ALL')

  const [settings, setSettings] = useState<ApiSettings>(() => loadSettings())
  const [favorites, setFavorites] = useState<FavoritesState>(() => loadFavorites())

  const [flights, setFlights] = useState<LiveFlight[]>([])
  const flightsMapRef = useRef<Map<string, LiveFlight>>(new Map())
  const [feedMeta, setFeedMeta] = useState<FeedSnapshotMeta | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isTabHidden, setIsTabHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
  )

  const [selectedAirlines, setSelectedAirlines] = useState<AirlineId[]>(ALL_AIRLINE_IDS)
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false)
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [followSelected, setFollowSelected] = useState<boolean>(false)
  const [enrichedInfo, setEnrichedInfo] = useState<EnrichedFlightInfo | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number
    lon: number
    zoom: number
    nonce: number
  } | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [apiModalOpen, setApiModalOpen] = useState(false)
  const [apiModalProvider, setApiModalProvider] = useState<ProviderId | undefined>(undefined)

  const viewportRef = useRef({ lat: 48.6, lon: 10.2, radiusKm: 460 })
  const backoffUntilRef = useRef<number>(0)

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  // Hash navigation synchronization for GitHub Pages reload safety
  useEffect(() => {
    const targetHash =
      activeTab === 'fleet' && selectedFleetTypeId
        ? `#/fleet/${selectedFleetTypeId}`
        : `#/${activeTab}`
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash)
    }
  }, [activeTab, selectedFleetTypeId])

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashRoute()
      setActiveTab(parsed.tab)
      setSelectedFleetTypeId(parsed.fleetTypeId)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Keyboard shortcut Cmd/Ctrl + K for global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Pause polling when browser tab is hidden
  useEffect(() => {
    const onVisibilityChange = () => {
      setIsTabHidden(document.visibilityState === 'hidden')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const updateSettings = useCallback((patch: Partial<ApiSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const triggerFlyTo = useCallback((lat: number, lon: number, zoom: number) => {
    setFlyToTarget({ lat, lon, zoom, nonce: Date.now() })
  }, [])

  // Fetch live ADS-B data
  const loadFlights = useCallback(
    async (manual = false) => {
      if (!manual && Date.now() < backoffUntilRef.current) {
        return
      }
      setIsLoading(true)
      const controller = new AbortController()
      try {
        const result = await fetchLhgFlights({
          settings,
          viewportCenter: viewportRef.current,
          existingFlights: flightsMapRef.current,
          signal: controller.signal,
        })
        const nextMap = new Map<string, LiveFlight>()
        for (const f of result.flights) {
          nextMap.set(f.hex, f)
        }
        flightsMapRef.current = nextMap
        setFlights(result.flights)
        setFeedMeta(result.meta)
        setErrorMessage(result.meta.warning ?? null)
        backoffUntilRef.current = 0
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof AdsbApiError) {
          setErrorMessage(err.message)
          if (err.code === 'API_KEY_REQUIRED') {
            setApiModalProvider(settings.provider)
            setApiModalOpen(true)
          } else if (err.code === 'RATE_LIMITED') {
            backoffUntilRef.current = Date.now() + (err.retryAfterSec ?? 60) * 1000
          }
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unbekannter Fehler beim Abrufen der Flugdaten.'
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [settings]
  )

  // Initial load + interval polling
  useEffect(() => {
    void loadFlights(true)
  }, [loadFlights])

  useEffect(() => {
    if (isPaused || settings.refreshIntervalSec <= 0) return
    if (settings.pauseWhenHidden && isTabHidden) return

    const id = window.setInterval(() => {
      void loadFlights(false)
    }, settings.refreshIntervalSec * 1000)

    return () => window.clearInterval(id)
  }, [isPaused, settings.refreshIntervalSec, settings.pauseWhenHidden, isTabHidden, loadFlights])

  // Enrich selected aircraft (route via adsbdb.com + exact reg photo via Planespotters.net)
  useEffect(() => {
    if (!selectedHex) {
      setEnrichedInfo(null)
      return
    }
    const flight = flightsMapRef.current.get(selectedHex)
    if (!flight) return

    const controller = new AbortController()
    setEnrichedInfo({
      callsign: flight.callsign,
      hex: flight.hex,
      origin: null,
      destination: null,
      routeSource: 'none',
      photoUrl: null,
      photoAuthor: null,
      photoLink: null,
      photoSource: 'none',
      fetchedAt: Date.now(),
      status: 'loading',
    })

    enrichSelectedFlight(flight, controller.signal).then((info) => {
      if (!controller.signal.aborted) {
        setEnrichedInfo(info)
      }
    })

    return () => controller.abort()
  }, [selectedHex])

  // Filtered flights for Radar & Dashboard consistency
  const filteredFlights = useMemo(() => {
    const allowedAirlines = new Set(selectedAirlines)
    return flights.filter((f) => {
      if (!allowedAirlines.has(f.airlineId)) return false
      if (aircraftTypeFilter && f.aircraftTypeId !== aircraftTypeFilter) return false
      if (favoritesOnly) {
        const regFav = Boolean(f.registration && favorites.registrations.includes(f.registration))
        const typeFav = Boolean(
          f.aircraftTypeId && favorites.aircraftTypes.includes(f.aircraftTypeId)
        )
        if (!regFav && !typeFav) return false
      }
      return true
    })
  }, [flights, selectedAirlines, aircraftTypeFilter, favoritesOnly, favorites])

  const handleToggleAirline = useCallback((id: AirlineId) => {
    setSelectedAirlines((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const handleSelectAllAirlines = useCallback(() => {
    setSelectedAirlines(ALL_AIRLINE_IDS)
  }, [])

  const handleSelectOnlyAirline = useCallback((id: AirlineId) => {
    setSelectedAirlines([id])
  }, [])

  const handleFocusFlight = useCallback(
    (flight: LiveFlight) => {
      // Ensure airline is visible when jumping to a flight
      setSelectedAirlines((prev) =>
        prev.includes(flight.airlineId) ? prev : [...prev, flight.airlineId]
      )
      setAircraftTypeFilter(null)
      setFavoritesOnly(false)
      setSelectedHex(flight.hex)
      setActiveTab('radar')
      triggerFlyTo(flight.lat, flight.lon, 8)
    },
    [triggerFlyTo]
  )

  const handleFilterAirlineOnRadar = useCallback((airlineId: AirlineId) => {
    setSelectedAirlines([airlineId])
    setAircraftTypeFilter(null)
    setActiveTab('radar')
  }, [])

  const handleFilterTypeOnRadar = useCallback((typeId: string) => {
    setSelectedAirlines(ALL_AIRLINE_IDS)
    setAircraftTypeFilter(typeId)
    setFavoritesOnly(false)
    setActiveTab('radar')
  }, [])

  const handleOpenFleetType = useCallback((typeId: string) => {
    setFleetAirlineFilter('ALL')
    setSelectedFleetTypeId(typeId)
    setActiveTab('fleet')
  }, [])

  const handleOpenAirlineFleet = useCallback((airlineId: AirlineId) => {
    setFleetAirlineFilter(airlineId)
    setSelectedFleetTypeId(null)
    setActiveTab('fleet')
  }, [])

  const handleToggleFavoriteReg = useCallback((reg: string) => {
    setFavorites((prev) => ({
      ...prev,
      registrations: prev.registrations.includes(reg)
        ? prev.registrations.filter((r) => r !== reg)
        : [...prev.registrations, reg],
    }))
  }, [])

  const handleToggleFavoriteType = useCallback((typeId: string) => {
    setFavorites((prev) => ({
      ...prev,
      aircraftTypes: prev.aircraftTypes.includes(typeId)
        ? prev.aircraftTypes.filter((t) => t !== typeId)
        : [...prev.aircraftTypes, typeId],
    }))
  }, [])

  const handleSaveApiKey = useCallback(
    (provider: 'flyitalyadsb' | 'adsblol-direct', key: string, activateProvider: boolean) => {
      setSettings((prev) => ({
        ...prev,
        ...(provider === 'flyitalyadsb' ? { flyItalyApiKey: key } : { adsbLolApiKey: key }),
        ...(activateProvider ? { provider } : {}),
      }))
    },
    []
  )

  const handleDeleteApiKey = useCallback((provider: 'flyitalyadsb' | 'adsblol-direct') => {
    setSettings((prev) => {
      const next: ApiSettings = {
        ...prev,
        ...(provider === 'flyitalyadsb' ? { flyItalyApiKey: '' } : { adsbLolApiKey: '' }),
      }
      if (provider === 'flyitalyadsb' && prev.provider === 'flyitalyadsb') {
        next.provider = 'adsblol-feed'
      }
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#040B24] dark:text-[#F1F5F9]">
      <HeaderNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSearch={() => setSearchOpen(true)}
        theme={settings.theme}
        onToggleTheme={() =>
          updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
        }
        flightCount={filteredFlights.length}
        isLoading={isLoading}
        hasError={Boolean(errorMessage && flights.length === 0)}
        feedMeta={feedMeta}
      />

      <main>
        {activeTab === 'radar' && (
          <RadarView
            flights={filteredFlights}
            allFlightsCount={flights.length}
            selectedAirlines={selectedAirlines}
            onToggleAirline={handleToggleAirline}
            onSelectAllAirlines={handleSelectAllAirlines}
            onSelectOnlyAirline={handleSelectOnlyAirline}
            aircraftTypeFilter={aircraftTypeFilter}
            onClearAircraftTypeFilter={() => setAircraftTypeFilter(null)}
            favoritesOnly={favoritesOnly}
            onToggleFavoritesOnly={() => setFavoritesOnly((v) => !v)}
            favorites={favorites}
            onToggleFavoriteReg={handleToggleFavoriteReg}
            selectedHex={selectedHex}
            onSelectFlight={(f) => {
              setSelectedHex(f?.hex ?? null)
              if (!f) setFollowSelected(false)
            }}
            enrichedInfo={enrichedInfo}
            followSelected={followSelected}
            onToggleFollow={() => setFollowSelected((v) => !v)}
            settings={settings}
            onUpdateSettings={updateSettings}
            isPaused={isPaused}
            onTogglePaused={() => setIsPaused((v) => !v)}
            isLoading={isLoading}
            errorMessage={errorMessage}
            feedMeta={feedMeta}
            onManualRefresh={() => void loadFlights(true)}
            onOpenApiKeyModal={() => {
              setApiModalProvider(undefined)
              setApiModalOpen(true)
            }}
            onOpenFleetType={handleOpenFleetType}
            flyToTarget={flyToTarget}
            onFlyTo={triggerFlyTo}
            onViewportChange={(vp) => {
              viewportRef.current = vp
            }}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            flights={filteredFlights}
            feedMeta={feedMeta}
            unitSystem={settings.unitSystem}
            onFocusFlight={handleFocusFlight}
            onFilterAirlineOnRadar={handleFilterAirlineOnRadar}
            onOpenFleetType={handleOpenFleetType}
          />
        )}

        {activeTab === 'fleet' && (
          <FleetExplorerView
            key={fleetAirlineFilter}
            flights={flights}
            selectedTypeId={selectedFleetTypeId}
            initialAirlineFilter={fleetAirlineFilter}
            onSelectTypeId={setSelectedFleetTypeId}
            onFilterTypeOnRadar={handleFilterTypeOnRadar}
            favorites={favorites}
            onToggleFavoriteType={handleToggleFavoriteType}
          />
        )}

        {activeTab === 'airlines' && (
          <AirlinesView
            flights={flights}
            onViewAirlineOnRadar={handleFilterAirlineOnRadar}
            onViewAirlineFleet={handleOpenAirlineFleet}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={updateSettings}
            onOpenApiKeyModal={(prov) => {
              setApiModalProvider(prov)
              setApiModalOpen(true)
            }}
            onDeleteKey={handleDeleteApiKey}
            feedMeta={feedMeta}
            errorMessage={errorMessage}
            isLoading={isLoading}
            onManualRefresh={() => void loadFlights(true)}
            favorites={favorites}
            onRemoveFavoriteReg={handleToggleFavoriteReg}
            onRemoveFavoriteType={handleToggleFavoriteType}
          />
        )}
      </main>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        flights={flights}
        onSelectFlight={handleFocusFlight}
        onSelectAircraftType={handleOpenFleetType}
        onSelectAirline={handleFilterAirlineOnRadar}
      />

      <ApiKeyModal
        open={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        settings={settings}
        targetProvider={apiModalProvider}
        onSaveKey={handleSaveApiKey}
        onDeleteKey={handleDeleteApiKey}
      />
    </div>
  )
}
