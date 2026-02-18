/**
 * Tests for TraceFilters component.
 *
 * Covers: log type checkboxes, min duration slider, errors-only toggle,
 * onChange callbacks, reset button behavior, span count display,
 * active filter detection, and aria attributes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TraceFilters } from './trace-filters'
import type { WaterfallFilters } from './waterfall'
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
// Helpers
// ---------------------------------------------------------------------------

function makeFilters(overrides: Partial<WaterfallFilters> = {}): WaterfallFilters {
  return {
    logTypes: new Set(),
    minDurationMs: 0,
    errorsOnly: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders the filter group with aria-label', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: /trace filters/i })).toBeInTheDocument()
  })

  it('renders all four log type checkboxes', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/filter api spans/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter sql spans/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter fltr spans/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter escl spans/i)).toBeInTheDocument()
  })

  it('renders log type label text (API, SQL, FLTR, ESCL)', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('FLTR')).toBeInTheDocument()
    expect(screen.getByText('ESCL')).toBeInTheDocument()
  })

  it('log type checkboxes are unchecked when logTypes set is empty', () => {
    render(<TraceFilters filters={makeFilters({ logTypes: new Set() })} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/filter api spans/i)).not.toBeChecked()
    expect(screen.getByLabelText(/filter sql spans/i)).not.toBeChecked()
  })

  it('log type checkbox is checked when type is in the logTypes set', () => {
    render(
      <TraceFilters
        filters={makeFilters({ logTypes: new Set(['API']) })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/filter api spans/i)).toBeChecked()
    expect(screen.getByLabelText(/filter sql spans/i)).not.toBeChecked()
  })

  it('clicking an unchecked log type checkbox adds it to the set and calls onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TraceFilters filters={makeFilters()} onChange={onChange} />)
    await user.click(screen.getByLabelText(/filter api spans/i))
    expect(onChange).toHaveBeenCalledOnce()
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.logTypes.has('API')).toBe(true)
  })

  it('clicking a checked log type checkbox removes it from the set and calls onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TraceFilters
        filters={makeFilters({ logTypes: new Set(['SQL']) })}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByLabelText(/filter sql spans/i))
    expect(onChange).toHaveBeenCalledOnce()
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.logTypes.has('SQL')).toBe(false)
  })

  it('renders min duration range slider', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider', { name: /minimum duration/i })
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '5000')
  })

  it('slider reflects current minDurationMs value', () => {
    render(<TraceFilters filters={makeFilters({ minDurationMs: 250 })} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider', { name: /minimum duration/i })
    expect(slider).toHaveValue('250')
  })

  it('slider has correct aria-valuenow', () => {
    render(<TraceFilters filters={makeFilters({ minDurationMs: 500 })} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider', { name: /minimum duration/i })
    expect(slider).toHaveAttribute('aria-valuenow', '500')
  })

  it('changing slider calls onChange with updated minDurationMs', () => {
    const onChange = vi.fn()
    render(<TraceFilters filters={makeFilters()} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: /minimum duration/i })
    fireEvent.change(slider, { target: { value: '1000' } })
    expect(onChange).toHaveBeenCalledOnce()
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.minDurationMs).toBe(1000)
  })

  it('displays current min duration value as text', () => {
    render(<TraceFilters filters={makeFilters({ minDurationMs: 750 })} onChange={vi.fn()} />)
    expect(screen.getByText('750 ms')).toBeInTheDocument()
  })

  it('renders errors-only checkbox', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /errors only/i })).toBeInTheDocument()
  })

  it('errors-only checkbox is unchecked when errorsOnly is false', () => {
    render(<TraceFilters filters={makeFilters({ errorsOnly: false })} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /errors only/i })).not.toBeChecked()
  })

  it('errors-only checkbox is checked when errorsOnly is true', () => {
    render(<TraceFilters filters={makeFilters({ errorsOnly: true })} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /errors only/i })).toBeChecked()
  })

  it('clicking errors-only checkbox calls onChange with toggled errorsOnly', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TraceFilters filters={makeFilters({ errorsOnly: false })} onChange={onChange} />)
    await user.click(screen.getByRole('checkbox', { name: /errors only/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.errorsOnly).toBe(true)
  })

  it('does not show Reset button when no filters are active', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  it('shows Reset button when logTypes filter is active', () => {
    render(
      <TraceFilters
        filters={makeFilters({ logTypes: new Set(['API']) })}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('shows Reset button when minDurationMs filter is active', () => {
    render(
      <TraceFilters filters={makeFilters({ minDurationMs: 100 })} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('shows Reset button when errorsOnly filter is active', () => {
    render(
      <TraceFilters filters={makeFilters({ errorsOnly: true })} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('clicking Reset button calls onChange with cleared filters', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TraceFilters
        filters={makeFilters({ logTypes: new Set(['API']), minDurationMs: 500, errorsOnly: true })}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.logTypes.size).toBe(0)
    expect(updatedFilters.minDurationMs).toBe(0)
    expect(updatedFilters.errorsOnly).toBe(false)
  })

  it('renders span count when totalSpans is provided', () => {
    render(
      <TraceFilters filters={makeFilters()} onChange={vi.fn()} totalSpans={42} />,
    )
    expect(screen.getByText('42 spans')).toBeInTheDocument()
  })

  it('renders singular "span" when totalSpans is 1', () => {
    render(
      <TraceFilters filters={makeFilters()} onChange={vi.fn()} totalSpans={1} />,
    )
    expect(screen.getByText('1 span')).toBeInTheDocument()
  })

  it('does not render span count when totalSpans is undefined', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    expect(screen.queryByText(/\d+ spans?/)).not.toBeInTheDocument()
  })

  it('fieldset has sr-only legend for screen readers', () => {
    render(<TraceFilters filters={makeFilters()} onChange={vi.fn()} />)
    const legend = screen.getByText('Log types')
    expect(legend.tagName.toLowerCase()).toBe('legend')
    expect(legend).toHaveClass('sr-only')
  })

  it('preserves other filter values when toggling log type', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const initialFilters = makeFilters({ minDurationMs: 200, errorsOnly: true })
    render(<TraceFilters filters={initialFilters} onChange={onChange} />)
    await user.click(screen.getByLabelText(/filter sql spans/i))
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.minDurationMs).toBe(200)
    expect(updatedFilters.errorsOnly).toBe(true)
  })

  it('preserves other filter values when changing min duration', () => {
    const onChange = vi.fn()
    const initialFilters = makeFilters({ logTypes: new Set(['API']), errorsOnly: true })
    render(<TraceFilters filters={initialFilters} onChange={onChange} />)
    const slider = screen.getByRole('slider', { name: /minimum duration/i })
    fireEvent.change(slider, { target: { value: '300' } })
    const [updatedFilters] = onChange.mock.calls[0] as [WaterfallFilters]
    expect(updatedFilters.logTypes.has('API')).toBe(true)
    expect(updatedFilters.errorsOnly).toBe(true)
  })
})
