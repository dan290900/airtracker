import { useMemo } from 'react'
import { ExternalLink, Info, MapPin, Plane, Radar } from 'lucide-react'
import { AIRLINES } from '../data/airlines'
import { FLEET_MAP } from '../data/fleet'
import type { AirlineId, LiveFlight } from '../types/aviation'

interface AirlinesViewProps {
  flights: LiveFlight[]
  onViewAirlineOnRadar: (airlineId: AirlineId) => void
  onViewAirlineFleet: (airlineId: AirlineId) => void
}

export function AirlinesView({
  flights,
  onViewAirlineOnRadar,
  onViewAirlineFleet,
}: AirlinesViewProps) {
  const liveCountByAirline = useMemo(() => {
    const map: Partial<Record<AirlineId, number>> = {}
    for (const f of flights) {
      map[f.airlineId] = (map[f.airlineId] ?? 0) + 1
    }
    return map
  }, [flights])

  const totalFleetApprox = AIRLINES.reduce((s, a) => s + a.fleetCount, 0)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 pt-5 pb-24 sm:px-6 md:pb-12">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#05164D] sm:text-3xl dark:text-white">
            Airlines der Lufthansa Group
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Übersicht aller unterstützten Konzern-Fluggesellschaften mit operativen ICAO/IATA-Kennungen, Drehkreuzen und aktuellem Flottenstand (~{totalFleetApprox} Flugzeuge gesamt, Stand 2026).
          </p>
        </div>
      </div>

      {/* Transparency Banner on Codeshares & 2026 Group Structure */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs leading-relaxed text-[#05164D] dark:border-blue-400/20 dark:bg-[#0A163D] dark:text-blue-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#05164D] dark:text-[#FFAD00]" />
        <div className="space-y-1">
          <p>
            <strong>Hinweis zu Codeshares &amp; operativen Kennungen:</strong> ADS-B-Transponder senden das <em>ATC-Callsign des tatsächlich ausführenden Luftfahrtunternehmens</em> (z. B. <code>DLA</code> für Air Dolomiti, <code>LHX</code> für Lufthansa City Airlines oder <code>EWL</code> für Eurowings Europe), auch wenn Tickets unter einer Lufthansa-Codeshare-Nummer (<code>LH</code>) verkauft werden.
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <strong>Konzernstand 2026:</strong> ITA Airways (<code>ITY</code>) ist seit Januar 2025 Teil der Lufthansa Group (Miles &amp; More ab April 2026). Lufthansa CityLine (<code>CLH</code>) hat den regulären Betrieb im April 2026 eingestellt und wurde durch Lufthansa City Airlines (<code>LHX</code>) abgelöst.
          </p>
        </div>
      </div>

      {/* Airlines Grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {AIRLINES.map((airline) => {
          const liveCount = liveCountByAirline[airline.id] ?? 0
          return (
            <article
              key={airline.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg dark:bg-[#0A163D] ${
                airline.status === 'ceased'
                  ? 'border-slate-200/70 opacity-85 dark:border-white/10'
                  : 'border-slate-200/90 dark:border-white/10'
              }`}
            >
              {/* Brand Color Top Bar */}
              <div
                className="h-2 w-full"
                style={{
                  background: `linear-gradient(90deg, ${airline.brandColor}, ${airline.secondaryColor})`,
                }}
              />

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-base font-extrabold text-white shadow-sm"
                      style={{ backgroundColor: airline.brandColor }}
                    >
                      {airline.iata}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#05164D] dark:text-white">
                        {airline.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <span>ICAO: {airline.icao}</span>
                        <span>·</span>
                        <span>Callsign: {airline.telephony}</span>
                      </div>
                    </div>
                  </div>

                  {airline.status === 'ceased' ? (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      Eingestellt 2026
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {liveCount} live
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {airline.description}
                </p>

                {airline.statusNote && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    {airline.statusNote}
                  </p>
                )}

                {/* Metadata Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3 text-xs dark:bg-[#061030]">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="h-3 w-3" /> Drehkreuze / Basen
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                      {airline.hubs.join(', ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Flottengröße (Referenz)</div>
                    <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                      {airline.fleetCount > 0 ? `~${airline.fleetCount} Flugzeuge` : '0 (ausgeflottet)'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-slate-400">Konzernzugehörigkeit</div>
                    <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                      {airline.groupAffiliation}
                    </div>
                  </div>
                </div>

                {/* Aircraft Type Chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {airline.aircraftTypeIds.map((typeId) => {
                    const spec = FLEET_MAP[typeId]
                    return (
                      <span
                        key={typeId}
                        className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300"
                      >
                        {spec?.model ?? typeId}
                      </span>
                    )
                  })}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3.5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => onViewAirlineOnRadar(airline.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#05164D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0B226B] dark:bg-[#FFAD00] dark:text-[#05164D] dark:hover:bg-[#E59B00]"
                  >
                    <Radar className="h-3.5 w-3.5" /> Auf Radar ({liveCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewAirlineFleet(airline.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  >
                    <Plane className="h-3.5 w-3.5" /> Flotte ansehen
                  </button>
                  <a
                    href={airline.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${airline.name} Website`}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/15 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
