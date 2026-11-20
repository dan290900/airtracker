import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Plane, Radar, Search, X } from 'lucide-react'
import { AIRLINE_MAP, AIRLINES } from '../data/airlines'
import { FLEET_TYPES } from '../data/fleet'
import type { AirlineId, LiveFlight } from '../types/aviation'

interface SearchModalProps {
  open: boolean
  onClose: () => void
  flights: LiveFlight[]
  onSelectFlight: (flight: LiveFlight) => void
  onSelectAircraftType: (typeId: string) => void
  onSelectAirline: (airlineId: AirlineId) => void
}

export function SearchModal({
  open,
  onClose,
  flights,
  onSelectFlight,
  onSelectAircraftType,
  onSelectAirline,
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) onClose()
      } else if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const q = query.trim().toLowerCase()

  const matchingFlights = useMemo(() => {
    if (!q) return flights.slice(0, 5)
    return flights
      .filter((f) => {
        const airline = AIRLINE_MAP[f.airlineId]
        return (
          f.callsign.toLowerCase().includes(q) ||
          (f.flightNumber && f.flightNumber.toLowerCase().includes(q)) ||
          (f.registration && f.registration.toLowerCase().includes(q)) ||
          (f.icaoType && f.icaoType.toLowerCase().includes(q)) ||
          airline.name.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [flights, q])

  const matchingFleet = useMemo(() => {
    if (!q) return FLEET_TYPES.slice(0, 4)
    return FLEET_TYPES.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.manufacturer.toLowerCase().includes(q) ||
        t.icaoCodes.some((c) => c.toLowerCase().includes(q))
    ).slice(0, 6)
  }, [q])

  const matchingAirlines = useMemo(() => {
    if (!q) return AIRLINES.slice(0, 4)
    return AIRLINES.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.shortName.toLowerCase().includes(q) ||
        a.icao.toLowerCase().includes(q) ||
        a.iata.toLowerCase().includes(q) ||
        a.hubs.some((h) => h.toLowerCase().includes(q))
    ).slice(0, 5)
  }, [q])

  if (!open) return null

  const hasAny =
    matchingFlights.length > 0 || matchingFleet.length > 0 || matchingAirlines.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#040B24]/65 px-3 pt-16 backdrop-blur-sm sm:pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0A163D]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-white/10">
          <Search className="h-5 w-5 text-[#05164D] dark:text-[#FFAD00]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Callsign (DLH400), Registrierung (D-AIXA), Typ (A350) oder Airline..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white dark:placeholder-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Suche schließen"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[65vh] overflow-y-auto p-3">
          {!hasAny && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Keine Treffer für „{query}“.
            </div>
          )}

          {matchingFlights.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <Radar className="h-3.5 w-3.5" />
                Aktuelle Flüge ({matchingFlights.length})
              </div>
              <div className="space-y-1">
                {matchingFlights.map((flight) => {
                  const airline = AIRLINE_MAP[flight.airlineId]
                  return (
                    <button
                      key={flight.hex}
                      type="button"
                      onClick={() => {
                        onSelectFlight(flight)
                        onClose()
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: airline.brandColor }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                              {flight.callsign}
                            </span>
                            {flight.flightNumber && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                {flight.flightNumber}
                              </span>
                            )}
                            {flight.registration && (
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                {flight.registration}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {airline.shortName} · {flight.icaoType ?? 'Typ unbekannt'} · {flight.region}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-300">
                        {flight.onGround
                          ? 'GND'
                          : flight.altBaroFt !== null
                            ? `${flight.altBaroFt.toLocaleString('de-DE')} ft`
                            : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {matchingFleet.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <Plane className="h-3.5 w-3.5" />
                Fleet Explorer
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {matchingFleet.map((spec) => (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => {
                      onSelectAircraftType(spec.id)
                      onClose()
                    }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {spec.fullName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {spec.manufacturer} · {spec.rangeKm.toLocaleString('de-DE')} km Reichweite
                      </div>
                    </div>
                    <span className="rounded bg-[#05164D]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#05164D] dark:bg-[#FFAD00]/15 dark:text-[#FFAD00]">
                      {spec.icaoCodes[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingAirlines.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <Building2 className="h-3.5 w-3.5" />
                Lufthansa Group Airlines
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {matchingAirlines.map((airline) => (
                  <button
                    key={airline.id}
                    type="button"
                    onClick={() => {
                      onSelectAirline(airline.id)
                      onClose()
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                      style={{ backgroundColor: airline.brandColor }}
                    >
                      {airline.iata}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {airline.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        ICAO {airline.icao} · Hubs: {airline.hubs.join(', ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
