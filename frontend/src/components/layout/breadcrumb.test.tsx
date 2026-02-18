/**
 * Tests for Breadcrumb component.
 *
 * Covers: home page, known segments, dynamic segments, truncation, aria-current.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Override the global usePathname mock with a controllable vi.fn()
// ---------------------------------------------------------------------------

const mockUsePathname = vi.fn(() => '/')

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

import { Breadcrumb } from './breadcrumb'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Breadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders home icon only when on root path', () => {
    mockUsePathname.mockReturnValue('/')
    render(<Breadcrumb />)
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders known segment label for /upload', () => {
    mockUsePathname.mockReturnValue('/upload')
    render(<Breadcrumb />)
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('renders known segment label for /analysis', () => {
    mockUsePathname.mockReturnValue('/analysis')
    render(<Breadcrumb />)
    expect(screen.getByText('Analyses')).toBeInTheDocument()
  })

  it('renders known segment label for /explorer', () => {
    mockUsePathname.mockReturnValue('/explorer')
    render(<Breadcrumb />)
    expect(screen.getByText('Explorer')).toBeInTheDocument()
  })

  it('renders known segment label for /trace', () => {
    mockUsePathname.mockReturnValue('/trace')
    render(<Breadcrumb />)
    expect(screen.getByText('Traces')).toBeInTheDocument()
  })

  it('renders known segment label for /ai', () => {
    mockUsePathname.mockReturnValue('/ai')
    render(<Breadcrumb />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
  })

  it('marks the current segment with aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/upload')
    render(<Breadcrumb />)
    const current = screen.getByText('Upload')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('renders multi-level breadcrumbs with links', () => {
    mockUsePathname.mockReturnValue('/analysis/job-123')
    render(<Breadcrumb />)

    // Analyses should be a link (not current)
    const analysesLink = screen.getByText('Analyses')
    expect(analysesLink.tagName).toBe('A')
    expect(analysesLink).not.toHaveAttribute('aria-current')

    // Dynamic segment should be current
    const currentSegment = screen.getByText('job-123')
    expect(currentSegment).toHaveAttribute('aria-current', 'page')
  })

  it('truncates long dynamic segments', () => {
    mockUsePathname.mockReturnValue('/analysis/abcdefghijklmnop')
    render(<Breadcrumb />)
    // truncate(str, 12) → "abcdefghi..."
    expect(screen.getByText('abcdefghi...')).toBeInTheDocument()
  })

  it('renders home link in multi-level breadcrumbs', () => {
    mockUsePathname.mockReturnValue('/analysis')
    render(<Breadcrumb />)
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders breadcrumb as ordered list', () => {
    mockUsePathname.mockReturnValue('/analysis/job-1')
    render(<Breadcrumb />)
    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
    const items = within(list).getAllByRole('listitem')
    // Home + Analyses + job-1 = 3
    expect(items.length).toBe(3)
  })

  it('renders nested dynamic routes correctly', () => {
    mockUsePathname.mockReturnValue('/analysis/job-abc/explorer')
    render(<Breadcrumb />)
    expect(screen.getByText('Analyses')).toBeInTheDocument()
    expect(screen.getByText('job-abc')).toBeInTheDocument()
    expect(screen.getByText('Explorer')).toBeInTheDocument()
  })
})
