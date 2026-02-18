/**
 * T072 — Tests for the Analysis List Page (Phase 6) — Reworked
 *
 * Covers:
 *  - Renders page heading
 *  - Shows loading state while fetching
 *  - Renders job cards when data loads
 *  - Status filter buttons are present
 *  - Clicking a job card navigates to /analysis/:id
 *  - Shows empty state when no jobs exist
 *  - Shows error state when query fails
 *  - Filters by status
 *  - Shows relative timestamps
 *  - Shows count pills when data available
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import AnalysisListPage from './page'
import type { AnalysisJob, ListAnalysesResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/analysis',
  useParams: () => ({}),
}))

vi.mock('@/hooks/use-api', () => ({
  useAnalyses: vi.fn(),
}))

import { useAnalyses } from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<AnalysisJob> = {}): AnalysisJob {
  return {
    id: 'job-00000001',
    tenant_id: 'tenant-1',
    status: 'complete',
    file_id: 'file-1',
    progress_pct: 100,
    processed_lines: 1750,
    api_count: 1000,
    sql_count: 500,
    filter_count: 200,
    esc_count: 50,
    log_start: '2024-01-01T00:00:00Z',
    log_end: '2024-01-01T01:00:00Z',
    log_duration: '1h 0m',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T01:05:00Z',
    flags: null,
    ...overrides,
  }
}

function mockUseAnalyses(
  jobs: AnalysisJob[] = [],
  opts: { isLoading?: boolean; isError?: boolean } = {}
) {
  ;(useAnalyses as Mock).mockReturnValue({
    data: {
      jobs,
      pagination: { page: 1, page_size: 100, total: jobs.length, total_pages: 1 },
    } as ListAnalysesResponse,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    refetch: vi.fn(),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalysisListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAnalyses()
  })

  it('renders the Analyses heading', () => {
    mockUseAnalyses([])
    render(<AnalysisListPage />)
    expect(screen.getByRole('heading', { name: 'Analyses' })).toBeInTheDocument()
  })

  it('shows loading state when query is in-flight', () => {
    mockUseAnalyses([], { isLoading: true })
    render(<AnalysisListPage />)
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('shows error state when query fails', () => {
    mockUseAnalyses([], { isError: true })
    render(<AnalysisListPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders empty state when no jobs exist', () => {
    mockUseAnalyses([])
    render(<AnalysisListPage />)
    expect(screen.getByText(/no analyses yet/i)).toBeInTheDocument()
  })

  it('renders a card for each job', () => {
    mockUseAnalyses([makeJob({ id: 'aaa00001' }), makeJob({ id: 'bbb00002' })])
    render(<AnalysisListPage />)
    // Header shows truncated ID, detail panel shows full ID — use getAllByText
    expect(screen.getAllByText('aaa00001').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('bbb00002').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the status filter buttons', () => {
    mockUseAnalyses([makeJob()])
    render(<AnalysisListPage />)
    // Query within the filter group to avoid matching JobStatusBadge text
    const filterGroup = screen.getByRole('group', { name: /filter analyses/i })
    expect(within(filterGroup).getByRole('button', { name: /all/i })).toBeInTheDocument()
    expect(within(filterGroup).getByRole('button', { name: /complete/i })).toBeInTheDocument()
    expect(within(filterGroup).getByRole('button', { name: /running/i })).toBeInTheDocument()
    expect(within(filterGroup).getByRole('button', { name: /failed/i })).toBeInTheDocument()
  })

  it('expands job details when card is clicked', () => {
    mockUseAnalyses([makeJob({ id: 'job-click-1' })])
    render(<AnalysisListPage />)
    const card = screen.getByRole('button', { name: /job-cli/i })
    expect(card).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
    // Full job ID is now visible in the expanded panel
    expect(screen.getByText('job-click-1')).toBeInTheDocument()
  })

  it('collapses expanded card when clicked again', () => {
    mockUseAnalyses([makeJob({ id: 'job-click-1' })])
    render(<AnalysisListPage />)
    const card = screen.getByRole('button', { name: /job-cli/i })
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses previously expanded card when another is clicked', () => {
    mockUseAnalyses([makeJob({ id: 'aaa00001' }), makeJob({ id: 'bbb00002' })])
    render(<AnalysisListPage />)
    const cards = screen.getAllByRole('button', { name: /analysis job/i })
    fireEvent.click(cards[0])
    expect(cards[0]).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(cards[1])
    expect(cards[0]).toHaveAttribute('aria-expanded', 'false')
    expect(cards[1]).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows View Dashboard and View Explorer buttons when expanded', () => {
    mockUseAnalyses([makeJob({ id: 'job-nav-1' })])
    render(<AnalysisListPage />)
    fireEvent.click(screen.getByRole('button', { name: /job-nav/i }))
    expect(screen.getByRole('button', { name: /view dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view explorer/i })).toBeInTheDocument()
  })

  it('navigates to dashboard when View Dashboard is clicked', () => {
    mockUseAnalyses([makeJob({ id: 'job-nav-1' })])
    render(<AnalysisListPage />)
    fireEvent.click(screen.getByRole('button', { name: /job-nav/i }))
    fireEvent.click(screen.getByRole('button', { name: /view dashboard/i }))
    expect(mockPush).toHaveBeenCalledWith('/analysis/job-nav-1')
  })

  it('shows "Upload New Log" button', () => {
    mockUseAnalyses([])
    render(<AnalysisListPage />)
    expect(screen.getByRole('button', { name: /upload new log/i })).toBeInTheDocument()
  })

  it('clicking "Upload New Log" navigates to /upload', () => {
    mockUseAnalyses([])
    render(<AnalysisListPage />)
    fireEvent.click(screen.getByRole('button', { name: /upload new log/i }))
    expect(mockPush).toHaveBeenCalledWith('/upload')
  })

  it('filters jobs by status when filter button is clicked', () => {
    mockUseAnalyses([
      makeJob({ id: 'complete-job', status: 'complete' }),
      makeJob({ id: 'failed-j00', status: 'failed' }),
    ])
    render(<AnalysisListPage />)
    // Click "Failed" filter within the filter group
    const filterGroup = screen.getByRole('group', { name: /filter analyses/i })
    fireEvent.click(within(filterGroup).getByRole('button', { name: /failed/i }))
    // Complete job card should be hidden (aria-label uses first 8 chars of id)
    expect(screen.queryByRole('button', { name: /complete-/i })).toBeNull()
    // Failed job visible (aria-label: "Analysis job failed-j, status: failed")
    expect(screen.getByRole('button', { name: /failed-j/i })).toBeInTheDocument()
  })

  it('shows job count in the footer', () => {
    mockUseAnalyses([makeJob()])
    render(<AnalysisListPage />)
    expect(screen.getByText(/showing 1 of 1 job/i)).toBeInTheDocument()
  })

  it('displays relative time for created date', () => {
    // Job created on Jan 1, 2024 - will show as absolute date since it's > 1 year ago
    mockUseAnalyses([makeJob({ created_at: '2024-01-01T00:00:00Z' })])
    render(<AnalysisListPage />)
    // Date text appears in card summary and expanded detail panel
    expect(screen.getAllByText(/jan/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows count pills when job has counts', () => {
    mockUseAnalyses([makeJob({ api_count: 5000, sql_count: 3000 })])
    render(<AnalysisListPage />)
    expect(screen.getByText('5.0K')).toBeInTheDocument()
    expect(screen.getByText('3.0K')).toBeInTheDocument()
  })

  it('shows error message on failed jobs', () => {
    mockUseAnalyses([makeJob({ status: 'failed', error_message: 'JAR execution failed' })])
    render(<AnalysisListPage />)
    // Error appears in both card summary and expanded detail panel
    expect(screen.getAllByText('JAR execution failed').length).toBeGreaterThanOrEqual(1)
  })

  it('shows log duration when available', () => {
    mockUseAnalyses([makeJob({ log_duration: '2h 30m' })])
    render(<AnalysisListPage />)
    // Duration appears in card summary and may appear in expanded detail
    expect(screen.getAllByText(/2h 30m/).length).toBeGreaterThanOrEqual(1)
  })
})
