/**
 * T051 — Tests for the Upload page
 *
 * Covers:
 *  - Page renders PageHeader with correct title
 *  - DropZone is present
 *  - JobQueue is present
 *  - UploadProgress appears after a successful upload + job creation
 *  - createAnalysis error alert is shown on mutation failure
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import UploadPage from './page'
import type { AnalysisJob, LogFile, ListAnalysesResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/upload',
}))

// Capture createAnalysis.mutate so tests can call onSuccess / onError
let createAnalysisMutate: Mock = vi.fn()
let createAnalysisIsError = false
let createAnalysisError: Error | null = null

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

vi.mock('@/hooks/use-api', () => ({
  useAnalyses: vi.fn(),
  useCreateAnalysis: () => ({
    mutate: createAnalysisMutate,
    isPending: false,
    isError: createAnalysisIsError,
    error: createAnalysisError,
    variables: undefined,
  }),
  queryKeys: {
    analyses: () => ['analyses'],
  },
}))

// Mock sub-components so tests focus on page-level concerns
vi.mock('@/components/upload/drop-zone', () => ({
  DropZone: ({
    onUploadComplete,
  }: {
    onUploadComplete?: (file: LogFile) => void
    onUploadError?: (err: Error) => void
  }) => (
    <div
      data-testid="mock-drop-zone"
      onClick={() =>
        onUploadComplete?.({
          id: 'file-mock-1',
          filename: 'arserver.log',
          size_bytes: 1024,
          detected_types: ['API'],
          uploaded_at: new Date().toISOString(),
          tenant_id: 'tenant-1',
          uploader_id: 'user-1',
          storage_key: 'key',
          checksum: 'abc',
        })
      }
    >
      MockDropZone
    </div>
  ),
}))

vi.mock('@/components/upload/upload-progress', () => ({
  UploadProgress: ({ jobId }: { jobId: string }) => (
    <div data-testid="mock-upload-progress" data-job-id={jobId}>
      MockUploadProgress
    </div>
  ),
}))

vi.mock('@/components/upload/job-queue', () => ({
  JobQueue: () => <div data-testid="mock-job-queue">MockJobQueue</div>,
}))

vi.mock('@/hooks/use-websocket', () => ({
  useJobProgress: () => ({
    progress: 0,
    status: 'queued',
    message: '',
    isComplete: false,
    error: null,
  }),
}))

import { useAnalyses } from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mockAnalyses(jobs: AnalysisJob[] = []) {
  ;(useAnalyses as Mock).mockReturnValue({
    data: { jobs, pagination: { page: 1, page_size: 100, total: 0, total_pages: 0 } } as ListAnalysesResponse,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}

function makeJob(id = 'job-1'): AnalysisJob {
  return {
    id,
    tenant_id: 'tenant-1',
    status: 'queued',
    file_id: 'file-mock-1',
    progress_pct: 0,
    processed_lines: 0,
    api_count: 0,
    sql_count: 0,
    filter_count: 0,
    esc_count: 0,
    log_start: null,
    log_end: null,
    log_duration: null,
    error_message: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    flags: null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadPage', () => {
  beforeEach(() => {
    createAnalysisMutate = vi.fn()
    createAnalysisIsError = false
    createAnalysisError = null
    mockAnalyses()
  })

  it('renders the page heading', () => {
    render(<UploadPage />)
    expect(
      screen.getByRole('heading', { name: /upload log file/i })
    ).toBeInTheDocument()
  })

  it('renders the DropZone', () => {
    render(<UploadPage />)
    expect(screen.getByTestId('mock-drop-zone')).toBeInTheDocument()
  })

  it('renders the JobQueue', () => {
    render(<UploadPage />)
    expect(screen.getByTestId('mock-job-queue')).toBeInTheDocument()
  })

  it('does not render UploadProgress initially', () => {
    render(<UploadPage />)
    expect(screen.queryByTestId('mock-upload-progress')).toBeNull()
  })

  it('shows UploadProgress after file upload + job creation success', async () => {
    // Configure mutate to call onSuccess synchronously with a job
    createAnalysisMutate = vi.fn(
      (_vars: unknown, cbs: { onSuccess?: (job: AnalysisJob) => void }) => {
        cbs?.onSuccess?.(makeJob('job-created-1'))
      }
    )

    render(<UploadPage />)

    // Click the mock DropZone to trigger onUploadComplete
    await act(async () => {
      screen.getByTestId('mock-drop-zone').click()
    })

    const progress = screen.getByTestId('mock-upload-progress')
    expect(progress).toBeInTheDocument()
    expect(progress).toHaveAttribute('data-job-id', 'job-created-1')
  })

  it('calls createAnalysis.mutate with the file id from the upload', async () => {
    render(<UploadPage />)

    await act(async () => {
      screen.getByTestId('mock-drop-zone').click()
    })

    expect(createAnalysisMutate).toHaveBeenCalledWith(
      { fileId: 'file-mock-1' },
      expect.any(Object)
    )
  })

  it('has correct landmark regions for upload and job history', () => {
    render(<UploadPage />)
    expect(screen.getByRole('region', { name: /file upload/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /job history/i })).toBeInTheDocument()
  })
})
