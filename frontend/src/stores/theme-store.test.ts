/**
 * theme-store.test.ts
 *
 * The Zustand theme store calls window.matchMedia at module initialisation time
 * (inside create()), so we must define the mock on window before the module is
 * evaluated. Vitest hoists vi.mock() calls to the top of the file, but for a
 * global property we need to use Object.defineProperty at module scope so it
 * is in place when the import is resolved.
 *
 * Strategy:
 *  - Assign window.matchMedia before importing the store.
 *  - Each beforeEach overrides the mock return value so individual tests can
 *    simulate different system preferences.
 *  - Spy on document.documentElement.classList to verify DOM mutations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// 1. Install window.matchMedia before the store module is evaluated.
//    This runs synchronously at module scope, ahead of any import side-effects.
// ---------------------------------------------------------------------------

function createMatchMediaMock(prefersDark: boolean): typeof window.matchMedia {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Default: system preference is light.  Must be assigned before the store import.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: createMatchMediaMock(false),
})

// ---------------------------------------------------------------------------
// 2. Now import the store — at this point window.matchMedia is defined.
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import { useThemeStore } from './theme-store'

// ---------------------------------------------------------------------------
// 3. Spy on classList so we can assert that the DOM class is toggled correctly.
// ---------------------------------------------------------------------------

const classListAdd = vi.spyOn(document.documentElement.classList, 'add')
const classListRemove = vi.spyOn(document.documentElement.classList, 'remove')

// ---------------------------------------------------------------------------
// 4. Per-test reset.
// ---------------------------------------------------------------------------

beforeEach(() => {
  classListAdd.mockClear()
  classListRemove.mockClear()

  // Restore light preference as the baseline before each test.
  window.matchMedia = createMatchMediaMock(false)

  // Drive the store back to the 'system' theme (resolves to 'light' with the
  // light matchMedia mock above). This keeps tests independent of each other.
  useThemeStore.getState().setTheme('system')

  // Clear the classList spies again after the setTheme('system') above so each
  // test starts with a clean slate.
  classListAdd.mockClear()
  classListRemove.mockClear()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useThemeStore — default state', () => {
  it('has theme="system" after reset', () => {
    expect(useThemeStore.getState().theme).toBe('system')
  })

  it('exposes a setTheme action', () => {
    expect(typeof useThemeStore.getState().setTheme).toBe('function')
  })

  it('resolvedTheme is "light" when system preference is light', () => {
    window.matchMedia = createMatchMediaMock(false)
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })
})

describe('useThemeStore — setTheme("dark")', () => {
  it('sets theme to "dark"', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('sets resolvedTheme to "dark"', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('adds "dark" class to documentElement', () => {
    useThemeStore.getState().setTheme('dark')
    expect(classListAdd).toHaveBeenCalledWith('dark')
  })

  it('does not remove "dark" class when switching to dark', () => {
    useThemeStore.getState().setTheme('dark')
    expect(classListRemove).not.toHaveBeenCalledWith('dark')
  })
})

describe('useThemeStore — setTheme("light")', () => {
  it('sets theme to "light"', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('sets resolvedTheme to "light"', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('removes "dark" class from documentElement', () => {
    useThemeStore.getState().setTheme('light')
    expect(classListRemove).toHaveBeenCalledWith('dark')
  })

  it('does not add "dark" class when switching to light', () => {
    useThemeStore.getState().setTheme('light')
    expect(classListAdd).not.toHaveBeenCalledWith('dark')
  })
})

describe('useThemeStore — setTheme("system") resolves by matchMedia', () => {
  it('resolves to "dark" when system prefers dark', () => {
    window.matchMedia = createMatchMediaMock(true)
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('resolves to "light" when system prefers light', () => {
    window.matchMedia = createMatchMediaMock(false)
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('sets theme property to "system"', () => {
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().theme).toBe('system')
  })

  it('adds "dark" class when system prefers dark', () => {
    window.matchMedia = createMatchMediaMock(true)
    useThemeStore.getState().setTheme('system')
    expect(classListAdd).toHaveBeenCalledWith('dark')
  })

  it('removes "dark" class when system prefers light', () => {
    window.matchMedia = createMatchMediaMock(false)
    useThemeStore.getState().setTheme('system')
    expect(classListRemove).toHaveBeenCalledWith('dark')
  })
})

describe('useThemeStore — theme transitions', () => {
  it('switches from dark to light correctly', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')

    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('switches from light to dark correctly', () => {
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('switches from dark to system (light preference)', () => {
    window.matchMedia = createMatchMediaMock(false)
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('light')
  })

  it('switches from light to system (dark preference)', () => {
    window.matchMedia = createMatchMediaMock(true)
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().resolvedTheme).toBe('dark')
  })

  it('resolvedTheme is always "light" or "dark", never "system"', () => {
    const valid = new Set<string>(['light', 'dark'])

    useThemeStore.getState().setTheme('light')
    expect(valid.has(useThemeStore.getState().resolvedTheme)).toBe(true)

    useThemeStore.getState().setTheme('dark')
    expect(valid.has(useThemeStore.getState().resolvedTheme)).toBe(true)

    useThemeStore.getState().setTheme('system')
    expect(valid.has(useThemeStore.getState().resolvedTheme)).toBe(true)
  })
})
