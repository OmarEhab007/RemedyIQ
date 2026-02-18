/**
 * T049 — Tests for UploadProgress component
 *
 * Covers:
 *  - Renders correct phase label for each JobStatus
 *  - Progress bar has correct width style
 *  - Shows error text for failed status
 *  - Status badge text changes with status
 *  - Accessible role=progressbar is present
 */

import { describe, it, expect, vi, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadProgress } from './upload-progress'
import type { JobProgressState } from '@/hooks/use-websocket'

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

// Mock useJobProgress so we control state without real WebSocket
vi.mock('@/hooks/use-websocket', () => ({
  useJobProgress: vi.fn(),
}))

import { useJobProgress } from '@/hooks/use-websocket'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProgress(overrides: Partial<JobProgressState> = {}): void {
  ;(useJobProgress as Mock).mockReturnValue({
    progress: 0,
    status: 'queued',
    message: '',
    isComplete: false,
    error: null,
    ...overrides,
  } satisfies JobProgressState)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadProgress', () => {
  it('renders a region with the job file name as the accessible label', () => {
    mockProgress()
    render(<UploadProgress jobId="job-1" fileName="arserver.log" />)
    expect(
      screen.getByRole('region', { name: /job progress/i })
    ).toBeInTheDocument()
  })

  it('shows "Queued" in the status badge for queued status', () => {
    mockProgress({ status: 'queued', progress: 0 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Queued')
  })

  it('shows "Parsing" in the status badge for parsing status', () => {
    mockProgress({ status: 'parsing', progress: 20 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Parsing')
  })

  it('shows "Analyzing" in the status badge for analyzing status', () => {
    mockProgress({ status: 'analyzing', progress: 50 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Analyzing')
  })

  it('shows "Storing" in the status badge for storing status', () => {
    mockProgress({ status: 'storing', progress: 75 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Storing')
  })

  it('shows "Complete" in the status badge for complete status', () => {
    mockProgress({ status: 'complete', progress: 100, isComplete: true })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Complete')
  })

  it('shows "Failed" in the status badge for failed status', () => {
    mockProgress({
      status: 'failed',
      progress: 30,
      error: 'Out of memory',
      isComplete: false,
    })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-status-badge')).toHaveTextContent('Failed')
  })

  it('shows error message text when failed', () => {
    mockProgress({
      status: 'failed',
      progress: 30,
      error: 'Heap overflow',
      isComplete: false,
    })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-error-text')).toHaveTextContent('Heap overflow')
  })

  it('has progressbar with correct aria-valuenow', () => {
    mockProgress({ status: 'parsing', progress: 45 })
    render(<UploadProgress jobId="job-1" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '45')
  })

  it('renders the progress bar inner fill with the correct width style', () => {
    mockProgress({ status: 'analyzing', progress: 66 })
    const { container } = render(<UploadProgress jobId="job-1" />)
    const fill = container.querySelector<HTMLDivElement>('[style*="width: 66%"]')
    expect(fill).not.toBeNull()
  })

  it('shows "Analysis complete" description when isComplete is true', () => {
    mockProgress({ status: 'complete', progress: 100, isComplete: true })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByText('Analysis complete')).toBeInTheDocument()
  })

  it('does not render phase steps for failed status', () => {
    mockProgress({ status: 'failed', progress: 10, error: 'Error', isComplete: false })
    const { container } = render(<UploadProgress jobId="job-1" />)
    expect(container.querySelector('[role="list"][aria-label="Analysis phases"]')).toBeNull()
  })

  it('renders phase step data-testid for each phase when not failed', () => {
    mockProgress({ status: 'parsing', progress: 20 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('phase-step-queued')).toBeInTheDocument()
    expect(screen.getByTestId('phase-step-parsing')).toBeInTheDocument()
    expect(screen.getByTestId('phase-step-analyzing')).toBeInTheDocument()
    expect(screen.getByTestId('phase-step-storing')).toBeInTheDocument()
    expect(screen.getByTestId('phase-step-complete')).toBeInTheDocument()
  })

  it('shows the error alert container for failed status with error', () => {
    mockProgress({ status: 'failed', progress: 30, error: 'OOM', isComplete: false })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByTestId('progress-error-alert')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Action buttons on completion
  // -------------------------------------------------------------------------

  it('shows View Dashboard and View Explorer buttons when complete', () => {
    mockProgress({ status: 'complete', progress: 100, isComplete: true })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.getByRole('button', { name: /view dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view explorer/i })).toBeInTheDocument()
  })

  it('navigates to dashboard when View Dashboard is clicked', () => {
    mockPush.mockClear()
    mockProgress({ status: 'complete', progress: 100, isComplete: true })
    render(<UploadProgress jobId="job-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /view dashboard/i }))
    expect(mockPush).toHaveBeenCalledWith('/analysis/job-abc')
  })

  it('navigates to explorer when View Explorer is clicked', () => {
    mockPush.mockClear()
    mockProgress({ status: 'complete', progress: 100, isComplete: true })
    render(<UploadProgress jobId="job-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /view explorer/i }))
    expect(mockPush).toHaveBeenCalledWith('/analysis/job-abc/explorer')
  })

  it('does not show action buttons when job is still in progress', () => {
    mockProgress({ status: 'parsing', progress: 40 })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.queryByTestId('progress-actions')).toBeNull()
  })

  it('does not show action buttons when job has failed', () => {
    mockProgress({ status: 'failed', progress: 30, error: 'Error', isComplete: false })
    render(<UploadProgress jobId="job-1" />)
    expect(screen.queryByTestId('progress-actions')).toBeNull()
  })
})
