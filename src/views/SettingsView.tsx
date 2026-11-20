import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Star,
  Trash2,
  Wifi,
} from 'lucide-react'
import { FLEET_MAP } from '../data/fleet'
import { PROVIDER_CATALOG } from '../services/adsbClient'
import { maskApiKey } from '../services/storage'
import type {
  ApiSettings,
  FavoritesState,
  FeedSnapshotMeta,
  ProviderId,
} from '../types/aviation'
import { formatRelativeTime, formatUtcTime } from '../utils/formatters'

interface SettingsViewProps {
  settings: ApiSettings
  onUpdateSettings: (patch: Partial<ApiSettings>) => void
  onOpenApiKeyModal: (provider?: ProviderId) => void
  onDeleteKey: (provider: 'flyitalyadsb' | 'adsblol-direct') => void
  feedMeta: FeedSnapshotMeta | null
  errorMessage: string | null
  isLoading: boolean
  onManualRefresh: () => void
  favorites: FavoritesState
  onRemoveFavoriteReg: (reg: string) => void
  onRemoveFavoriteType: (typeId: string) => void
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onOpenApiKeyModal,
  onDeleteKey,
  feedMeta,
  errorMessage,
  isLoading,
  onManualRefresh,
  favorites,
  onRemoveFavoriteReg,
  onRemoveFavoriteType,
}: SettingsViewProps) {
  const [relayDraft, setRelayDraft] = useState(settings.customRelayUrl)
  const [relaySaved, setRelaySaved] = useState(false)

  const handleSaveRelay = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanUrl = relayDraft.trim()
    const patch: Partial<ApiSettings> = { customRelayUrl: cleanUrl }
    if (cleanUrl && settings.provider !== 'adsbfi-relay') {
      patch.provider = 'adsblol-direct'
    }
    onUpdateSettings(patch)
    setRelaySaved(true)
    setTimeout(() => setRelaySaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-5 pb-24 sm:px-6 md:pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#05164D] sm:text-3xl dark:text-white">
          API &amp; Einstellungen
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Datenquellen-Konfiguration, lokale API-Schlüssel-Verwaltung, Kontingentstatus und Anzeigeeinstellungen.
        </p>
      </div>

      {/* Live Connection Status Summary */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                errorMessage
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              }`}
            >
              {errorMessage ? <AlertCircle className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {feedMeta?.providerLabel ?? 'Verbindung wird initialisiert…'}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    errorMessage
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}
                >
                  {errorMessage ? 'Fehler / Eingriff nötig' : 'Verbunden'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Letzter erfolgreicher Abruf:{' '}
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                  {formatUtcTime(feedMeta?.fetchedAtMs)}
                </span>{' '}
                ({formatRelativeTime(feedMeta?.fetchedAtMs)})
                {feedMeta?.snapshotGeneratedAtMs &&
                  feedMeta.snapshotGeneratedAtMs !== feedMeta.fetchedAtMs && (
                    <>
                      {' '}
                      · Datenstand:{' '}
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {formatUtcTime(feedMeta.snapshotGeneratedAtMs)}
                      </span>
                    </>
                  )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onManualRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#05164D] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0B226B] disabled:opacity-50 dark:bg-[#FFAD00] dark:text-[#05164D]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Verbindung testen &amp; abrufen
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <strong>Fehlerstatus:</strong> {errorMessage}
          </div>
        )}

        {/* API Quota Details (if returned by provider headers) */}
        {feedMeta?.quota && (
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3.5 text-xs sm:grid-cols-3 dark:bg-[#061030]">
            {feedMeta.quota.plan && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Tarif</div>
                <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                  {feedMeta.quota.plan}
                </div>
              </div>
            )}
            {feedMeta.quota.remaining !== undefined && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Verbleibendes Kontingent</div>
                <div className="mt-0.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {feedMeta.quota.remaining.toLocaleString('de-DE')}
                  {feedMeta.quota.monthlyQuota
                    ? ` / ${feedMeta.quota.monthlyQuota.toLocaleString('de-DE')} (Monat)`
                    : feedMeta.quota.limit
                      ? ` / ${feedMeta.quota.limit.toLocaleString('de-DE')} (Tag)`
                      : ''}
                </div>
              </div>
            )}
            {feedMeta.quota.resetLabel && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Limit-Reset</div>
                <div className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                  {feedMeta.quota.resetLabel}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Provider Selection */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <h2 className="text-base font-bold text-[#05164D] dark:text-white">
          ADS-B Datenanbieter wählen
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Da GitHub Pages rein statisch ohne eigenes Backend arbeitet, bestimmen die CORS-Header des jeweiligen Anbieters, ob Browser-Anfragen direkt möglich sind.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PROVIDER_CATALOG.map((p) => {
            const active = settings.provider === p.id
            return (
              <div
                key={p.id}
                onClick={() => onUpdateSettings({ provider: p.id })}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  active
                    ? 'border-[#05164D] bg-[#05164D]/[0.04] ring-1 ring-[#05164D] dark:border-[#FFAD00] dark:bg-[#FFAD00]/10 dark:ring-[#FFAD00]'
                    : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.corsInBrowser
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {p.summary}
                </p>
                {p.keyPortalUrl && (
                  <a
                    href={p.keyPortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#05164D] underline decoration-[#FFAD00] underline-offset-2 dark:text-[#FFAD00]"
                  >
                    Offizielle API-Key-Seite öffnen <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Secure Local API-Key Management */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#05164D] dark:text-white">
              <KeyRound className="h-4 w-4 text-[#FFAD00]" />
              Lokale API-Schlüssel-Verwaltung
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Schlüssel werden niemals im Quellcode gespeichert, niemals im Klartext angezeigt und verlassen ausschließlich den direkten API-Request an den gewählten Anbieter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenApiKeyModal()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#05164D] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0B226B] dark:bg-[#FFAD00] dark:text-[#05164D]"
          >
            <KeyRound className="h-3.5 w-3.5" /> API-Key hinzufügen / ändern
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* FlyItalyADSB Key Row */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-[#061030]">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                FlyItalyADSB API-Key
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                {maskApiKey(settings.flyItalyApiKey)}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenApiKeyModal('flyitalyadsb')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {settings.flyItalyApiKey ? 'Ändern' : 'Eintragen'}
              </button>
              {settings.flyItalyApiKey && (
                <button
                  type="button"
                  onClick={() => onDeleteKey('flyitalyadsb')}
                  aria-label="FlyItalyADSB API-Key löschen"
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* adsb.lol Key Row */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-[#061030]">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                adsb.lol API-Key (optional)
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                {maskApiKey(settings.adsbLolApiKey)}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenApiKeyModal('adsblol-direct')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white"
              >
                {settings.adsbLolApiKey ? 'Ändern' : 'Eintragen'}
              </button>
              {settings.adsbLolApiKey && (
                <button
                  type="button"
                  onClick={() => onDeleteKey('adsblol-direct')}
                  aria-label="adsb.lol API-Key löschen"
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Optional Custom CORS Relay URL */}
        <form onSubmit={handleSaveRelay} className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
          <label
            htmlFor="custom-relay-url"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Optionale eigene CORS-Relay-URL (nur für „adsb.lol Direkt“ oder „adsb.fi Relay“)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="custom-relay-url"
              type="url"
              value={relayDraft}
              onChange={(e) => setRelayDraft(e.target.value)}
              placeholder="https://lhg-adsb-relay.deinname.workers.dev"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-[#05164D] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:border-white/15 dark:bg-white/10 dark:text-white"
            >
              {relaySaved ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Gespeichert
                </>
              ) : (
                'Relay speichern'
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Für echtes 20-Sekunden-Weltweit-Tracking mit <code className="font-mono">adsb.lol</code> liegt der fertige, kostenlose Cloudflare Worker direkt im Repo:{' '}
            <a
              href="https://github.com/dan290900/airtracker/tree/main/cloudflare-worker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold text-[#05164D] underline decoration-[#FFAD00] underline-offset-2 dark:text-[#FFAD00]"
            >
              cloudflare-worker Anleitung &amp; Code <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </form>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/75 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            <strong>Sicherheitshinweis:</strong> Gespeicherte API-Schlüssel verbleiben ausschließlich im{' '}
            <code>localStorage</code> dieses Browsers. Bei kompromittierten Browser-Erweiterungen oder schädlichem JavaScript könnten Einträge im{' '}
            <code>localStorage</code> ausgelesen werden. Verwenden Sie daher ausschließlich kostenlose oder limitierte Schlüssel ohne Zahlungsdaten.
          </p>
        </div>
      </section>

      {/* Polling & Display Preferences */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <h2 className="mb-4 text-base font-bold text-[#05164D] dark:text-white">
          Aktualisierung &amp; Darstellung
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="refresh-interval-select"
              className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Aktualisierungsintervall
            </label>
            <select
              id="refresh-interval-select"
              value={settings.refreshIntervalSec}
              onChange={(e) => onUpdateSettings({ refreshIntervalSec: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            >
              <option value={15}>Alle 15 Sekunden (Live Direct)</option>
              <option value={30}>Alle 30 Sekunden (Empfohlen)</option>
              <option value={60}>Alle 60 Sekunden (Datensparend)</option>
              <option value={180}>Alle 3 Minuten</option>
              <option value={0}>Nur manuell</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="unit-system-select"
              className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Einheitensystem
            </label>
            <select
              id="unit-system-select"
              value={settings.unitSystem}
              onChange={(e) =>
                onUpdateSettings({
                  unitSystem: e.target.value === 'metric' ? 'metric' : 'aviation',
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 dark:border-white/15 dark:bg-[#040B24] dark:text-white"
            >
              <option value="aviation">Luftfahrt-Standard (ft, kt, ft/min)</option>
              <option value="metric">Metrisch (m, km/h, m/s)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-xs dark:border-white/10">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              API-Abrufe bei inaktivem Browser-Tab automatisch pausieren (spart Rate-Limit)
            </span>
            <input
              type="checkbox"
              checked={settings.pauseWhenHidden}
              onChange={(e) => onUpdateSettings({ pauseWhenHidden: e.target.checked })}
              className="h-4 w-4 accent-[#05164D]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Überwachte Abdeckungsradien auf der Karte anzeigen
            </span>
            <input
              type="checkbox"
              checked={settings.showCoverageOverlay}
              onChange={(e) => onUpdateSettings({ showCoverageOverlay: e.target.checked })}
              className="h-4 w-4 accent-[#05164D]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Callsign-Labels dauerhaft an Flugzeugmarkern einblenden
            </span>
            <input
              type="checkbox"
              checked={settings.showLabels}
              onChange={(e) => onUpdateSettings({ showLabels: e.target.checked })}
              className="h-4 w-4 accent-[#05164D]"
            />
          </label>
        </div>
      </section>

      {/* Saved Favorites */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0A163D]">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#05164D] dark:text-white">
          <Star className="h-4 w-4 text-[#FFAD00]" />
          Gespeicherte Favoriten (lokal im Browser)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              Flugzeugregistrierungen ({favorites.registrations.length})
            </div>
            {favorites.registrations.length === 0 ? (
              <p className="text-xs text-slate-400">
                Noch keine Registrierungen favorisiert (Stern-Symbol in den Flugzeugdetails).
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {favorites.registrations.map((reg) => (
                  <span
                    key={reg}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:border-white/15 dark:bg-[#061030] dark:text-white"
                  >
                    {reg}
                    <button
                      type="button"
                      onClick={() => onRemoveFavoriteReg(reg)}
                      className="text-slate-400 hover:text-rose-500"
                      aria-label={`${reg} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              Flugzeugtypen ({favorites.aircraftTypes.length})
            </div>
            {favorites.aircraftTypes.length === 0 ? (
              <p className="text-xs text-slate-400">
                Noch keine Flugzeugtypen im Fleet Explorer favorisiert.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {favorites.aircraftTypes.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-white/15 dark:bg-[#061030] dark:text-white"
                  >
                    {FLEET_MAP[id]?.fullName ?? id}
                    <button
                      type="button"
                      onClick={() => onRemoveFavoriteType(id)}
                      className="text-slate-400 hover:text-rose-500"
                      aria-label={`${id} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Attribution & Disclaimer Footer */}
      <footer className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-500 dark:border-white/10 dark:bg-[#061030] dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          Unabhängiges, inoffizielles Luftfahrtprojekt
        </p>
        <p className="mt-1">
          Diese Webanwendung steht in keiner geschäftlichen oder offiziellen Verbindung zur Deutschen Lufthansa AG oder ihren Tochtergesellschaften. Alle Markennamen dienen ausschließlich der sachlichen Beschreibung.
        </p>
        <p className="mt-1">
          <strong>Datenquellen &amp; Lizenzen:</strong> Live-ADS-B-Positionen über{' '}
          <a href="https://www.adsb.lol" target="_blank" rel="noopener noreferrer" className="underline">
            adsb.lol (ODbL 1.0)
          </a>{' '}
          bzw. optional{' '}
          <a href="https://flyitalyadsb.com" target="_blank" rel="noopener noreferrer" className="underline">
            FlyItalyADSB (CC BY-SA 4.0)
          </a>
          ; Routeninformationen über{' '}
          <a href="https://www.adsbdb.com" target="_blank" rel="noopener noreferrer" className="underline">
            adsbdb.com
          </a>
          ; Flugzeugfotos über Wikimedia Commons (CC BY / CC BY-SA / GFDL / CC0) und Planespotters.net; Kartenkacheln © OpenStreetMap &amp; CARTO. Nicht für navigatorische oder sicherheitskritische Zwecke geeignet.
        </p>
      </footer>
    </div>
  )
}
