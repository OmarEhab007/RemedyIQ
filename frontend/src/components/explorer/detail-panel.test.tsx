/**
 * Tests for DetailPanel component.
 *
 * Covers: loading/error states, field rendering, raw text display,
 * copy button, close button, context entries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetailPanel } from './detail-panel'
import type { LogEntry, LogEntryContext } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mock use-api hooks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-api', () => ({
  useLogEntry: vi.fn(),
  useEntryContext: vi.fn(),
}))

import { useLogEntry, useEntryContext } from '@/hooks/use-api'

const mockUseLogEntry = useLogEntry as ReturnType<typeof vi.fn>
const mockUseEntryContext = useEntryContext as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockEntry: LogEntry = {
  tenant_id: 'tenant-1',
  job_id: 'job-1',
  entry_id: 'entry-abc-123',
  line_number: 42,
  timestamp: '2025-01-15T10:30:00.000Z',
  log_type: 'API',
  trace_id: 'trace-xyz',
  rpc_id: 'rpc-001',
  thread_id: 'thread-5',
  queue: 'Queue-1',
  user: 'john.doe',
  duration_ms: 1234,
  success: true,
  form: 'HPD:Help_Desk',
  sql_table: null,
  filter_name: null,
  esc_name: null,
  raw_text: 'RAW LOG TEXT CONTENT HERE',
  error_message: null,
}

const mockContext: LogEntryContext = {
  before: [
    { ...mockEntry, entry_id: 'before-1', line_number: 40, log_type: 'SQL' },
  ],
  entry: mockEntry,
  after: [
    { ...mockEntry, entry_id: 'after-1', line_number: 44, log_type: 'FLTR' },
  ],
}

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  jobId: 'job-1',
  entryId: 'entry-abc-123',
  onClose: vi.fn(),
}

function setup(props = defaultProps) {
  const user = userEvent.setup()
  const result = render(<DetailPanel {...props} />)
  return { user, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEntryContext.mockReturnValue({ data: undefined })
  })

  it('renders loading state initially', () => {
    mockUseLogEntry.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    expect(screen.getByRole('status', { name: /loading content/i })).toBeInTheDocument()
  })

  it('renders error state when fetch fails', () => {
    mockUseLogEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })
    setup()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load log entry details/i)).toBeInTheDocument()
  })

  it('renders the entry details panel with accessible role', () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    expect(screen.getByRole('complementary', { name: /log entry details/i })).toBeInTheDocument()
  })

  it('displays key entry fields', () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    expect(screen.getByText('entry-abc-123')).toBeInTheDocument()
    expect(screen.getByText('john.doe')).toBeInTheDocument()
    expect(screen.getByText('HPD:Help_Desk')).toBeInTheDocument()
    expect(screen.getByText('1234ms')).toBeInTheDocument()
    expect(screen.getByText('Queue-1')).toBeInTheDocument()
  })

  it('displays raw text in a preformatted block', () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    const pre = screen.getByText('RAW LOG TEXT CONTENT HERE')
    expect(pre.tagName).toBe('PRE')
  })

  it('shows copy button for raw text', () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    expect(screen.getByRole('button', { name: /copy raw text/i })).toBeInTheDocument()
  })

  it('copies raw text to clipboard when copy button is clicked', async () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    const { user } = setup()

    // Set up clipboard mock after setup() to avoid userEvent overriding it
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    const copyBtn = screen.getByRole('button', { name: /copy raw text/i })
    await user.click(copyBtn)

    // handleCopy is async (not awaited by onClick), so wait for microtask
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('RAW LOG TEXT CONTENT HERE')
    })
    // Shows "Copied" feedback
    expect(screen.getByText(/copied/i)).toBeInTheDocument()
  })

  it('renders close button and calls onClose when clicked', async () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    const onClose = vi.fn()
    const { user } = setup({ ...defaultProps, onClose })
    const closeBtn = screen.getByRole('button', { name: /close detail panel/i })
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders context entries when available', () => {
    mockUseLogEntry.mockReturnValue({
      data: mockEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseEntryContext.mockReturnValue({ data: mockContext })
    setup()
    // Should render context section
    expect(screen.getByRole('list', { name: /surrounding log entries/i })).toBeInTheDocument()
    // 1 before + 1 selected + 1 after = 3 items
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(3)
  })

  it('displays error message when entry has one', () => {
    const errorEntry = { ...mockEntry, error_message: 'Connection timeout', success: false }
    mockUseLogEntry.mockReturnValue({
      data: errorEntry,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    setup()
    // Error message appears in both FieldRow and dedicated Error section
    const errorTexts = screen.getAllByText('Connection timeout')
    expect(errorTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('calls refetch when retry button is clicked in error state', async () => {
    const refetch = vi.fn()
    mockUseLogEntry.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
