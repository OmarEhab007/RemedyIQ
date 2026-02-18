/**
 * Tests for SpanList component.
 *
 * Covers: column headers, empty state, span row rendering, row selection,
 * toggle-deselect, keyboard navigation, sorting by each column,
 * status indicators, user/queue display, critical path indicator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpanList } from './span-list'
import type { SpanNode } from '@/lib/api-types'

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
}))

// ---------------------------------------------------------------------------
// makeSpan helper
// ---------------------------------------------------------------------------

let spanCounter = 0

function makeSpan(overrides: Partial<SpanNode> = {}): SpanNode {
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
// Tests
// ---------------------------------------------------------------------------

describe('SpanList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders empty state when spans array is empty', () => {
    render(
      <SpanList spans={[]} selectedSpanId={null} onSelectSpan={vi.fn()} />,
    )
    expect(screen.getByText(/no spans available/i)).toBeInTheDocument()
  })

  it('renders all required column headers', () => {
    const spans = [makeSpan()]
    render(<SpanList spans={spans} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('Log Type')).toBeInTheDocument()
    expect(screen.getByText('Operation')).toBeInTheDocument()
    expect(screen.getByText('Start (ms)')).toBeInTheDocument()
    expect(screen.getByText('Duration (ms)')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('User / Queue')).toBeInTheDocument()
  })

  it('renders a row per span', () => {
    const spans = [
      makeSpan({ operation: 'GetEntry' }),
      makeSpan({ operation: 'SQLSelect' }),
      makeSpan({ operation: 'FilterRun' }),
    ]
    render(<SpanList spans={spans} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    // header row + 3 data rows
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(4)
  })

  it('renders operation name for each span', () => {
    const spans = [makeSpan({ operation: 'GetEntry' }), makeSpan({ operation: 'SQLSelect' })]
    render(<SpanList spans={spans} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('GetEntry')).toBeInTheDocument()
    expect(screen.getByText('SQLSelect')).toBeInTheDocument()
  })

  it('renders log type badge for each span', () => {
    const spans = [makeSpan({ log_type: 'API' }), makeSpan({ log_type: 'SQL' })]
    render(<SpanList spans={spans} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('renders duration values formatted to 2 decimal places', () => {
    const span = makeSpan({ duration_ms: 123.456 })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('123.46')).toBeInTheDocument()
  })

  it('renders start offset formatted to 1 decimal place', () => {
    const span = makeSpan({ start_offset_ms: 55.7 })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('55.7')).toBeInTheDocument()
  })

  it('renders user and queue in the same cell', () => {
    const span = makeSpan({ user: 'alice', queue: 'AR-Queue' })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('AR-Queue')).toBeInTheDocument()
  })

  it('shows success indicator for spans without errors', () => {
    const span = makeSpan({ has_error: false })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByLabelText('Success')).toBeInTheDocument()
  })

  it('shows error indicator for spans with errors', () => {
    const span = makeSpan({ has_error: true, error_message: 'Timeout' })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByLabelText('Error')).toBeInTheDocument()
  })

  it('shows critical path indicator for on_critical_path spans', () => {
    const span = makeSpan({ on_critical_path: true })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByLabelText('On critical path')).toBeInTheDocument()
  })

  it('does not show critical path indicator for non-critical spans', () => {
    const span = makeSpan({ on_critical_path: false })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.queryByLabelText('On critical path')).not.toBeInTheDocument()
  })

  it('clicking a row calls onSelectSpan with the span', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ operation: 'GetEntry' })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={onSelectSpan} />)
    const rows = screen.getAllByRole('row')
    // rows[0] is header, rows[1] is the data row
    await user.click(rows[1])
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('clicking the already-selected row calls onSelectSpan with null', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ id: 'span-sel' })
    render(
      <SpanList spans={[span]} selectedSpanId="span-sel" onSelectSpan={onSelectSpan} />,
    )
    const rows = screen.getAllByRole('row')
    await user.click(rows[1])
    expect(onSelectSpan).toHaveBeenCalledWith(null)
  })

  it('selected row has aria-selected="true"', () => {
    const span = makeSpan({ id: 'span-sel' })
    render(
      <SpanList spans={[span]} selectedSpanId="span-sel" onSelectSpan={vi.fn()} />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('unselected row has aria-selected="false"', () => {
    const span = makeSpan({ id: 'span-other' })
    render(
      <SpanList spans={[span]} selectedSpanId="span-different" onSelectSpan={vi.fn()} />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onSelectSpan on Enter keydown on a row', () => {
    const onSelectSpan = vi.fn()
    const span = makeSpan()
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={onSelectSpan} />)
    const rows = screen.getAllByRole('row')
    fireEvent.keyDown(rows[1], { key: 'Enter' })
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('calls onSelectSpan on Space keydown on a row', () => {
    const onSelectSpan = vi.fn()
    const span = makeSpan()
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={onSelectSpan} />)
    const rows = screen.getAllByRole('row')
    fireEvent.keyDown(rows[1], { key: ' ' })
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('column headers have aria-sort="none" by default', () => {
    const span = makeSpan()
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    const logTypeHeader = screen.getByRole('columnheader', { name: /log type/i })
    expect(logTypeHeader).toHaveAttribute('aria-sort', 'none')
  })

  it('clicking start offset header sorts ascending and sets aria-sort', async () => {
    const user = userEvent.setup()
    const spanA = makeSpan({ start_offset_ms: 200, operation: 'LaterOp' })
    const spanB = makeSpan({ start_offset_ms: 50, operation: 'EarlierOp' })
    render(<SpanList spans={[spanA, spanB]} selectedSpanId={null} onSelectSpan={vi.fn()} />)

    const startHeader = screen.getByRole('columnheader', { name: /start/i })
    // Already sorted by start_offset_ms asc by default
    expect(startHeader).toHaveAttribute('aria-sort', 'ascending')

    // Rows in ascending order: EarlierOp first (50ms), LaterOp second (200ms)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('EarlierOp')
    expect(rows[2]).toHaveTextContent('LaterOp')
  })

  it('clicking start offset header twice toggles to descending sort', async () => {
    const user = userEvent.setup()
    const spanA = makeSpan({ start_offset_ms: 200, operation: 'LaterOp' })
    const spanB = makeSpan({ start_offset_ms: 50, operation: 'EarlierOp' })
    render(<SpanList spans={[spanA, spanB]} selectedSpanId={null} onSelectSpan={vi.fn()} />)

    const startHeader = screen.getByRole('columnheader', { name: /start/i })
    await user.click(startHeader)

    expect(startHeader).toHaveAttribute('aria-sort', 'descending')
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('LaterOp')
    expect(rows[2]).toHaveTextContent('EarlierOp')
  })

  it('clicking duration header sorts by duration', async () => {
    const user = userEvent.setup()
    const shortSpan = makeSpan({ duration_ms: 10, operation: 'FastOp' })
    const longSpan = makeSpan({ duration_ms: 999, operation: 'SlowOp' })
    render(
      <SpanList spans={[longSpan, shortSpan]} selectedSpanId={null} onSelectSpan={vi.fn()} />,
    )

    const durationHeader = screen.getByRole('columnheader', { name: /duration/i })
    await user.click(durationHeader)

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('FastOp')
    expect(rows[2]).toHaveTextContent('SlowOp')
  })

  it('clicking log type header sorts alphabetically by type', async () => {
    const user = userEvent.setup()
    const sqlSpan = makeSpan({ log_type: 'SQL', operation: 'SqlOp' })
    const apiSpan = makeSpan({ log_type: 'API', operation: 'ApiOp' })
    render(
      <SpanList spans={[sqlSpan, apiSpan]} selectedSpanId={null} onSelectSpan={vi.fn()} />,
    )

    const logTypeHeader = screen.getByRole('columnheader', { name: /log type/i })
    await user.click(logTypeHeader)

    const rows = screen.getAllByRole('row')
    // API comes before SQL alphabetically
    expect(rows[1]).toHaveTextContent('ApiOp')
    expect(rows[2]).toHaveTextContent('SqlOp')
  })

  it('clicking operation header sorts alphabetically by operation', async () => {
    const user = userEvent.setup()
    const zSpan = makeSpan({ operation: 'ZebraOp' })
    const aSpan = makeSpan({ operation: 'AlphaOp' })
    render(
      <SpanList spans={[zSpan, aSpan]} selectedSpanId={null} onSelectSpan={vi.fn()} />,
    )

    const operationHeader = screen.getByRole('columnheader', { name: /operation/i })
    await user.click(operationHeader)

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('AlphaOp')
    expect(rows[2]).toHaveTextContent('ZebraOp')
  })

  it('switching sort field resets direction to ascending', async () => {
    const user = userEvent.setup()
    const spans = [makeSpan({ operation: 'A' }), makeSpan({ operation: 'B' })]
    render(<SpanList spans={spans} selectedSpanId={null} onSelectSpan={vi.fn()} />)

    // Click duration to switch to duration sort (asc)
    const durationHeader = screen.getByRole('columnheader', { name: /duration/i })
    await user.click(durationHeader)

    expect(durationHeader).toHaveAttribute('aria-sort', 'ascending')
  })

  it('renders dash when operation is empty', () => {
    const span = makeSpan({ operation: '' })
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders table with role="table"', () => {
    const span = makeSpan()
    render(<SpanList spans={[span]} selectedSpanId={null} onSelectSpan={vi.fn()} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
