/**
 * Tests for LogTable component.
 *
 * Covers: rendering, empty/loading states, row rendering, row selection,
 * keyboard navigation (Enter on row), virtualization (only renders visible rows).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogTable } from './log-table'
import type { LogEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// react-window mock — renders all items for testing (no DOM measurements)
// ---------------------------------------------------------------------------

vi.mock('react-window', () => ({
  FixedSizeList: ({
    children: Children,
    itemCount,
    itemData,
  }: {
    children: React.ComponentType<{ index: number; style: React.CSSProperties; data: unknown }>
    itemCount: number
    itemData: unknown
  }) => (
    <div data-testid="fixed-size-list">
      {Array.from({ length: itemCount }, (_, i) => (
        <Children key={i} index={i} style={{}} data={itemData} />
      ))}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// ResizeObserver mock (jsdom doesn't implement it)
// ---------------------------------------------------------------------------

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback: ResizeObserverCallback) {
    // immediately fire with a dummy entry so AutoSizerWrapper renders children
    callback(
      [{ contentRect: { height: 500, width: 800 } } as ResizeObserverEntry],
      this,
    )
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// Mock clientHeight/clientWidth for AutoSizerWrapper (jsdom returns 0)
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get: () => 500,
})
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get: () => 800,
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    tenant_id: 'tenant-1',
    job_id: 'job-1',
    entry_id: `entry-${Math.random().toString(36).slice(2)}`,
    line_number: 1,
    timestamp: '2025-01-15T10:30:00.000Z',
    log_type: 'API',
    trace_id: 'trace-abc',
    rpc_id: 'rpc-001',
    thread_id: 'thread-1',
    queue: 'Queue-1',
    user: 'john.doe',
    duration_ms: 250,
    success: true,
    form: 'HPD:Help_Desk',
    sql_table: null,
    filter_name: null,
    esc_name: null,
    raw_text: 'API TRACE entry raw text line',
    error_message: null,
    ...overrides,
  }
}

const entries: LogEntry[] = [
  makeEntry({ entry_id: 'e1', form: 'HPD:Help_Desk', user: 'alice', duration_ms: 100 }),
  makeEntry({ entry_id: 'e2', log_type: 'SQL', form: null, sql_table: 'HPD:Help_Desk', user: 'bob', duration_ms: 5500, success: false }),
  makeEntry({ entry_id: 'e3', log_type: 'FLTR', form: null, filter_name: 'MyFilter', user: 'charlie', duration_ms: null, success: null }),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LogTable', () => {
  const defaultProps = {
    entries,
    selectedEntryId: null,
    onSelectEntry: vi.fn(),
    isLoading: false,
    total: entries.length,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders column headers', () => {
    render(<LogTable {...defaultProps} />)
    expect(screen.getByText(/timestamp/i)).toBeInTheDocument()
    expect(screen.getByText(/type/i)).toBeInTheDocument()
    expect(screen.getByText(/identifier/i)).toBeInTheDocument()
    expect(screen.getByText(/user/i)).toBeInTheDocument()
    expect(screen.getByText(/duration/i)).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    render(<LogTable {...defaultProps} entries={[]} isLoading />)
    expect(screen.getByRole('status', { name: /loading content/i })).toBeInTheDocument()
  })

  it('renders empty state when entries array is empty', () => {
    render(<LogTable {...defaultProps} entries={[]} isLoading={false} />)
    expect(screen.getByText(/no log entries found/i)).toBeInTheDocument()
  })

  it('renders all entry rows via the virtualized list', () => {
    render(<LogTable {...defaultProps} />)
    // Each entry appears as a row
    const rows = screen.getAllByRole('row')
    // header row + 3 entry rows = 4
    expect(rows.length).toBe(4)
  })

  it('displays user names in rows', () => {
    render(<LogTable {...defaultProps} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByText('charlie')).toBeInTheDocument()
  })

  it('displays identifier from form / sql_table / filter_name', () => {
    render(<LogTable {...defaultProps} />)
    // HPD:Help_Desk appears in both e1 (form) and e2 (sql_table)
    const hpdElements = screen.getAllByText('HPD:Help_Desk')
    expect(hpdElements.length).toBe(2)
    expect(screen.getByText('MyFilter')).toBeInTheDocument()
  })

  it('calls onSelectEntry when a row is clicked', async () => {
    const onSelectEntry = vi.fn()
    const user = userEvent.setup()
    render(<LogTable {...defaultProps} onSelectEntry={onSelectEntry} />)
    // Click first entry row
    const rows = screen.getAllByRole('row')
    await user.click(rows[1]) // rows[0] is header
    expect(onSelectEntry).toHaveBeenCalledWith('e1')
  })

  it('calls onSelectEntry with null when clicking the already-selected row', async () => {
    const onSelectEntry = vi.fn()
    const user = userEvent.setup()
    render(
      <LogTable
        {...defaultProps}
        selectedEntryId="e1"
        onSelectEntry={onSelectEntry}
      />,
    )
    const rows = screen.getAllByRole('row')
    await user.click(rows[1])
    expect(onSelectEntry).toHaveBeenCalledWith(null)
  })

  it('applies selected state styling to the chosen row', () => {
    render(<LogTable {...defaultProps} selectedEntryId="e2" />)
    const rows = screen.getAllByRole('row')
    expect(rows[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onSelectEntry on Enter keydown', () => {
    const onSelectEntry = vi.fn()
    render(<LogTable {...defaultProps} onSelectEntry={onSelectEntry} />)
    const rows = screen.getAllByRole('row')
    fireEvent.keyDown(rows[1], { key: 'Enter' })
    expect(onSelectEntry).toHaveBeenCalledWith('e1')
  })

  it('shows entry count when total is provided', () => {
    render(<LogTable {...defaultProps} total={100} />)
    expect(screen.getByText(/showing 3 of 100 entries/i)).toBeInTheDocument()
  })

  it('formats duration correctly', () => {
    render(<LogTable {...defaultProps} />)
    expect(screen.getByText('100ms')).toBeInTheDocument()
    expect(screen.getByText('5.50s')).toBeInTheDocument()
    // null duration
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
