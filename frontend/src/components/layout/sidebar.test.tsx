import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Sidebar } from './sidebar'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Override next/navigation here so usePathname is a vi.fn() we can control.
// test-setup.tsx also mocks next/navigation but only for other modules; this
// file-level mock takes precedence for tests in this file.
const mockUsePathname = vi.fn(() => '/')
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(() => ({
    resolvedTheme: 'light' as const,
    toggleTheme: vi.fn(),
    theme: 'light' as const,
    setTheme: vi.fn(),
  })),
}))

vi.mock('@/lib/constants', () => ({
  ROUTES: {
    HOME: '/',
    UPLOAD: '/upload',
    ANALYSIS: '/analysis',
    EXPLORER: '/explorer',
    TRACE: '/trace',
    AI: '/ai',
  },
}))

// Stub ThemeToggle so it doesn't pull in useTheme internals
vi.mock('@/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <button>Toggle theme</button>,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSidebar(props: { onClose?: () => void } = {}) {
  return render(<Sidebar {...props} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/')
  })

  // --- Structure -----------------------------------------------------------

  it('renders a nav element with accessible label "Main navigation"', () => {
    renderSidebar()
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' })
    ).toBeInTheDocument()
  })

  it('renders all 5 navigation links', () => {
    renderSidebar()
    const expectedLabels = ['Upload', 'Analyses', 'Explorer', 'Traces', 'AI Assistant']
    expectedLabels.forEach((label) => {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    })
  })

  // --- Brand header --------------------------------------------------------

  it('renders the RemedyIQ brand text', () => {
    renderSidebar()
    expect(screen.getByText('RemedyIQ')).toBeInTheDocument()
  })

  it('renders a home link with accessible label "RemedyIQ home"', () => {
    renderSidebar()
    expect(
      screen.getByRole('link', { name: 'RemedyIQ home' })
    ).toBeInTheDocument()
  })

  // --- Active state --------------------------------------------------------

  it('marks the Upload link as aria-current="page" when pathname is /upload', () => {
    mockUsePathname.mockReturnValue('/upload')
    renderSidebar()
    const uploadLink = screen.getByRole('link', { name: 'Upload' })
    expect(uploadLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks the Analyses link as aria-current="page" when pathname is /analysis', () => {
    mockUsePathname.mockReturnValue('/analysis')
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Analyses' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('marks a link as aria-current="page" for a nested path (prefix match)', () => {
    mockUsePathname.mockReturnValue('/analysis/abc-123')
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Analyses' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('does not set aria-current on inactive links', () => {
    mockUsePathname.mockReturnValue('/upload')
    renderSidebar()
    // Analyses, Explorer, Traces, AI Assistant should NOT be active
    const inactiveLabels = ['Analyses', 'Explorer', 'Traces', 'AI Assistant']
    inactiveLabels.forEach((label) => {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute(
        'aria-current'
      )
    })
  })

  // --- Close button --------------------------------------------------------

  it('renders the close button when onClose prop is provided', () => {
    renderSidebar({ onClose: vi.fn() })
    expect(
      screen.getByRole('button', { name: 'Close navigation' })
    ).toBeInTheDocument()
  })

  it('does not render a close button when onClose prop is omitted', () => {
    renderSidebar()
    expect(
      screen.queryByRole('button', { name: 'Close navigation' })
    ).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSidebar({ onClose })
    await user.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // --- Calling onClose from nav links -------------------------------------

  it('calls onClose when a nav link is clicked and onClose is provided', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSidebar({ onClose })
    await user.click(screen.getByRole('link', { name: 'Upload' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not throw when a nav link is clicked and onClose is not provided', async () => {
    const user = userEvent.setup()
    renderSidebar()
    // Should not throw — onClose?.() guard should handle the missing prop
    await expect(
      user.click(screen.getByRole('link', { name: 'Upload' }))
    ).resolves.not.toThrow()
  })

  // --- Help link -----------------------------------------------------------

  it('renders a Help link pointing to the docs URL', () => {
    renderSidebar()
    const helpLink = screen.getByRole('link', { name: /help/i })
    expect(helpLink).toBeInTheDocument()
    expect(helpLink).toHaveAttribute('href', 'https://docs.remedyiq.io')
  })

  it('opens the Help link in a new tab', () => {
    renderSidebar()
    const helpLink = screen.getByRole('link', { name: /help/i })
    expect(helpLink).toHaveAttribute('target', '_blank')
    expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // --- Theme toggle --------------------------------------------------------

  it('renders the ThemeToggle component', () => {
    renderSidebar()
    // Our stub renders "Toggle theme"
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument()
  })
})
