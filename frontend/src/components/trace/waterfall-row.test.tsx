/**
 * Tests for WaterfallRowStandalone component.
 *
 * Covers: operation name, log type badge, duration display, click handler,
 * keyboard navigation (Enter/Space), error indicator, critical path styling,
 * custom className, depth indentation, connector character, tabIndex behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WaterfallRowStandalone } from './waterfall-row'
import type { SpanNode } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants')>()
  return {
    ...actual,
    LOG_TYPE_COLORS: {
      API: { bg: '#4f46e5', text: '#fff', label: 'API', description: 'AR Server API calls' },
      SQL: { bg: '#10b981', text: '#fff', label: 'SQL', description: 'SQL queries' },
      FLTR: { bg: '#f59e0b', text: '#000', label: 'FLTR', description: 'Filter executions' },
      ESCL: { bg: '#8b5cf6', text: '#fff', label: 'ESCL', description: 'Escalations' },
    },
  }
})

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

describe('WaterfallRowStandalone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders operation name', () => {
    const span = makeSpan({ operation: 'GetEntry' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('GetEntry')).toBeInTheDocument()
  })

  it('renders operation name as text content', () => {
    const span = makeSpan({ operation: 'CreateEntry' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('CreateEntry')).toBeInTheDocument()
  })

  it('falls back to truncated span id when operation is empty string', () => {
    const span = makeSpan({ id: 'abcdefgh1234', operation: '' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('abcdefgh')).toBeInTheDocument()
  })

  it('renders the log type badge for API span', () => {
    const span = makeSpan({ log_type: 'API' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('API')).toBeInTheDocument()
  })

  it('renders the log type badge for SQL span', () => {
    const span = makeSpan({ log_type: 'SQL' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('renders the log type badge for FLTR span', () => {
    const span = makeSpan({ log_type: 'FLTR' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('FLTR')).toBeInTheDocument()
  })

  it('renders the log type badge for ESCL span', () => {
    const span = makeSpan({ log_type: 'ESCL' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('ESCL')).toBeInTheDocument()
  })

  it('renders duration formatted to 1 decimal place with "ms" suffix', () => {
    const span = makeSpan({ duration_ms: 123.4 })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('123.4 ms')).toBeInTheDocument()
  })

  it('renders duration of 0.0 ms correctly', () => {
    const span = makeSpan({ duration_ms: 0 })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('0.0 ms')).toBeInTheDocument()
  })

  it('renders duration of 999.9 ms correctly', () => {
    const span = makeSpan({ duration_ms: 999.9 })
    render(<WaterfallRowStandalone span={span} totalDurationMs={1000} />)
    expect(screen.getByText('999.9 ms')).toBeInTheDocument()
  })

  it('clicking the row calls onClick with the span', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan({ operation: 'GetEntry' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} onClick={onClick} />)
    const row = screen.getByRole('row')
    await user.click(row)
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(span)
  })

  it('pressing Enter key calls onClick with the span', () => {
    const onClick = vi.fn()
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} onClick={onClick} />)
    const row = screen.getByRole('row')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(span)
  })

  it('pressing Space key calls onClick with the span', () => {
    const onClick = vi.fn()
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} onClick={onClick} />)
    const row = screen.getByRole('row')
    fireEvent.keyDown(row, { key: ' ' })
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(span)
  })

  it('pressing other keys does not call onClick', () => {
    const onClick = vi.fn()
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} onClick={onClick} />)
    const row = screen.getByRole('row')
    fireEvent.keyDown(row, { key: 'ArrowDown' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders error indicator when has_error is true', () => {
    const span = makeSpan({ has_error: true, error_message: 'Timeout error' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByLabelText('Error')).toBeInTheDocument()
  })

  it('error indicator has title equal to the error message', () => {
    const span = makeSpan({ has_error: true, error_message: 'Connection refused' })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByTitle('Connection refused')).toBeInTheDocument()
  })

  it('error indicator title falls back to "Error" when error_message is null', () => {
    const span = makeSpan({ has_error: true, error_message: null })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByTitle('Error')).toBeInTheDocument()
  })

  it('does not render error indicator when has_error is false', () => {
    const span = makeSpan({ has_error: false })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.queryByLabelText('Error')).not.toBeInTheDocument()
  })

  it('applies amber background class when showCriticalPath is true and span is on critical path', () => {
    const span = makeSpan({ on_critical_path: true })
    const { container } = render(
      <WaterfallRowStandalone span={span} totalDurationMs={500} showCriticalPath={true} />,
    )
    expect(container.firstChild).toHaveClass('bg-amber-50/60')
  })

  it('does not apply amber background when showCriticalPath is false even on critical path', () => {
    const span = makeSpan({ on_critical_path: true })
    const { container } = render(
      <WaterfallRowStandalone span={span} totalDurationMs={500} showCriticalPath={false} />,
    )
    expect(container.firstChild).not.toHaveClass('bg-amber-50/60')
  })

  it('does not apply amber background when span is not on critical path', () => {
    const span = makeSpan({ on_critical_path: false })
    const { container } = render(
      <WaterfallRowStandalone span={span} totalDurationMs={500} showCriticalPath={true} />,
    )
    expect(container.firstChild).not.toHaveClass('bg-amber-50/60')
  })

  it('applies custom className to root element', () => {
    const span = makeSpan()
    const { container } = render(
      <WaterfallRowStandalone span={span} totalDurationMs={500} className="my-custom-class" />,
    )
    expect(container.firstChild).toHaveClass('my-custom-class')
  })

  it('renders indentation for span with depth > 0', () => {
    const span = makeSpan({ depth: 2 })
    const { container } = render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    // depth=2 → paddingLeft = 2*16 = 32px
    const indentContainer = container.querySelector('[style*="padding-left: 32px"]')
    expect(indentContainer).toBeInTheDocument()
  })

  it('renders no indentation padding for depth 0 span', () => {
    const span = makeSpan({ depth: 0 })
    const { container } = render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    // depth=0 → paddingLeft = 0px
    const indentContainer = container.querySelector('[style*="padding-left: 0px"]')
    expect(indentContainer).toBeInTheDocument()
  })

  it('renders connector character "└" for nested spans (depth > 0)', () => {
    const span = makeSpan({ depth: 1 })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByText('└')).toBeInTheDocument()
  })

  it('does not render connector character for root-level spans (depth === 0)', () => {
    const span = makeSpan({ depth: 0 })
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.queryByText('└')).not.toBeInTheDocument()
  })

  it('has tabIndex=0 when onClick is provided', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} onClick={vi.fn()} />)
    const row = screen.getByRole('row')
    expect(row).toHaveAttribute('tabindex', '0')
  })

  it('has no tabIndex when onClick is omitted', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    const row = screen.getByRole('row')
    expect(row).not.toHaveAttribute('tabindex')
  })

  it('has role="row" on the root element', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByRole('row')).toBeInTheDocument()
  })

  it('has aria-selected="true" when isSelected is true', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} isSelected={true} />)
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true')
  })

  it('has aria-selected="false" when isSelected is false', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} isSelected={false} />)
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'false')
  })

  it('has aria-selected="false" by default (isSelected not provided)', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'false')
  })

  it('does not call onClick when onClick is not provided (no handler attached)', () => {
    const span = makeSpan()
    render(<WaterfallRowStandalone span={span} totalDurationMs={500} />)
    const row = screen.getByRole('row')
    // Should not throw when clicking a non-interactive row
    expect(() => fireEvent.click(row)).not.toThrow()
  })
})
