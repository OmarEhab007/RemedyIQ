/**
 * T050 — Tests for JobQueue component
 *
 * Covers:
 *  - Renders job list rows
 *  - Status badges are colour-coded per JOB_STATUS_CONFIG
 *  - Empty state shows when jobs array is empty
 *  - Failed jobs show error message and retry button
 *  - Retry button calls createAnalysis.mutate
 *  - Complete job row navigates to analysis dashboard on click
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JobQueue } from './job-queue'
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
  usePathname: () => '/upload',
}))

const mockMutate = vi.fn()

vi.mock('@/hooks/use-api', () => ({
  useAnalyses: vi.fn(),
  useCreateAnalysis: () => ({
    mutate: mockMutate,
    isPending: false,
    variables: undefined,
  }),
}))

import { useAnalyses } from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<AnalysisJob> = {}): AnalysisJob {
  return {
    id: 'job-abc-123',
    tenant_id: 'tenant-1',
    status: 'complete',
    file_id: 'file-1',
    progress_pct: 100,
    processed_lines: 810,
    api_count: 500,
    sql_count: 200,
    filter_count: 100,
    esc_count: 10,
    log_start: null,
    log_end: null,
    log_duration: null,
    error_message: null,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    flags: null,
    ...overrides,
  }
}

function mockAnalyses(jobs: AnalysisJob[], opts: { isLoading?: boolean; isError?: boolean } = {}) {
  ;(useAnalyses as Mock).mockReturnValue({
    data: { jobs, pagination: { page: 1, page_size: 100, total: jobs.length, total_pages: 1 } } as ListAnalysesResponse,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    refetch: vi.fn(),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobQueue', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockMutate.mockClear()
  })

  it('renders the section heading', () => {
    mockAnalyses([])
    render(<JobQueue />)
    expect(screen.getByRole('region', { name: /job queue/i })).toBeInTheDocument()
    expect(screen.getByText('Recent Jobs')).toBeInTheDocument()
  })

  it('shows empty state when there are no jobs', () => {
    mockAnalyses([])
    render(<JobQueue />)
    expect(screen.getByText(/no jobs yet/i)).toBeInTheDocument()
  })

  it('renders a row for each job', () => {
    mockAnalyses([makeJob({ id: 'job-1' }), makeJob({ id: 'job-2' })])
    render(<JobQueue />)
    expect(screen.getAllByTestId('job-row')).toHaveLength(2)
  })

  it('renders status badge for complete job', () => {
    mockAnalyses([makeJob({ status: 'complete' })])
    render(<JobQueue />)
    expect(screen.getByTestId('status-badge-complete')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('renders status badge for failed job', () => {
    mockAnalyses([makeJob({ status: 'failed', error_message: 'OOM error' })])
    render(<JobQueue />)
    expect(screen.getByTestId('status-badge-failed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows error message text for failed jobs', () => {
    mockAnalyses([makeJob({ status: 'failed', error_message: 'Heap overflow' })])
    render(<JobQueue />)
    expect(screen.getByText('Heap overflow')).toBeInTheDocument()
  })

  it('shows retry button for failed jobs', () => {
    mockAnalyses([makeJob({ status: 'failed' })])
    render(<JobQueue />)
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })

  it('calls createAnalysis.mutate with the file_id when retry is clicked', () => {
    const job = makeJob({ status: 'failed', file_id: 'file-xyz' })
    mockAnalyses([job])
    render(<JobQueue />)
    fireEvent.click(screen.getByTestId('retry-button'))
    expect(mockMutate).toHaveBeenCalledWith({ fileId: 'file-xyz' })
  })

  it('does not show retry button for complete jobs', () => {
    mockAnalyses([makeJob({ status: 'complete' })])
    render(<JobQueue />)
    expect(screen.queryByTestId('retry-button')).toBeNull()
  })

  it('navigates to analysis detail on complete row click', () => {
    mockAnalyses([makeJob({ status: 'complete', id: 'job-nav-test' })])
    render(<JobQueue />)
    fireEvent.click(screen.getByTestId('job-row'))
    expect(mockPush).toHaveBeenCalledWith('/analysis/job-nav-test')
  })

  it('renders loading state while fetching', () => {
    mockAnalyses([], { isLoading: true })
    render(<JobQueue />)
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('renders error state when query fails', () => {
    mockAnalyses([], { isError: true })
    render(<JobQueue />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('displays the job count badge when jobs exist', () => {
    mockAnalyses([makeJob({ id: 'j1' }), makeJob({ id: 'j2' }), makeJob({ id: 'j3' })])
    render(<JobQueue />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows entry counts for a complete job', () => {
    mockAnalyses([
      makeJob({ api_count: 1234, sql_count: 567, filter_count: 89, esc_count: 12 }),
    ])
    render(<JobQueue />)
    // CountPill uses formatCount: 1234 → '1.2K', 567 → '567', 89 → '89', 12 → '12'
    expect(screen.getByLabelText(/API count/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/SQL count/i)).toBeInTheDocument()
  })
})
