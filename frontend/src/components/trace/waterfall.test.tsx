/**
 * Tests for Waterfall component.
 *
 * Covers: empty state, row rendering, span selection, critical path
 * highlighting, duration bars, keyboard navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Waterfall, type WaterfallFilters } from './waterfall'
import type { SpanNode, WaterfallResponse } from '@/lib/api-types'

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

vi.mock('react-window', () => ({
  FixedSizeList: ({
    children: Children,
    itemCount,
  }: {
    children: React.ComponentType<{ index: number; style: React.CSSProperties; data: unknown }>
    itemCount: number
    itemData: unknown
  }) => (
    <div data-testid="fixed-size-list">
      {Array.from({ length: itemCount }, (_, i) => (
        <Children key={i} index={i} style={{}} data={null} />
      ))}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// makeSpan helper — shared across trace tests
// ---------------------------------------------------------------------------

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

function makeWaterfallResponse(spans: SpanNode[], totalDurationMs = 500): WaterfallResponse {
  return {
    trace_id: 'trace-abc',
    total_duration_ms: totalDurationMs,
    span_count: spans.length,
    error_count: 0,
    type_breakdown: { api_count: 1, sql_count: 0, filter_count: 0, esc_count: 0 },
    spans,
    flat_spans: spans,
    critical_path: [],
  }
}

const defaultFilters: WaterfallFilters = {
  logTypes: new Set(),
  minDurationMs: 0,
  errorsOnly: false,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Waterfall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders empty state when spans array is empty', () => {
    render(
      <Waterfall
        data={makeWaterfallResponse([])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByText(/no spans match the current filters/i)).toBeInTheDocument()
  })

  it('renders a row per span', () => {
    const spans = [makeSpan({ operation: 'GetEntry' }), makeSpan({ operation: 'SQLQuery' })]
    render(
      <Waterfall
        data={makeWaterfallResponse(spans)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
  })

  it('displays operation name for each span', () => {
    const spans = [makeSpan({ operation: 'GetEntry' }), makeSpan({ operation: 'SQLQuery' })]
    render(
      <Waterfall
        data={makeWaterfallResponse(spans)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByText('GetEntry')).toBeInTheDocument()
    expect(screen.getByText('SQLQuery')).toBeInTheDocument()
  })

  it('renders header row with timeline info', () => {
    const span = makeSpan()
    render(
      <Waterfall
        data={makeWaterfallResponse([span], 500)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByText('Span')).toBeInTheDocument()
    expect(screen.getByText(/500\.0 ms total/i)).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  it('clicking a span row calls onSelectSpan with the span', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ operation: 'GetEntry' })
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={onSelectSpan}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    await user.click(rows[0])
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('clicking the already-selected span calls onSelectSpan with null', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ id: 'span-selected' })
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-selected"
        onSelectSpan={onSelectSpan}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    await user.click(rows[0])
    expect(onSelectSpan).toHaveBeenCalledWith(null)
  })

  it('selected span row has aria-selected="true"', () => {
    const span = makeSpan({ id: 'span-sel' })
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-sel"
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('unselected span row has aria-selected="false"', () => {
    const span = makeSpan({ id: 'span-other' })
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-different"
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('shows critical path indicator when showCriticalPath is true and span is on critical path', () => {
    const criticalSpan = makeSpan({ on_critical_path: true })
    render(
      <Waterfall
        data={makeWaterfallResponse([criticalSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={true}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByLabelText('On critical path')).toBeInTheDocument()
  })

  it('does not show critical path indicator when showCriticalPath is false', () => {
    const criticalSpan = makeSpan({ on_critical_path: true })
    render(
      <Waterfall
        data={makeWaterfallResponse([criticalSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.queryByLabelText('On critical path')).not.toBeInTheDocument()
  })

  it('shows error indicator for spans with errors', () => {
    const errorSpan = makeSpan({ has_error: true, error_message: 'Timeout' })
    render(
      <Waterfall
        data={makeWaterfallResponse([errorSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByLabelText('Has error')).toBeInTheDocument()
  })

  it('renders duration label for each span', () => {
    const span = makeSpan({ duration_ms: 123.4 })
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByText('123.4 ms')).toBeInTheDocument()
  })

  it('shows log type badge for each span', () => {
    const sqlSpan = makeSpan({ log_type: 'SQL', operation: 'SelectQuery' })
    render(
      <Waterfall
        data={makeWaterfallResponse([sqlSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('activates Enter key to call onSelectSpan', () => {
    const onSelectSpan = vi.fn()
    const span = makeSpan()
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={onSelectSpan}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    fireEvent.keyDown(rows[0], { key: 'Enter' })
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('activates Space key to call onSelectSpan', () => {
    const onSelectSpan = vi.fn()
    const span = makeSpan()
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={onSelectSpan}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    const rows = screen.getAllByRole('row')
    fireEvent.keyDown(rows[0], { key: ' ' })
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('filters out spans by log type when logTypes filter is active', () => {
    const apiSpan = makeSpan({ log_type: 'API', operation: 'ApiOp' })
    const sqlSpan = makeSpan({ log_type: 'SQL', operation: 'SqlOp' })
    const filters: WaterfallFilters = {
      logTypes: new Set(['SQL']),
      minDurationMs: 0,
      errorsOnly: false,
    }
    render(
      <Waterfall
        data={makeWaterfallResponse([apiSpan, sqlSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={filters}
      />,
    )
    expect(screen.queryByText('ApiOp')).not.toBeInTheDocument()
    expect(screen.getByText('SqlOp')).toBeInTheDocument()
  })

  it('filters out spans below minDurationMs', () => {
    const shortSpan = makeSpan({ duration_ms: 5, operation: 'FastOp' })
    const longSpan = makeSpan({ duration_ms: 200, operation: 'SlowOp' })
    const filters: WaterfallFilters = {
      logTypes: new Set(),
      minDurationMs: 100,
      errorsOnly: false,
    }
    render(
      <Waterfall
        data={makeWaterfallResponse([shortSpan, longSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={filters}
      />,
    )
    expect(screen.queryByText('FastOp')).not.toBeInTheDocument()
    expect(screen.getByText('SlowOp')).toBeInTheDocument()
  })

  it('filters to errors-only when errorsOnly filter is active', () => {
    const okSpan = makeSpan({ has_error: false, operation: 'OkOp' })
    const errSpan = makeSpan({ has_error: true, operation: 'ErrOp' })
    const filters: WaterfallFilters = {
      logTypes: new Set(),
      minDurationMs: 0,
      errorsOnly: true,
    }
    render(
      <Waterfall
        data={makeWaterfallResponse([okSpan, errSpan])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={filters}
      />,
    )
    expect(screen.queryByText('OkOp')).not.toBeInTheDocument()
    expect(screen.getByText('ErrOp')).toBeInTheDocument()
  })

  it('renders the virtual list container with aria-label', () => {
    const span = makeSpan()
    render(
      <Waterfall
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
        showCriticalPath={false}
        filters={defaultFilters}
      />,
    )
    expect(screen.getByRole('table', { name: /trace waterfall/i })).toBeInTheDocument()
  })
})
