'use client'

/**
 * use-theme.ts — Thin hook wrapper that reads/writes from the Zustand theme
 * store and exposes a stable `toggleTheme` helper.
 *
 * Usage:
 *   const { theme, setTheme, resolvedTheme, toggleTheme } = useTheme()
 *
 *   // Toggle between light and dark (ignores 'system' state, snaps to opposite)
 *   <button onClick={toggleTheme}>Toggle</button>
 *
 *   // Explicit set
 *   <button onClick={() => setTheme('dark')}>Dark mode</button>
 */

import { useCallback } from 'react'
import { useThemeStore } from '@/stores/theme-store'
import type { Theme, ResolvedTheme } from '@/stores/theme-store'

export type { Theme, ResolvedTheme }

export interface UseThemeReturn {
  /** The stored preference: 'light' | 'dark' | 'system' */
  theme: Theme
  /** Set the theme preference explicitly */
  setTheme: (theme: Theme) => void
  /** The effective resolved theme: always 'light' or 'dark' */
  resolvedTheme: ResolvedTheme
  /** Toggles between 'light' and 'dark', based on resolvedTheme */
  toggleTheme: () => void
}

/**
 * Returns the current theme state and controls from the Zustand theme store.
 * Must be used inside a component tree that renders ThemeProvider (which
 * initialises the store).
 */
export function useTheme(): UseThemeReturn {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  return { theme, setTheme, resolvedTheme, toggleTheme }
}
