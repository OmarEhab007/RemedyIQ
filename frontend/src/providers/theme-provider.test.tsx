/**
 * Tests for ThemeProvider and its useTheme hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from './theme-provider'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const storageMock: Record<string, string> = {}

beforeEach(() => {
  Object.keys(storageMock).forEach((k) => delete storageMock[k])
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storageMock[key] ?? null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
    storageMock[key] = val
  })
  document.documentElement.classList.remove('dark')
})

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

let mediaQueryMatch = false

beforeEach(() => {
  mediaQueryMatch = false
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mediaQueryMatch,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  })
})

// ---------------------------------------------------------------------------
// Test consumer component
// ---------------------------------------------------------------------------

function ThemeConsumer() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThemeProvider', () => {
  it('defaults to system theme', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('resolves system theme to light when matchMedia is false', () => {
    mediaQueryMatch = false
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('resolves system theme to dark when matchMedia is true', () => {
    mediaQueryMatch = true
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('reads stored theme from localStorage', () => {
    storageMock['theme'] = 'dark'
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('sets theme to dark and applies class', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    await user.click(screen.getByText('Set Dark'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(storageMock['theme']).toBe('dark')
  })

  it('sets theme to light and removes dark class', async () => {
    document.documentElement.classList.add('dark')
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    )

    await user.click(screen.getByText('Set Light'))
    expect(screen.getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('accepts a custom defaultTheme prop', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('useTheme outside provider', () => {
  it('throws when used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThemeConsumer />)).toThrow('useTheme must be used within a ThemeProvider')
    spy.mockRestore()
  })
})
