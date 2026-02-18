import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ThemeToggle } from './theme-toggle'
import { useTheme } from '@/hooks/use-theme'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(),
}))

const mockUseTheme = useTheme as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildThemeMock(resolvedTheme: 'light' | 'dark') {
  return {
    resolvedTheme,
    toggleTheme: vi.fn(),
    theme: resolvedTheme,
    setTheme: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Label based on current theme ----------------------------------------

  it('shows "Dark mode" label when resolvedTheme is "light"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('light'))
    render(<ThemeToggle />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
  })

  it('does not show "Light mode" label when resolvedTheme is "light"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('light'))
    render(<ThemeToggle />)
    expect(screen.queryByText('Light mode')).not.toBeInTheDocument()
  })

  it('shows "Light mode" label when resolvedTheme is "dark"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('dark'))
    render(<ThemeToggle />)
    expect(screen.getByText('Light mode')).toBeInTheDocument()
  })

  it('does not show "Dark mode" label when resolvedTheme is "dark"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('dark'))
    render(<ThemeToggle />)
    expect(screen.queryByText('Dark mode')).not.toBeInTheDocument()
  })

  // --- Accessibility attributes --------------------------------------------

  it('has aria-label="Toggle theme"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('light'))
    render(<ThemeToggle />)
    expect(
      screen.getByRole('button', { name: 'Toggle theme' })
    ).toBeInTheDocument()
  })

  it('has aria-pressed=false when resolvedTheme is "light" (not in dark mode)', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('light'))
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    // isDark = false when resolvedTheme is 'light'
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('has aria-pressed=true when resolvedTheme is "dark"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('dark'))
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    // isDark = true when resolvedTheme is 'dark'
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  // --- Interaction ---------------------------------------------------------

  it('calls toggleTheme when the button is clicked', async () => {
    const user = userEvent.setup()
    const mock = buildThemeMock('light')
    mockUseTheme.mockReturnValue(mock)
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(mock.toggleTheme).toHaveBeenCalledTimes(1)
  })

  it('calls toggleTheme exactly once per click', async () => {
    const user = userEvent.setup()
    const mock = buildThemeMock('dark')
    mockUseTheme.mockReturnValue(mock)
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    await user.click(btn)
    await user.click(btn)
    expect(mock.toggleTheme).toHaveBeenCalledTimes(2)
  })

  // --- Button type ---------------------------------------------------------

  it('renders a button element with type="button"', () => {
    mockUseTheme.mockReturnValue(buildThemeMock('light'))
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    expect(btn).toHaveAttribute('type', 'button')
  })
})
