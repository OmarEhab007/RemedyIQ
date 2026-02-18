/**
 * Tests for TraceSearch component.
 *
 * Covers: form field rendering, form submission, search results table,
 * empty results, error state, loading state, navigation on row click,
 * error filter radio buttons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TraceSearch } from './trace-search'
import type { TransactionSummary, TransactionSearchResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/constants', () => ({
  LOG_TYPE_COLORS: {
    API: { bg: '#4f46e5', text: '#fff', label: 'API', description: 'AR Server API calls' },
    SQL: { bg: '#10b981', text: '#fff', label: 'SQL', description: 'SQL queries' },
    FLTR: { bg: '#f59e0b', text: '#000', label: 'FLTR', description: 'Filter executions' },
    ESCL: { bg: '#8b5cf6', text: '#fff', label: 'ESCL', description: 'Escalations' },
  },
  ROUTES: {
    ANALYSIS_TRACE: (jobId: string, traceId: string) => `/analysis/${jobId}/trace/${traceId}`,
  },
}))

vi.mock('@/components/ui/page-state', () => ({
  PageState: ({
    variant,
    message,
    title,
  }: {
    variant: string
    message?: string
    title?: string
    rows?: number
    onRetry?: () => void
  }) => (
    <div data-testid={`page-state-${variant}`}>{message ?? title}</div>
  ),
}))

const mockUseSearchTransactions = vi.fn()

vi.mock('@/hooks/use-api', () => ({
  useSearchTransactions: (...args: unknown[]) => mockUseSearchTransactions(...args),
}))

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// ---------------------------------------------------------------------------
// makeSpan helper (for completeness in trace test files)
// ---------------------------------------------------------------------------

import type { SpanNode } from '@/lib/api-types'

let spanCounter = 0

export function makeSpan(overrides: Partial<SpanNode> = {}): SpanNode {
  spanCounter += 1
  return {
    id: `span-${spanCounter}`,
    parent_id: null,
    depth: 0,
    log_type: 'API',
    start_offset_ms: 0,
    duration_ms: 100,
    fields: {},
    children: [],
    on_critical_path: false,
    has_error: false,
    timestamp: '2025-01-15T10:00:00.000Z',
    thread_id: 'thread-1',
    trace_id: 'trace-abc',
    user: 'testuser',
    queue: 'Queue-1',
    form: null,
    operation: 'GetEntry',
    success: true,
    error_message: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let txnCounter = 0

function makeTxn(overrides: Partial<TransactionSummary> = {}): TransactionSummary {
  txnCounter += 1
  return {
    trace_id: `trace-${txnCounter.toString().padStart(3, '0')}-abc`,
    rpc_id: 'rpc-001',
    thread_id: 'thread-1',
    queue: 'Queue-Default',
    user: 'alice',
    start_time: '2025-01-15T10:00:00.000Z',
    end_time: '2025-01-15T10:00:01.000Z',
    duration_ms: 350.5,
    span_count: 5,
    error_count: 0,
    has_errors: false,
    log_types: ['API', 'SQL'],
    form: null,
    ...overrides,
  }
}

function mockNotSubmitted() {
  mockUseSearchTransactions.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}

function mockLoading() {
  mockUseSearchTransactions.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    refetch: vi.fn(),
  })
}

function mockError() {
  mockUseSearchTransactions.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  })
}

function mockSuccess(transactions: TransactionSummary[], total = transactions.length) {
  const response: TransactionSearchResponse = {
    transactions,
    total,
    pagination: { page: 1, page_size: 50, total, total_pages: 1 },
  }
  mockUseSearchTransactions.mockReturnValue({
    data: response,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
    txnCounter = 0
    mockNotSubmitted()
  })

  it('renders the search form with aria-label', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByRole('form', { name: /search traces/i })).toBeInTheDocument()
  })

  it('renders Trace ID input field', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByLabelText(/trace id/i)).toBeInTheDocument()
  })

  it('renders User input field', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByLabelText(/^user$/i)).toBeInTheDocument()
  })

  it('renders Thread ID input field', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByLabelText(/thread id/i)).toBeInTheDocument()
  })

  it('renders Errors radio buttons (Any, Yes, No)', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByLabelText(/has errors: any/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/has errors: yes/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/has errors: no/i)).toBeInTheDocument()
  })

  it('"Any" errors radio is selected by default', () => {
    render(<TraceSearch jobId="job-1" />)
    const anyRadio = screen.getByLabelText(/has errors: any/i)
    expect(anyRadio).toBeChecked()
  })

  it('renders Search submit button', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
  })

  it('does not render results section before form submission', () => {
    render(<TraceSearch jobId="job-1" />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('typing in Trace ID field updates the input value', async () => {
    const user = userEvent.setup()
    render(<TraceSearch jobId="job-1" />)
    const input = screen.getByLabelText(/trace id/i)
    await user.type(input, 'trace-xyz')
    expect(input).toHaveValue('trace-xyz')
  })

  it('typing in User field updates the input value', async () => {
    const user = userEvent.setup()
    render(<TraceSearch jobId="job-1" />)
    const input = screen.getByLabelText(/^user$/i)
    await user.type(input, 'bob')
    expect(input).toHaveValue('bob')
  })

  it('selecting Yes errors radio updates selection', async () => {
    const user = userEvent.setup()
    render(<TraceSearch jobId="job-1" />)
    const yesRadio = screen.getByLabelText(/has errors: yes/i)
    await user.click(yesRadio)
    expect(yesRadio).toBeChecked()
  })

  it('shows result count after submission', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn(), makeTxn()], 2)
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByText(/2 results/i)).toBeInTheDocument()
    })
  })

  it('shows singular "result" for exactly 1 result', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn()], 1)
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByText(/1 result(?!s)/i)).toBeInTheDocument()
    })
  })

  it('shows loading state after form submission when isLoading is true', async () => {
    const user = userEvent.setup()
    // Start with non-loading state so the button is clickable
    mockNotSubmitted()
    render(<TraceSearch jobId="job-1" />)
    // Switch to loading state before clicking submit
    mockLoading()
    // Use form submit via the button (button text may say "Search" or "Searching…")
    const form = screen.getByRole('form', { name: /search traces/i })
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByTestId('page-state-loading')).toBeInTheDocument()
    })
  })

  it('shows error state when search fails', async () => {
    const user = userEvent.setup()
    mockError()
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByTestId('page-state-error')).toBeInTheDocument()
    })
  })

  it('shows empty state when no transactions found', async () => {
    const user = userEvent.setup()
    mockSuccess([], 0)
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByTestId('page-state-empty')).toBeInTheDocument()
    })
  })

  it('renders results table with all column headers when results exist', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn()])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
    // "Trace ID" appears as both the form label text and table column header
    expect(screen.getAllByText('Trace ID').length).toBeGreaterThanOrEqual(1)
    // Column headers rendered as <th> elements
    const headers = screen.getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent)
    expect(headerTexts).toContain('Trace ID')
    expect(headerTexts).toContain('User')
    expect(headerTexts).toContain('Queue')
    expect(headerTexts).toContain('Duration')
    expect(headerTexts).toContain('Spans')
    expect(headerTexts).toContain('Types')
    expect(headerTexts).toContain('Status')
  })

  it('renders a result row for each transaction', async () => {
    const user = userEvent.setup()
    const txns = [makeTxn(), makeTxn(), makeTxn()]
    mockSuccess(txns)
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      // header + 3 data rows
      expect(screen.getAllByRole('row')).toHaveLength(4)
    })
  })

  it('renders truncated trace ID in result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ trace_id: 'trace-001-abc-def-ghi' })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      // The <span title={txn.trace_id}> holds the full ID; text is sliced to 12 chars + "…"
      const truncatedSpan = screen.getByTitle('trace-001-abc-def-ghi')
      expect(truncatedSpan).toBeInTheDocument()
      expect(truncatedSpan.textContent).toMatch(/trace-001-ab/)
    })
  })

  it('renders user name in result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ user: 'charlie' })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByText('charlie')).toBeInTheDocument()
    })
  })

  it('renders duration in result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ duration_ms: 789.1 })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByText('789.1 ms')).toBeInTheDocument()
    })
  })

  it('renders span count in result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ span_count: 12 })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })
  })

  it('renders log type badges in result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ log_types: ['API', 'SQL'] })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getAllByText('API').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('SQL').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows error indicator for transactions with errors', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ has_errors: true })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('Has errors')).toBeInTheDocument()
    })
  })

  it('shows no-error indicator for transactions without errors', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ has_errors: false })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('No errors')).toBeInTheDocument()
    })
  })

  it('navigates to trace detail page when a result row is clicked', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ trace_id: 'trace-001-abc' })])
    render(<TraceSearch jobId="job-42" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
    const rows = screen.getAllByRole('row')
    await user.click(rows[1]) // first data row
    expect(mockRouterPush).toHaveBeenCalledWith('/analysis/job-42/trace/trace-001-abc')
  })

  it('navigates on Enter keydown on result row', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ trace_id: 'trace-001-abc' })])
    render(<TraceSearch jobId="job-42" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
    const rows = screen.getAllByRole('row')
    await user.type(rows[1], '{Enter}')
    expect(mockRouterPush).toHaveBeenCalledWith('/analysis/job-42/trace/trace-001-abc')
  })

  it('result row has accessible aria-label with trace info', async () => {
    const user = userEvent.setup()
    mockSuccess([makeTxn({ trace_id: 'trace-001-abc', duration_ms: 350.5, user: 'alice' })])
    render(<TraceSearch jobId="job-1" />)
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => {
      const row = screen.getAllByRole('row')[1]
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('trace-001-abc'))
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('alice'))
    })
  })
})
