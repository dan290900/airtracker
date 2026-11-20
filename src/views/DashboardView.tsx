import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Compass,
  Gauge,
  Globe2,
  Info,
  Mountain,
  Plane,
  Radar,
  Search,
} from 'lucide-react'
import { AIRLINE_MAP, AIRLINES } from '../data/airlines'
import { FLEET_MAP } from '../data/fleet'
import type {
  AirlineId,
  FeedSnapshotMeta,
  LiveFlight,
  UnitSystem,
} from '../types/aviation'
import {
  formatAltitude,
  formatHeading,
  formatRelativeTime,
  formatSpeed,
  formatUtcTime,
  getFlightPhase,
} from '../utils/formatters'

interface DashboardViewProps {
  flights: LiveFlight[]
  feedMeta: FeedSnapshotMeta | null
  unitSystem: UnitSystem
  onFocusFlight: (flight: LiveFlight) => void
  onFilterAirlineOnRadar: (airlineId: AirlineId) => void
  onOpenFleetType: (typeId: string) => void
}

type SortKey = 'callsign' | 'airline' | 'altitude' | 'speed' | 'type'

const DONUT_PALETTE = [
  '#05164D',
  '#FFAD00',
  '#0077B6',
  '#C8102E',
  '#A50257',
  '#008B8B',
  '#1D4ED8',
  '#64748B',
]

export function DashboardView({
  flights,
  feedMeta,
  unitSystem,
  onFocusFlight,
  onFilterAirlineOnRadar,
  onOpenFleetType,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [airlineFilter, setAirlineFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('altitude')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)

  // Compute live KPIs strictly from real observed flights
  const stats = useMemo(() => {
    const total = flights.length
    const airborne = flights.filter((f) => !f.onGround)
    const onGround = total - airborne.length

    const altValues = airborne
      .map((f) => f.altBaroFt)
      .filter((v): v is number => v !== null && v > 0)
    const avgAltFt =
      altValues.length > 0
        ? Math.round(altValues.reduce((a, b) => a + b, 0) / altValues.length)
        : null

    const speedValues = airborne
      .map((f) => f.groundSpeedKt)
      .filter((v): v is number => v !== null && v > 0)
    const avgSpeedKt =
      speedValues.length > 0
        ? Math.round(speedValues.reduce((a, b) => a + b, 0) / speedValues.length)
        : null

    // Per airline distribution
    const byAirlineMap = new Map<AirlineId, number>()
    for (const f of flights) {
      byAirlineMap.set(f.airlineId, (byAirlineMap.get(f.airlineId) ?? 0) + 1)
    }
    const byAirline = Array.from(byAirlineMap.entries())
      .map(([airlineId, count]) => ({
        airline: AIRLINE_MAP[airlineId],
        count,
        sharePct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Per aircraft type distribution
    const byTypeMap = new Map<string, { id: string | null; label: string; count: number }>()
    for (const f of flights) {
      const code = f.icaoType ?? 'Unbekannt'
      const spec = f.aircraftTypeId ? FLEET_MAP[f.aircraftTypeId] : null
      const key = spec?.id ?? code
      const existing = byTypeMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        byTypeMap.set(key, {
          id: spec?.id ?? null,
          label: spec ? spec.model : code,
          count: 1,
        })
      }
    }
    const byTypeAll = Array.from(byTypeMap.values()).sort((a, b) => b.count - a.count)
    const topTypes = byTypeAll.slice(0, 7)
    const otherTypesCount = byTypeAll.slice(7).reduce((sum, item) => sum + item.count, 0)
    const donutData =
      otherTypesCount > 0
        ? [...topTypes, { id: null, label: 'Weitere Typen', count: otherTypesCount }]
        : topTypes

    // Geographic region breakdown
    const byRegionMap = new Map<string, number>()
    for (const f of flights) {
      byRegionMap.set(f.region, (byRegionMap.get(f.region) ?? 0) + 1)
    }
    const byRegion = Array.from(byRegionMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)

    // Altitude bands
    const bands = [
      { label: 'Boden / Rollen', count: onGround },
      {
        label: 'Unter FL150 (< 15.000 ft)',
        count: airborne.filter((f) => f.altBaroFt !== null && f.altBaroFt < 15000).length,
      },
      {
        label: 'FL150 – FL300',
        count: airborne.filter(
          (f) => f.altBaroFt !== null && f.altBaroFt >= 15000 && f.altBaroFt < 30000
        ).length,
      },
      {
        label: 'Reiseflug FL300 – FL380',
        count: airborne.filter(
          (f) => f.altBaroFt !== null && f.altBaroFt >= 30000 && f.altBaroFt < 38000
        ).length,
      },
      {
        label: 'Hoher Reiseflug (≥ FL380)',
        count: airborne.filter((f) => f.altBaroFt !== null && f.altBaroFt >= 38000).length,
      },
    ]

    return {
      total,
      airborneCount: airborne.length,
      onGround,
      avgAltFt,
      avgSpeedKt,
      avgSpeedKmh: avgSpeedKt !== null ? Math.round(avgSpeedKt * 1.852) : null,
      activeAirlines: byAirline.length,
      topType: byTypeAll[0] ?? null,
      byAirline,
      donutData,
      byRegion,
      bands,
      uniqueTypes: byTypeAll.map((t) => t.label),
    }
  }, [flights])

  // Filtered & sorted table rows
  const filteredFlights = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = flights.filter((f) => {
      if (airlineFilter !== 'ALL' && f.airlineId !== airlineFilter) return false
      if (typeFilter !== 'ALL') {
        const spec = f.aircraftTypeId ? FLEET_MAP[f.aircraftTypeId] : null
        const label = spec ? spec.model : f.icaoType ?? 'Unbekannt'
        if (label !== typeFilter) return false
      }
      if (!q) return true
      const airline = AIRLINE_MAP[f.airlineId]
      return (
        f.callsign.toLowerCase().includes(q) ||
        (f.flightNumber && f.flightNumber.toLowerCase().includes(q)) ||
        (f.registration && f.registration.toLowerCase().includes(q)) ||
        (f.icaoType && f.icaoType.toLowerCase().includes(q)) ||
        airline.name.toLowerCase().includes(q)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'callsign':
          return a.callsign.localeCompare(b.callsign) * dir
        case 'airline':
          return AIRLINE_MAP[a.airlineId].shortName.localeCompare(
            AIRLINE_MAP[b.airlineId].shortName
          ) * dir
        case 'type':
          return (a.icaoType ?? '').localeCompare(b.icaoType ?? '') * dir
        case 'speed':
          return ((a.groundSpeedKt ?? -1) - (b.groundSpeedKt ?? -1)) * dir
        case 'altitude':
        default:
          return ((a.altBaroFt ?? -1) - (b.altBaroFt ?? -1)) * dir
      }
    })
  }, [flights, searchQuery, airlineFilter, typeFilter, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'callsign' || key === 'airline' || key === 'type' ? 'asc' : 'desc')
    }
  }

  const renderSortIcon = (col: SortKey) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-[#FFAD00]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#FFAD00]" />
    )
  }

  // Donut SVG geometry (pure cumulative calculation)
  const donutSegments = useMemo(() => {
    const total = stats.donutData.reduce((s, d) => s + d.count, 0)
    if (total === 0) return []
    const radius = 64
    const circumference = 2 * Math.PI * radius
    return stats.donutData.map((item, idx) => {
      const prevCount = stats.donutData
        .slice(0, idx)
        .reduce((sum, prev) => sum + prev.count, 0)
      const fraction = item.count / total
      const length = fraction * circumference
      const offset = (prevCount / total) * circumference
      return {
        ...item,
        color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
        pct: Math.round(fraction * 1000) / 10,
        dashArray: `${Math.max(0, length - 1.5)} ${circumference}`,
        dashOffset: -offset,
      }
    })
  }, [stats.donutData])

  const maxAirlineCount = stats.byAirline[0]?.count ?? 1

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 pt-5 pb-24 sm:px-6 md:pb-10">
      {/* Header & Coverage Transparency Notice */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#05164D] sm:text-3xl dark:text-white">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Echtzeit-Auswertung aller aktuell beobachteten Lufthansa-Group-Flüge aus der aktiven ADS-B-Datenquelle.
          </p>
        </div>

        {feedMeta && (
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FFAD00]" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {feedMeta.providerLabel} · Stand {formatUtcTime(feedMeta.snapshotGeneratedAtMs ?? feedMeta.fetchedAtMs)}{' '}
                <span className="font-normal text-slate-500">
                  ({formatRelativeTime(feedMeta.snapshotGeneratedAtMs ?? feedMeta.fetchedAtMs)})
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Abdeckung: {feedMeta.coverageDescription}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Beobachtet</span>
            <Radar className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#05164D] dark:text-white">
            {stats.total}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.airborneCount} in der Luft · {stats.onGround} am Boden
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Aktive Airlines</span>
            <Globe2 className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#05164D] dark:text-white">
            {stats.activeAirlines}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            von {AIRLINES.filter((a) => a.status === 'active').length} aktiven Konzern-Airlines
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Ø Flughöhe</span>
            <Mountain className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-[#05164D] dark:text-white">
            {formatAltitude(stats.avgAltFt, false, unitSystem)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Berechnet (nur Flüge in der Luft)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Ø Geschwindigkeit</span>
            <Gauge className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 font-mono text-xl font-extrabold text-[#05164D] dark:text-white">
            {formatSpeed(stats.avgSpeedKt, stats.avgSpeedKmh, unitSystem)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Ground Speed (in der Luft)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Häufigster Typ</span>
            <Plane className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 truncate font-mono text-xl font-extrabold text-[#05164D] dark:text-white">
            {stats.topType?.label ?? '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.topType ? `${stats.topType.count} beobachtete Flugzeuge` : 'Keine Daten'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Top-Region</span>
            <Compass className="h-4 w-4 text-[#05164D] dark:text-[#FFAD00]" />
          </div>
          <div className="mt-2 truncate text-base font-extrabold text-[#05164D] dark:text-white">
            {stats.byRegion[0]?.region ?? '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.byRegion[0] ? `${stats.byRegion[0].count} Flugzeuge` : 'Keine Daten'}
          </div>
        </div>
      </div>

      {/* Charts Row: Bar Chart (Airlines) + Donut Chart (Aircraft Types) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Horizontal Bar Chart: Flights per Airline */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-7 dark:border-white/10 dark:bg-[#0A163D]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#05164D] dark:text-white">
                Beobachtete Flüge pro Airline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Klick auf eine Airline filtert das Live-Radar direkt auf diese Gesellschaft
              </p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Σ {stats.total}
            </span>
          </div>

          {stats.byAirline.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Keine Flüge im aktuellen Datensatz vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.byAirline.map(({ airline, count, sharePct }) => {
                const widthPct = Math.max(4, Math.round((count / maxAirlineCount) * 100))
                return (
                  <button
                    key={airline.id}
                    type="button"
                    onClick={() => onFilterAirlineOnRadar(airline.id)}
                    className="group block w-full text-left focus:outline-none"
                  >
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-slate-800 group-hover:text-[#05164D] dark:text-slate-200 dark:group-hover:text-[#FFAD00]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: airline.brandColor }}
                        />
                        {airline.name}
                        <span className="font-mono text-[10px] text-slate-400">
                          ({airline.icao})
                        </span>
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {count}{' '}
                        <span className="font-normal text-slate-400">({sharePct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: airline.brandColor,
                        }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Donut Chart: Aircraft Type Distribution */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:col-span-5 dark:border-white/10 dark:bg-[#0A163D]">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[#05164D] dark:text-white">
              Verteilung nach Flugzeugtypen
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klick auf einen Typ öffnet die Details im Fleet Explorer
            </p>
          </div>

          {donutSegments.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Keine Typdaten verfügbar.</div>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative h-44 w-44 shrink-0">
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="22"
                    className="text-slate-100 dark:text-white/10"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="80"
                      cy="80"
                      r="64"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={hoveredSlice === seg.label ? 26 : 22}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredSlice(seg.label)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => seg.id && onOpenFleetType(seg.id)}
                    />
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-2xl font-extrabold text-[#05164D] dark:text-white">
                    {hoveredSlice
                      ? donutSegments.find((s) => s.label === hoveredSlice)?.count ?? stats.total
                      : stats.total}
                  </span>
                  <span className="max-w-[90px] truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {hoveredSlice ?? 'Flugzeuge'}
                  </span>
                </div>
              </div>

              <div className="w-full flex-1 space-y-1.5">
                {donutSegments.map((seg) => (
                  <button
                    key={seg.label}
                    type="button"
                    disabled={!seg.id}
                    onMouseEnter={() => setHoveredSlice(seg.label)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    onClick={() => seg.id && onOpenFleetType(seg.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition ${
                      hoveredSlice === seg.label ? 'bg-slate-100 dark:bg-white/10' : ''
                    } ${seg.id ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="flex items-center gap-2 truncate font-medium text-slate-700 dark:text-slate-200">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.label}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {seg.count}{' '}
                      <span className="font-normal text-slate-400">({seg.pct}%)</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Regional & Altitude Profile Row */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <h2 className="mb-3 text-base font-bold text-[#05164D] dark:text-white">
            Geografische Verteilung (beobachtete Regionen)
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {stats.byRegion.map((r) => (
              <div
                key={r.region}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-white/10 dark:bg-[#061030]"
              >
                <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {r.region}
                </span>
                <span className="ml-2 font-mono text-sm font-extrabold text-[#05164D] dark:text-[#FFAD00]">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
          <h2 className="mb-3 text-base font-bold text-[#05164D] dark:text-white">
            Höhenverteilung (Flugflächen)
          </h2>
          <div className="space-y-2.5">
            {stats.bands.map((b) => {
              const pct = stats.total > 0 ? Math.round((b.count / stats.total) * 100) : 0
              return (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{b.label}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {b.count} <span className="font-normal text-slate-400">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#05164D] to-[#1D4ED8] dark:from-[#FFAD00] dark:to-amber-300"
                      style={{ width: `${Math.max(b.count > 0 ? 3 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Searchable Live Flight Table (Desktop) & Card List (Mobile) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-[#05164D] dark:text-white">
              Aktuelle Flugliste ({filteredFlights.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klicken Sie auf einen Flug, um ihn direkt auf der Live-Karte zu fokussieren
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Callsign, Reg, Typ..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-[#05164D] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#040B24] dark:text-white"
              />
            </div>

            <select
              value={airlineFilter}
              onChange={(e) => setAirlineFilter(e.target.value)}
              aria-label="Nach Airline filtern"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#05164D] focus:outline-none dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            >
              <option value="ALL">Alle Airlines</option>
              {AIRLINES.filter((a) => a.status === 'active').map((a) => (
                <option key={a.id} value={a.id}>
                  {a.shortName} ({a.icao})
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Nach Flugzeugtyp filtern"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-[#05164D] focus:outline-none dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            >
              <option value="ALL">Alle Typen</option>
              {stats.uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-white/10 dark:bg-[#061030] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('callsign')}
                    className="inline-flex items-center gap-1 hover:text-[#05164D] dark:hover:text-white"
                  >
                    Callsign / Flug {renderSortIcon('callsign')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('airline')}
                    className="inline-flex items-center gap-1 hover:text-[#05164D] dark:hover:text-white"
                  >
                    Airline {renderSortIcon('airline')}
                  </button>
                </th>
                <th className="px-4 py-3">Registrierung</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('type')}
                    className="inline-flex items-center gap-1 hover:text-[#05164D] dark:hover:text-white"
                  >
                    Flugzeugtyp {renderSortIcon('type')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('altitude')}
                    className="inline-flex items-center gap-1 hover:text-[#05164D] dark:hover:text-white"
                  >
                    Flughöhe {renderSortIcon('altitude')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort('speed')}
                    className="inline-flex items-center gap-1 hover:text-[#05164D] dark:hover:text-white"
                  >
                    Geschwindigkeit {renderSortIcon('speed')}
                  </button>
                </th>
                <th className="px-4 py-3">Kurs</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredFlights.slice(0, 120).map((f) => {
                const airline = AIRLINE_MAP[f.airlineId]
                const spec = f.aircraftTypeId ? FLEET_MAP[f.aircraftTypeId] : null
                const phase = getFlightPhase(f.altBaroFt, f.verticalRateFpm, f.onGround)
                return (
                  <tr
                    key={f.hex}
                    onClick={() => onFocusFlight(f)}
                    className="cursor-pointer transition hover:bg-blue-50/60 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[#05164D] dark:text-white">
                          {f.callsign}
                        </span>
                        {f.flightNumber && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {f.flightNumber}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: airline.brandColor }}
                        />
                        {airline.shortName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                      {f.registration ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {spec?.model ?? f.icaoType ?? 'Nicht verfügbar'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900 dark:text-white">
                      {formatAltitude(f.altBaroFt, f.onGround, unitSystem)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                      {formatSpeed(f.groundSpeedKt, f.groundSpeedKmh, unitSystem)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                      {formatHeading(f.trackDeg)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${phase.colorClass}`}
                      >
                        {phase.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{f.region}</td>
                  </tr>
                )
              })}
              {filteredFlights.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    Keine Flüge entsprechen den Filterkriterien.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (replaces wide table on phones) */}
        <div className="divide-y divide-slate-100 md:hidden dark:divide-white/10">
          {filteredFlights.slice(0, 60).map((f) => {
            const airline = AIRLINE_MAP[f.airlineId]
            const spec = f.aircraftTypeId ? FLEET_MAP[f.aircraftTypeId] : null
            const phase = getFlightPhase(f.altBaroFt, f.verticalRateFpm, f.onGround)
            return (
              <button
                key={f.hex}
                type="button"
                onClick={() => onFocusFlight(f)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition active:bg-slate-50 dark:active:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: airline.brandColor }}
                    />
                    <span className="font-mono text-sm font-bold text-[#05164D] dark:text-white">
                      {f.callsign}
                    </span>
                    {f.registration && (
                      <span className="font-mono text-xs text-slate-500">{f.registration}</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {airline.shortName} · {spec?.model ?? f.icaoType ?? 'Typ unbekannt'} · {f.region}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {formatAltitude(f.altBaroFt, f.onGround, unitSystem)}
                  </div>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${phase.colorClass}`}
                  >
                    {phase.label}
                  </span>
                </div>
              </button>
            )
          })}
          {filteredFlights.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">
              Keine Flüge entsprechen den Filterkriterien.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
