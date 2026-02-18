'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemPreference() : theme
}

function applyThemeClass(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: getSystemPreference(),

      setTheme(theme: Theme) {
        const resolved = resolveTheme(theme)
        applyThemeClass(resolved)
        set({ theme, resolvedTheme: resolved })
      },
    }),
    {
      name: 'theme',
      // Only persist `theme`; resolvedTheme is derived at runtime
      partialize: (state) => ({ theme: state.theme }),
      // On rehydration, resolve and apply the stored theme
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const resolved = resolveTheme(state.theme)
        state.resolvedTheme = resolved
        applyThemeClass(resolved)
      },
    }
  )
)
