import {
  BarChart3,
  Building2,
  Moon,
  Plane,
  Radar,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import type { FeedSnapshotMeta, NavTab } from '../types/aviation'

interface HeaderNavProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  onOpenSearch: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  flightCount: number
  isLoading: boolean
  hasError: boolean
  feedMeta: FeedSnapshotMeta | null
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; mobileLabel: string; icon: typeof Radar }> = [
  { id: 'radar', label: 'Live Radar', mobileLabel: 'Radar', icon: Radar },
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Ops', icon: BarChart3 },
  { id: 'fleet', label: 'Fleet Explorer', mobileLabel: 'Flotte', icon: Plane },
  { id: 'airlines', label: 'Airlines', mobileLabel: 'Airlines', icon: Building2 },
  { id: 'settings', label: 'Einstellungen', mobileLabel: 'API', icon: Settings },
]

export function HeaderNav({
  activeTab,
  onSelectTab,
  onOpenSearch,
  theme,
  onToggleTheme,
  flightCount,
  isLoading,
  hasError,
  feedMeta,
}: HeaderNavProps) {
  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-slate-200/80 bg-[#05164D] text-white shadow-sm md:h-16 dark:border-white/10 dark:bg-[#040B24]/95 dark:backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-5">
          {/* Brand Mark (Original geometric radar emblem — no trademarked logos) */}
          <button
            type="button"
            onClick={() => onSelectTab('radar')}
            className="group flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-[#FFAD00]/40 transition group-hover:bg-white/15">
              <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" aria-hidden="true">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  stroke="#FFAD00"
                  strokeWidth="1.5"
                  strokeOpacity="0.45"
                  strokeDasharray="3 3"
                />
                <path
                  d="M16 5.5L18 13.3L25.5 15.8V17.9L18 17.2L17.4 23.4L20.6 25.3V26.8L16 25.6L11.4 26.8V25.3L14.6 23.4L14 17.2L6.5 17.9V15.8L14 13.3L16 5.5Z"
                  fill="#FFAD00"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold tracking-tight text-white sm:text-base">
                  Lufthansa Group Radar
                </span>
                <span className="hidden rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-white/80 uppercase xl:inline-block">
                  Inoffiziell
                </span>
              </div>
              <p className="hidden text-[11px] font-medium text-blue-200/75 sm:block">
                Live Flight Tracking &amp; Fleet Explorer
              </p>
            </div>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/14 text-white'
                      : 'text-blue-100/75 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-[#FFAD00]' : 'text-blue-200/70'}`}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-[2.5px] rounded-full bg-[#FFAD00]" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Right Controls: Status Pill, Search, Theme */}
          <div className="flex items-center gap-2">
            {/* Connection / Live Count Status Pill */}
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              title={
                feedMeta
                  ? `${feedMeta.providerLabel} · ${flightCount} beobachtete Flüge`
                  : 'Datenquelle & API-Status öffnen'
              }
              className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition sm:inline-flex ${
                hasError
                  ? 'border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                  : 'border-white/15 bg-white/10 text-blue-50 hover:bg-white/15'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  hasError
                    ? 'bg-rose-400'
                    : isLoading
                      ? 'animate-pulse bg-[#FFAD00]'
                      : feedMeta?.isLiveDirect
                        ? 'bg-emerald-400'
                        : 'bg-[#FFAD00]'
                }`}
              />
              <span className="font-mono text-[11px] font-semibold">
                {flightCount}
              </span>
              <span className="hidden text-blue-100/80 lg:inline">
                {hasError ? 'API-Hinweis' : feedMeta?.isLiveDirect ? 'Live' : 'Feed'}
              </span>
            </button>

            {/* Search Trigger */}
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Globale Suche öffnen"
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-white/18 hover:text-white"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline">Suche</span>
              <kbd className="hidden rounded bg-white/12 px-1.5 py-0.5 font-mono text-[10px] text-blue-100/80 lg:inline">
                ⌘K
              </kbd>
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Helles Design aktivieren' : 'Dark Mode aktivieren'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-blue-100 transition hover:bg-white/18 hover:text-[#FFAD00]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-lg md:hidden dark:border-white/10 dark:bg-[#040B24]/95"
      >
        <div className="grid grid-cols-5 px-1 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
                  isActive
                    ? 'text-[#05164D] dark:text-[#FFAD00]'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <div
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition ${
                    isActive ? 'bg-[#05164D]/10 dark:bg-[#FFAD00]/15' : ''
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span>{item.mobileLabel}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
