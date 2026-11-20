import { useMemo, useState } from 'react'
import {
  Compass,
  Gauge,
  Plane,
  Radar,
  Ruler,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react'
import { AIRLINE_MAP, AIRLINES } from '../data/airlines'
import { FLEET_MAP, FLEET_TYPES, getBestPhotoForAircraft } from '../data/fleet'
import type {
  AircraftCategory,
  AircraftTypeSpec,
  AirlineId,
  FavoritesState,
  LiveFlight,
} from '../types/aviation'
import { AircraftImage } from '../components/AircraftImage'

interface FleetExplorerViewProps {
  flights: LiveFlight[]
  selectedTypeId: string | null
  initialAirlineFilter: AirlineId | 'ALL'
  onSelectTypeId: (typeId: string | null) => void
  onFilterTypeOnRadar: (typeId: string) => void
  favorites: FavoritesState
  onToggleFavoriteType: (typeId: string) => void
}

const CATEGORY_LABELS: Record<AircraftCategory | 'ALL', string> = {
  ALL: 'Alle Klassen',
  widebody: 'Langstrecke (Widebody)',
  narrowbody: 'Kurz- & Mittelstrecke',
  regional: 'Regionaljets',
  freighter: 'Frachter (Cargo)',
}

export function FleetExplorerView({
  flights,
  selectedTypeId,
  initialAirlineFilter,
  onSelectTypeId,
  onFilterTypeOnRadar,
  favorites,
  onToggleFavoriteType,
}: FleetExplorerViewProps) {
  const [airlineFilter, setAirlineFilter] = useState<AirlineId | 'ALL'>(initialAirlineFilter)
  const [categoryFilter, setCategoryFilter] = useState<AircraftCategory | 'ALL'>('ALL')
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('ALL')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  // Live observed count per Fleet Explorer aircraftTypeId
  const liveCountByType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const f of flights) {
      if (f.aircraftTypeId) {
        map[f.aircraftTypeId] = (map[f.aircraftTypeId] ?? 0) + 1
      }
    }
    return map
  }, [flights])

  const filteredFleet = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FLEET_TYPES.filter((spec) => {
      if (
        airlineFilter !== 'ALL' &&
        !spec.operatingAirlines.some((op) => op.airlineId === airlineFilter)
      ) {
        return false
      }
      if (categoryFilter !== 'ALL' && spec.category !== categoryFilter) return false
      if (manufacturerFilter !== 'ALL' && spec.manufacturer !== manufacturerFilter) return false
      if (favoritesOnly && !favorites.aircraftTypes.includes(spec.id)) return false
      if (!q) return true
      return (
        spec.fullName.toLowerCase().includes(q) ||
        spec.family.toLowerCase().includes(q) ||
        spec.manufacturer.toLowerCase().includes(q) ||
        spec.icaoCodes.some((c) => c.toLowerCase().includes(q)) ||
        spec.role.toLowerCase().includes(q)
      )
    })
  }, [airlineFilter, categoryFilter, manufacturerFilter, favoritesOnly, favorites.aircraftTypes, search])

  const activeSpec: AircraftTypeSpec | null = selectedTypeId ? FLEET_MAP[selectedTypeId] ?? null : null

  const activePhotos = useMemo(() => {
    if (!activeSpec) return []
    return [activeSpec.photo, ...(activeSpec.gallery ?? [])]
  }, [activeSpec])

  const totalGroupInService = (spec: AircraftTypeSpec) =>
    spec.operatingAirlines.reduce((sum, op) => sum + op.inService, 0)

  const totalGroupOrders = (spec: AircraftTypeSpec) =>
    spec.operatingAirlines.reduce((sum, op) => sum + (op.orders ?? 0), 0)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 pt-5 pb-24 sm:px-6 md:pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#05164D] sm:text-3xl dark:text-white">
            Fleet Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Alle Flugzeugmuster der Lufthansa Group mit technischen Daten, aktuellen Flottenbeständen (Stand 2026) und lizenzierter Luftfahrtfotografie.
          </p>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche z. B. A350, 747-8, Embraer..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 shadow-sm focus:border-[#05164D] focus:outline-none dark:border-white/15 dark:bg-[#0A163D] dark:text-white"
          />
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        {/* Airline Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAirlineFilter('ALL')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              airlineFilter === 'ALL'
                ? 'bg-[#05164D] text-white dark:bg-[#FFAD00] dark:text-[#05164D]'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200'
            }`}
          >
            Alle Airlines ({FLEET_TYPES.length} Typen)
          </button>
          {AIRLINES.map((airline) => {
            const active = airlineFilter === airline.id
            return (
              <button
                key={airline.id}
                type="button"
                onClick={() => setAirlineFilter(airline.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#05164D] text-white dark:bg-[#FFAD00] dark:text-[#05164D]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? '#FFAD00' : airline.brandColor }}
                />
                {airline.shortName}
              </button>
            )
          })}
        </div>

        {/* Category + Manufacturer + Favorites Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(CATEGORY_LABELS) as Array<AircraftCategory | 'ALL'>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-[#05164D]/10 text-[#05164D] dark:bg-[#FFAD00]/20 dark:text-[#FFAD00]'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={manufacturerFilter}
              onChange={(e) => setManufacturerFilter(e.target.value)}
              aria-label="Hersteller filtern"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            >
              <option value="ALL">Alle Hersteller</option>
              <option value="Airbus">Airbus</option>
              <option value="Boeing">Boeing</option>
              <option value="Embraer">Embraer</option>
              <option value="Bombardier">Bombardier</option>
            </select>

            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                favoritesOnly
                  ? 'border-[#FFAD00] bg-[#FFAD00] text-[#05164D]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300'
              }`}
            >
              <Star className="h-3.5 w-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} />
              Favoriten
            </button>
          </div>
        </div>
      </div>

      {/* Aircraft Gallery Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredFleet.map((spec) => {
          const photo = getBestPhotoForAircraft(
            spec,
            airlineFilter !== 'ALL' ? airlineFilter : undefined
          )
          const liveCount = liveCountByType[spec.id] ?? 0
          const inService = totalGroupInService(spec)
          const isFav = favorites.aircraftTypes.includes(spec.id)

          return (
            <article
              key={spec.id}
              onClick={() => {
                setActivePhotoIndex(0)
                onSelectTypeId(spec.id)
              }}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-[#0A163D]"
            >
              <div className="relative">
                <AircraftImage
                  src={photo.url}
                  alt={spec.fullName}
                  caption={photo.caption}
                  author={photo.author}
                  license={photo.license}
                  sourceUrl={photo.pageUrl}
                  aspectClass="aspect-[16/10]"
                />
                {/* Top-left ICAO Badge & Live Count */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="rounded-lg bg-[#05164D]/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
                    {spec.icaoCodes[0]}
                  </span>
                  {liveCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/92 px-2 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
                      {liveCount} live
                    </span>
                  )}
                </div>

                {/* Top-right Favorite Star */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavoriteType(spec.id)
                  }}
                  aria-label={`${spec.fullName} als Favorit markieren`}
                  className={`absolute top-2.5 right-2.5 rounded-lg p-1.5 backdrop-blur-sm transition ${
                    isFav
                      ? 'bg-[#FFAD00] text-[#05164D]'
                      : 'bg-black/40 text-white hover:bg-black/65'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {spec.manufacturer} · {CATEGORY_LABELS[spec.category]}
                </div>
                <h2 className="mt-0.5 text-lg font-extrabold text-[#05164D] transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-[#FFAD00]">
                  {spec.fullName}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {spec.role}
                </p>

                {/* Quick Specs Strip */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center dark:bg-[#061030]">
                  <div>
                    <div className="text-[10px] text-slate-400">Flotte</div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {inService > 0 ? `${inService} aktiv` : 'Bestellt'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Reichweite</div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {spec.rangeKm.toLocaleString('de-DE')} km
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Sitze</div>
                    <div className="truncate font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {spec.typicalSeats.split(' ')[0]}
                    </div>
                  </div>
                </div>

                {/* Operator Airline Chips */}
                <div className="mt-3 flex flex-wrap gap-1 pt-1">
                  {spec.operatingAirlines.map((op) => {
                    const al = AIRLINE_MAP[op.airlineId]
                    return (
                      <span
                        key={op.airlineId}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:text-slate-300"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: al.brandColor }}
                        />
                        {al.shortName}
                        {op.inService > 0 && (
                          <span className="font-mono text-slate-400">{op.inService}</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filteredFleet.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center dark:border-white/10 dark:bg-[#0A163D]">
          <Plane className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Keine Flugzeugtypen für diese Filterauswahl gefunden.
          </p>
        </div>
      )}

      {/* Aircraft Detail Modal */}
      {activeSpec && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040B24]/75 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => onSelectTypeId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0A163D]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero Image + Gallery Switcher */}
            <div className="relative">
              <AircraftImage
                src={activePhotos[activePhotoIndex]?.url ?? activeSpec.photo.url}
                alt={activeSpec.fullName}
                caption={activePhotos[activePhotoIndex]?.caption}
                author={activePhotos[activePhotoIndex]?.author}
                license={activePhotos[activePhotoIndex]?.license}
                sourceUrl={activePhotos[activePhotoIndex]?.pageUrl}
                aspectClass="aspect-[16/9] sm:aspect-[21/10]"
              />
              <button
                type="button"
                onClick={() => onSelectTypeId(null)}
                aria-label="Detailansicht schließen"
                className="absolute top-3 right-3 rounded-xl bg-[#040B24]/75 p-2 text-white backdrop-blur-sm transition hover:bg-[#040B24]"
              >
                <X className="h-5 w-5" />
              </button>

              {activePhotos.length > 1 && (
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {activePhotos.map((ph, idx) => (
                    <button
                      key={ph.url}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition ${
                        idx === activePhotoIndex
                          ? 'bg-[#FFAD00] text-[#05164D]'
                          : 'bg-black/50 text-white hover:bg-black/75'
                      }`}
                    >
                      {AIRLINE_MAP[ph.airlineId].shortName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              {/* Title + CTA Row */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#05164D] px-2.5 py-0.5 font-mono text-xs font-bold text-white dark:bg-[#FFAD00] dark:text-[#05164D]">
                      ICAO {activeSpec.icaoCodes.join(' / ')}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {activeSpec.family} · {CATEGORY_LABELS[activeSpec.category]}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-2xl font-extrabold text-[#05164D] dark:text-white">
                    {activeSpec.fullName}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {activeSpec.summary}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleFavoriteType(activeSpec.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${
                      favorites.aircraftTypes.includes(activeSpec.id)
                        ? 'border-[#FFAD00] bg-[#FFAD00] text-[#05164D]'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={favorites.aircraftTypes.includes(activeSpec.id) ? 'currentColor' : 'none'}
                    />
                    Favorit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTypeId(null)
                      onFilterTypeOnRadar(activeSpec.id)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#05164D] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0B226B] dark:bg-[#FFAD00] dark:text-[#05164D] dark:hover:bg-[#E59B00]"
                  >
                    <Radar className="h-4 w-4" />
                    Auf Live-Radar filtern ({liveCountByType[activeSpec.id] ?? 0} aktiv)
                  </button>
                </div>
              </div>

              {/* Technical Datasheet */}
              <div>
                <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Technische Daten (Referenzwerte)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-[#061030]">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Users className="h-3.5 w-3.5 text-[#FFAD00]" /> Sitzplatzkapazität
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {activeSpec.typicalSeats}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-[#061030]">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Compass className="h-3.5 w-3.5 text-[#FFAD00]" /> Reichweite
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {activeSpec.rangeKm.toLocaleString('de-DE')} km
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-[#061030]">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Gauge className="h-3.5 w-3.5 text-[#FFAD00]" /> Reisegeschwindigkeit
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {activeSpec.cruiseSpeedKmh} km/h ({activeSpec.cruiseMach})
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-[#061030]">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Ruler className="h-3.5 w-3.5 text-[#FFAD00]" /> Länge × Spannweite
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {activeSpec.lengthM} m × {activeSpec.wingspanM} m
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/70 px-3.5 py-2.5 text-xs dark:border-white/10">
                    <span className="text-slate-500">Triebwerke ({activeSpec.engineCount}×): </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {activeSpec.engines}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 px-3.5 py-2.5 text-xs dark:border-white/10">
                    <span className="text-slate-500">Höhe: </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {activeSpec.heightM} m
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 px-3.5 py-2.5 text-xs dark:border-white/10">
                    <span className="text-slate-500">Einsatzgebiet: </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {activeSpec.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lufthansa Group Airline Allocation Table */}
              <div>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                    Bestand in der Lufthansa Group (Aktiv: {totalGroupInService(activeSpec)}
                    {totalGroupOrders(activeSpec) > 0
                      ? ` · Bestellt: ${totalGroupOrders(activeSpec)}`
                      : ''}
                    )
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Stand: {activeSpec.referenceDate}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
                  {activeSpec.operatingAirlines.map((op) => {
                    const al = AIRLINE_MAP[op.airlineId]
                    return (
                      <div
                        key={op.airlineId}
                        className="flex flex-col justify-between gap-2 bg-white px-4 py-3 sm:flex-row sm:items-center dark:bg-[#061030]"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                            style={{ backgroundColor: al.brandColor }}
                          >
                            {al.iata}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {al.name}
                            </div>
                            {op.notes && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {op.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-[#05164D] dark:bg-white/10 dark:text-white">
                            {op.inService} im Dienst
                          </span>
                          {op.orders && op.orders > 0 && (
                            <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                              +{op.orders} bestellt
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Quellen: {activeSpec.sources.join(' · ')}. Flottenzahlen ändern sich laufend durch Auslieferungen, konzerninterne Transfers und Ausflottungen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
