import type { ApiSettings, FavoritesState, ProviderId } from '../types/aviation'

const SETTINGS_KEY = 'lhg_radar_settings_v1'
const FAVORITES_KEY = 'lhg_radar_favorites_v1'

export const DEFAULT_SETTINGS: ApiSettings = {
  provider: 'adsblol-feed',
  flyItalyApiKey: '',
  adsbLolApiKey: '',
  customRelayUrl: '',
  refreshIntervalSec: 30,
  pauseWhenHidden: true,
  unitSystem: 'aviation',
  showCoverageOverlay: false,
  showLabels: false,
  mapStyle: 'auto',
  theme: 'light',
}

export const DEFAULT_FAVORITES: FavoritesState = {
  registrations: [],
  aircraftTypes: [],
}

export function loadSettings(): ApiSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return { ...DEFAULT_SETTINGS, theme: prefersDark ? 'dark' : 'light' }
    }
    const parsed = JSON.parse(raw) as Partial<ApiSettings>
    const validProviders: ProviderId[] = [
      'adsblol-feed',
      'flyitalyadsb',
      'adsblol-direct',
      'adsbfi-relay',
    ]
    const provider: ProviderId =
      parsed.provider && validProviders.includes(parsed.provider)
        ? parsed.provider
        : DEFAULT_SETTINGS.provider

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      provider,
      refreshIntervalSec:
        typeof parsed.refreshIntervalSec === 'number' && parsed.refreshIntervalSec >= 0
          ? parsed.refreshIntervalSec
          : DEFAULT_SETTINGS.refreshIntervalSec,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: ApiSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage quota or private-mode restrictions cleanly
  }
}

export function loadFavorites(): FavoritesState {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    if (!raw) return DEFAULT_FAVORITES
    const parsed = JSON.parse(raw) as Partial<FavoritesState>
    return {
      registrations: Array.isArray(parsed.registrations)
        ? parsed.registrations.filter((x): x is string => typeof x === 'string')
        : [],
      aircraftTypes: Array.isArray(parsed.aircraftTypes)
        ? parsed.aircraftTypes.filter((x): x is string => typeof x === 'string')
        : [],
    }
  } catch {
    return DEFAULT_FAVORITES
  }
}

export function saveFavorites(favorites: FavoritesState): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch {
    // Ignore storage errors
  }
}

/** Mask an API key for UI display so plaintext keys are never exposed in DOM text */
export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return 'Nicht hinterlegt'
  if (trimmed.length <= 6) return '••••••'
  return `••••••••••••${trimmed.slice(-4)}`
}
