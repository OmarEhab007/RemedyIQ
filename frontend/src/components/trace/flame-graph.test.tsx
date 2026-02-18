/**
 * Tests for FlameGraph component.
 *
 * Covers: empty state, span buttons rendered, selection/deselection,
 * aria-pressed state, operation labels, time axis, legend, nested children.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlameGraph } from './flame-graph'
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlameGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders empty state when spans array is empty', () => {
    render(
      <FlameGraph
        data={makeWaterfallResponse([])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    expect(screen.getByText(/no span data available/i)).toBeInTheDocument()
  })

  it('renders a button for each top-level span', () => {
    const spans = [
      makeSpan({ operation: 'GetEntry' }),
      makeSpan({ operation: 'SQLSelect' }),
    ]
    render(
      <FlameGraph
        data={makeWaterfallResponse(spans)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    // Each span becomes a button
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
  })

  it('renders span buttons for nested children', () => {
    const child = makeSpan({ operation: 'ChildOp', depth: 1 })
    const parent = makeSpan({ operation: 'ParentOp', depth: 0, children: [child] })
    render(
      <FlameGraph
        data={makeWaterfallResponse([parent])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    // parent + child = 2 buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
  })

  it('span button has accessible aria-label with operation and duration', () => {
    const span = makeSpan({ operation: 'GetEntry', log_type: 'API', duration_ms: 123.4 })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    const button = screen.getByRole('button', { name: /getentry/i })
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('GetEntry'))
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('API'))
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('123.4'))
  })

  it('span button has title with operation and duration', () => {
    const span = makeSpan({ operation: 'GetEntry', duration_ms: 50.0 })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', expect.stringContaining('GetEntry'))
    expect(button).toHaveAttribute('title', expect.stringContaining('50.0'))
  })

  it('non-selected span button has aria-pressed="false"', () => {
    const span = makeSpan({ id: 'span-a' })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-b"
        onSelectSpan={vi.fn()}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('selected span button has aria-pressed="true"', () => {
    const span = makeSpan({ id: 'span-sel' })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-sel"
        onSelectSpan={vi.fn()}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking a span button calls onSelectSpan with the span', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ operation: 'GetEntry' })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={onSelectSpan}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onSelectSpan).toHaveBeenCalledWith(span)
  })

  it('clicking the already-selected span calls onSelectSpan with null', async () => {
    const onSelectSpan = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ id: 'span-sel' })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId="span-sel"
        onSelectSpan={onSelectSpan}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onSelectSpan).toHaveBeenCalledWith(null)
  })

  it('renders the flame graph container with aria-label', () => {
    const span = makeSpan()
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    expect(screen.getByRole('img', { name: /flame graph/i })).toBeInTheDocument()
  })

  it('renders group container with span count and level info', () => {
    const span = makeSpan()
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    const group = screen.getByRole('group')
    expect(group).toHaveAttribute('aria-label', expect.stringContaining('1 spans'))
    expect(group).toHaveAttribute('aria-label', expect.stringContaining('1 levels'))
  })

  it('renders time axis with 0 ms and total duration labels', () => {
    const span = makeSpan()
    render(
      <FlameGraph
        data={makeWaterfallResponse([span], 400)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    expect(screen.getByText('0 ms')).toBeInTheDocument()
    expect(screen.getByText('400 ms')).toBeInTheDocument()
    // Midpoint label
    expect(screen.getByText('200 ms')).toBeInTheDocument()
  })

  it('renders legend with log type entries', () => {
    const span = makeSpan()
    render(
      <FlameGraph
        data={makeWaterfallResponse([span])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    // Legend shows all four log type labels
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('FLTR')).toBeInTheDocument()
    expect(screen.getByText('ESCL')).toBeInTheDocument()
  })

  it('renders operation text label inside button when span width is wide enough', () => {
    // A span that takes up 100% of a 500ms trace will be wide enough for a label
    const span = makeSpan({ operation: 'WideOperation', duration_ms: 500, start_offset_ms: 0 })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span], 500)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    expect(screen.getByText('WideOperation')).toBeInTheDocument()
  })

  it('uses log_type as fallback label when operation is empty', () => {
    const span = makeSpan({ operation: '', log_type: 'SQL', duration_ms: 500 })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span], 500)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    // SQL appears as the label inside the span button text (not just the legend)
    const sqlTexts = screen.getAllByText('SQL')
    expect(sqlTexts.length).toBeGreaterThanOrEqual(2) // button text + legend
  })

  it('renders multiple spans at different depths without crashing', () => {
    const root = makeSpan({ depth: 0, operation: 'Root' })
    const level1 = makeSpan({ depth: 1, operation: 'Level1', parent_id: root.id })
    const level2 = makeSpan({ depth: 2, operation: 'Level2', parent_id: level1.id })
    root.children = [level1]
    level1.children = [level2]

    render(
      <FlameGraph
        data={makeWaterfallResponse([root])}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders spans with zero total duration as empty state', () => {
    const span = makeSpan({ duration_ms: 0 })
    render(
      <FlameGraph
        data={makeWaterfallResponse([span], 0)}
        selectedSpanId={null}
        onSelectSpan={vi.fn()}
      />,
    )
    // positionSpans returns nothing when totalDurationMs <= 0
    expect(screen.getByText(/no span data available/i)).toBeInTheDocument()
  })
})
