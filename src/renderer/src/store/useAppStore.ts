import { create } from 'zustand'
import type { AwsIdentity, TimeRange } from '@shared/types'
import { APP } from '@shared/config'
import { presetToRange } from '@shared/time'

export type Theme = 'dark' | 'light'

function initialTheme(): Theme {
  return localStorage.getItem(APP.storageKeys.theme) === 'light' ? 'light' : 'dark'
}
function initialRefresh(): number {
  const s = Number(localStorage.getItem(APP.storageKeys.refresh))
  // Default OFF — AWS calls cost money/quota; the user opts into polling.
  return Number.isFinite(s) && s >= 0 ? s : 0
}
function initialProfile(): string {
  return localStorage.getItem(APP.storageKeys.profile) || 'default'
}
function initialRegion(): string {
  return localStorage.getItem(APP.storageKeys.region) || APP.defaultRegion
}

/** Toggle the theme class consumed by the CSS tokens. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

interface AppState {
  profile: string
  setProfile: (p: string) => void
  region: string
  setRegion: (r: string) => void
  /** Identity resolved at connect (STS GetCallerIdentity). */
  identity?: AwsIdentity
  setIdentity: (i?: AwsIdentity) => void
  timeRange: TimeRange
  setTimeRange: (r: TimeRange) => void
  autoRefreshMs: number
  setAutoRefreshMs: (ms: number) => void
  theme: Theme
  toggleTheme: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: initialProfile(),
  setProfile: (p) => {
    localStorage.setItem(APP.storageKeys.profile, p)
    set({ profile: p })
  },

  region: initialRegion(),
  setRegion: (r) => {
    localStorage.setItem(APP.storageKeys.region, r)
    set({ region: r })
  },

  identity: undefined,
  setIdentity: (i) => set({ identity: i }),

  timeRange: presetToRange('24h'),
  setTimeRange: (r) => set({ timeRange: r }),

  autoRefreshMs: initialRefresh(),
  setAutoRefreshMs: (ms) => {
    localStorage.setItem(APP.storageKeys.refresh, String(ms))
    set({ autoRefreshMs: ms })
  },

  theme: initialTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(APP.storageKeys.theme, next)
    applyTheme(next)
    set({ theme: next })
  }
}))
