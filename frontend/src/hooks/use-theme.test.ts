import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useTheme } from './use-theme'
import { useThemeStore } from '@/stores/theme-store'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/stores/theme-store', () => ({
  useThemeStore: vi.fn(),
}))

const mockUseThemeStore = useThemeStore as unknown as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface StoreMockOptions {
  theme?: 'light' | 'dark' | 'system'
  resolvedTheme?: 'light' | 'dark'
  setTheme?: ReturnType<typeof vi.fn>
}

/**
 * Wire up mockUseThemeStore to return the correct value for each selector
 * call. The Zustand selector pattern calls `useThemeStore(selector)` once per
 * value, so we need to route each call to the right field.
 */
function setupStoreMock({
  theme = 'light',
  resolvedTheme = 'light',
  setTheme = vi.fn(),
}: StoreMockOptions = {}) {
  const state = { theme, resolvedTheme, setTheme }

  mockUseThemeStore.mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  )

  return { theme, resolvedTheme, setTheme, state }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Returned values from store ------------------------------------------

  it('returns the theme value from the store', () => {
    setupStoreMock({ theme: 'dark', resolvedTheme: 'dark' })
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('returns "system" theme when store has system theme', () => {
    setupStoreMock({ theme: 'system', resolvedTheme: 'light' })
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
  })

  it('returns resolvedTheme from the store', () => {
    setupStoreMock({ theme: 'system', resolvedTheme: 'dark' })
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('returns resolvedTheme="light" when store resolves to light', () => {
    setupStoreMock({ theme: 'light', resolvedTheme: 'light' })
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('returns the setTheme function from the store', () => {
    const setTheme = vi.fn()
    setupStoreMock({ setTheme })
    const { result } = renderHook(() => useTheme())
    expect(result.current.setTheme).toBe(setTheme)
  })

  // --- setTheme passthrough ------------------------------------------------

  it('calling setTheme("dark") forwards to the store setTheme', () => {
    const setTheme = vi.fn()
    setupStoreMock({ theme: 'light', resolvedTheme: 'light', setTheme })
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(setTheme).toHaveBeenCalledWith('dark')
    expect(setTheme).toHaveBeenCalledTimes(1)
  })

  it('calling setTheme("light") forwards to the store setTheme', () => {
    const setTheme = vi.fn()
    setupStoreMock({ theme: 'dark', resolvedTheme: 'dark', setTheme })
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(setTheme).toHaveBeenCalledWith('light')
  })

  // --- toggleTheme: dark → light ------------------------------------------

  it('toggleTheme calls setTheme("light") when resolvedTheme is "dark"', () => {
    const setTheme = vi.fn()
    setupStoreMock({ theme: 'dark', resolvedTheme: 'dark', setTheme })
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(setTheme).toHaveBeenCalledWith('light')
    expect(setTheme).toHaveBeenCalledTimes(1)
  })

  // --- toggleTheme: light → dark ------------------------------------------

  it('toggleTheme calls setTheme("dark") when resolvedTheme is "light"', () => {
    const setTheme = vi.fn()
    setupStoreMock({ theme: 'light', resolvedTheme: 'light', setTheme })
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(setTheme).toHaveBeenCalledWith('dark')
    expect(setTheme).toHaveBeenCalledTimes(1)
  })

  // --- toggleTheme: system resolving to dark → light ----------------------

  it('toggleTheme uses resolvedTheme (not theme) to decide direction', () => {
    // theme = 'system', but the resolved value is 'dark'
    // so toggleTheme should switch TO 'light'
    const setTheme = vi.fn()
    setupStoreMock({ theme: 'system', resolvedTheme: 'dark', setTheme })
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })

    expect(setTheme).toHaveBeenCalledWith('light')
  })

  // --- toggleTheme is stable across re-renders ----------------------------

  it('toggleTheme is a stable reference when dependencies do not change', () => {
    const setTheme = vi.fn()
    setupStoreMock({ resolvedTheme: 'light', setTheme })
    const { result, rerender } = renderHook(() => useTheme())

    const firstToggle = result.current.toggleTheme
    rerender()
    const secondToggle = result.current.toggleTheme

    expect(firstToggle).toBe(secondToggle)
  })

  // --- Return shape --------------------------------------------------------

  it('returns an object with exactly the four expected keys', () => {
    setupStoreMock()
    const { result } = renderHook(() => useTheme())
    const keys = Object.keys(result.current).sort()
    expect(keys).toEqual(['resolvedTheme', 'setTheme', 'theme', 'toggleTheme'])
  })
})
