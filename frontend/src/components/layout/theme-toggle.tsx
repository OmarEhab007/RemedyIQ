'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// ThemeToggle
//
// Uses a `mounted` guard to avoid hydration mismatches: during SSR the
// resolved theme defaults to 'light', but on the client it may be 'dark'
// (read from localStorage). We render a neutral placeholder until the
// component has mounted on the client.
//
// Usage:
//   <ThemeToggle />
// ---------------------------------------------------------------------------

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, toggleTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  // During SSR / hydration, render a static placeholder to avoid mismatch
  const isDark = mounted ? resolvedTheme === 'dark' : false

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
      )}
      suppressHydrationWarning
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        <Sun
          className={cn(
            'absolute h-4 w-4 text-[var(--color-text-tertiary)] transition-all duration-200',
            isDark ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90'
          )}
        />
        <Moon
          className={cn(
            'absolute h-4 w-4 text-[var(--color-text-tertiary)] transition-all duration-200',
            isDark ? 'scale-0 opacity-0 -rotate-90' : 'scale-100 opacity-100 rotate-0'
          )}
        />
      </span>
      <span suppressHydrationWarning>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
