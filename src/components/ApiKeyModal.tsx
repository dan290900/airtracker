import { useState } from 'react'
import { ExternalLink, KeyRound, ShieldAlert, Trash2, X } from 'lucide-react'
import { maskApiKey } from '../services/storage'
import type { ApiSettings, ProviderId } from '../types/aviation'

interface ApiKeyModalProps {
  open: boolean
  onClose: () => void
  settings: ApiSettings
  targetProvider?: ProviderId
  onSaveKey: (provider: 'flyitalyadsb' | 'adsblol-direct', apiKey: string, activateProvider: boolean) => void
  onDeleteKey: (provider: 'flyitalyadsb' | 'adsblol-direct') => void
}

export function ApiKeyModal({
  open,
  onClose,
  settings,
  targetProvider,
  onSaveKey,
  onDeleteKey,
}: ApiKeyModalProps) {
  const initialTab: 'flyitalyadsb' | 'adsblol-direct' =
    targetProvider === 'adsblol-direct' ? 'adsblol-direct' : 'flyitalyadsb'
  const [selected, setSelected] = useState<'flyitalyadsb' | 'adsblol-direct'>(initialTab)
  const [inputKey, setInputKey] = useState('')

  if (!open) return null

  const currentStoredKey =
    selected === 'flyitalyadsb' ? settings.flyItalyApiKey : settings.adsbLolApiKey

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputKey.trim()) return
    onSaveKey(selected, inputKey.trim(), true)
    setInputKey('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040B24]/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0A163D]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#05164D] px-5 py-4 text-white dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFAD00]/20 text-[#FFAD00]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">API-Schlüssel verwalten</h2>
              <p className="text-xs text-blue-200/80">
                Lokale Speicherung im Browser · Kein Backend erforderlich
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Provider Switch */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-[#040B24]">
            <button
              type="button"
              onClick={() => {
                setSelected('flyitalyadsb')
                setInputKey('')
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                selected === 'flyitalyadsb'
                  ? 'bg-white text-[#05164D] shadow-sm dark:bg-[#132561] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              FlyItalyADSB (CORS · Live)
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected('adsblol-direct')
                setInputKey('')
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                selected === 'adsblol-direct'
                  ? 'bg-white text-[#05164D] shadow-sm dark:bg-[#132561] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              adsb.lol (Optional / Relay)
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-white/10 dark:bg-[#061030] dark:text-slate-300">
            {selected === 'flyitalyadsb' ? (
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Direkter Echtzeit-Browser-Modus (CORS-kompatibel)
                </p>
                <p>
                  FlyItalyADSB bietet einen kostenlosen Free-Tarif (300.000 Anfragen/Monat, bis 500 km Radius, CC BY-SA 4.0) mit offenen CORS-Headern für GitHub Pages.
                </p>
                <a
                  href="https://flyitalyadsb.com/en/data/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#05164D] underline decoration-[#FFAD00] underline-offset-2 dark:text-[#FFAD00]"
                >
                  Kostenlosen FlyItalyADSB API-Key anfordern <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">
                  adsb.lol x-api-key (für lokalen Dev-Modus oder eigenen Relay)
                </p>
                <p>
                  Ohne Key bietet adsb.lol 500 Anfragen/Tag pro IP; ein kostenloser Key erhöht das Kontingent auf 1.000–7.200 Anfragen/Tag. Hinweis: Direktaufrufe aus dem Browser blockiert adsb.lol derzeit mangels CORS-Header.
                </p>
                <a
                  href="https://www.adsb.lol/mmb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#05164D] underline decoration-[#FFAD00] underline-offset-2 dark:text-[#FFAD00]"
                >
                  Offizielles adsb.lol Key-Portal öffnen <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Current key status (masked) */}
          {currentStoredKey && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <div>
                <span className="text-emerald-800 dark:text-emerald-300">Gespeicherter Schlüssel: </span>
                <span className="font-mono font-semibold text-emerald-950 dark:text-emerald-200">
                  {maskApiKey(currentStoredKey)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteKey(selected)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-rose-600 transition hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Löschen
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="api-key-modal-input"
                className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {currentStoredKey ? 'Neuen API-Schlüssel ersetzen' : 'API-Schlüssel eingeben'}
              </label>
              <input
                id="api-key-modal-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder={
                  selected === 'flyitalyadsb' ? 'fia_...' : 'adsb.lol x-api-key eingeben...'
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-[#05164D] focus:ring-2 focus:ring-[#05164D]/20 focus:outline-none dark:border-white/15 dark:bg-[#040B24] dark:text-white dark:focus:border-[#FFAD00]"
              />
            </div>

            {/* Mandatory Security Notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p>
                <strong>Sicherheitshinweis:</strong> Der API-Schlüssel wird ausschließlich lokal im{' '}
                <code>localStorage</code> dieses Geräts gespeichert, niemals im Klartext angezeigt und an keine eigenen Server oder Analytics-Dienste übertragen. Hinweis: Daten im{' '}
                <code>localStorage</code> könnten bei kompromittiertem bzw. schädlichem JavaScript (z. B. durch bösartige Browser-Erweiterungen) ausgelesen werden.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Ohne Key fortfahren
              </button>
              <button
                type="submit"
                disabled={!inputKey.trim()}
                className="rounded-xl bg-[#05164D] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0B226B] disabled:opacity-40 dark:bg-[#FFAD00] dark:text-[#05164D] dark:hover:bg-[#E59B00]"
              >
                Lokal speichern &amp; aktivieren
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
