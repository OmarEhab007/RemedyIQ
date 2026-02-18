/**
 * Tests for SpanDetail component.
 *
 * Covers: null span renders nothing, operation name, timing info,
 * log type badge, error banner, raw fields, close button behavior,
 * Escape key closes panel, critical path indicator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpanDetail } from './span-detail'
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
    start_offset_ms: 25.5,
    duration_ms: 150.75,
    fields: {},
    children: [],
    on_critical_path: false,
    has_error: false,
    timestamp: '2025-01-15T10:30:00.000Z',
    thread_id: 'thread-42',
    trace_id: 'trace-xyz',
    user: 'john.doe',
    queue: 'Queue-Default',
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

describe('SpanDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders nothing when span is null', () => {
    const { container } = render(<SpanDetail span={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders span operation name in the header', () => {
    const span = makeSpan({ operation: 'GetEntry' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    // 'GetEntry' appears in header span and in the Operation field row
    const matches = screen.getAllByText('GetEntry')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to "Span" label when operation is empty', () => {
    const span = makeSpan({ operation: '' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('Span')).toBeInTheDocument()
  })

  it('renders log type badge in the header', () => {
    const span = makeSpan({ log_type: 'SQL' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    // Header badge + Operation field value — there will be multiple "SQL" labels
    const badges = screen.getAllByText('SQL')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders duration in the details section', () => {
    const span = makeSpan({ duration_ms: 150.75 })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('150.75 ms')).toBeInTheDocument()
  })

  it('renders start offset in the details section', () => {
    const span = makeSpan({ start_offset_ms: 25.5 })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('25.50 ms')).toBeInTheDocument()
  })

  it('renders user field', () => {
    const span = makeSpan({ user: 'jane.smith' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('jane.smith')).toBeInTheDocument()
  })

  it('renders queue field', () => {
    const span = makeSpan({ queue: 'AR-Queue' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('AR-Queue')).toBeInTheDocument()
  })

  it('renders thread ID', () => {
    const span = makeSpan({ thread_id: 'thr-007' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('thr-007')).toBeInTheDocument()
  })

  it('renders trace ID', () => {
    const span = makeSpan({ trace_id: 'trace-xyz-999' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('trace-xyz-999')).toBeInTheDocument()
  })

  it('renders form field when provided', () => {
    const span = makeSpan({ form: 'HPD:Help_Desk' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('HPD:Help_Desk')).toBeInTheDocument()
  })

  it('does not render form row when form is null', () => {
    const span = makeSpan({ form: null })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByText(/form/i)).not.toBeInTheDocument()
  })

  it('shows success status as "Yes" in green', () => {
    const span = makeSpan({ success: true })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows failure status as "No" in red', () => {
    const span = makeSpan({ success: false })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('shows error banner when has_error is true and error_message is set', () => {
    const span = makeSpan({ has_error: true, error_message: 'Connection timed out' })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Connection timed out')).toBeInTheDocument()
  })

  it('does not show error banner when has_error is false', () => {
    const span = makeSpan({ has_error: false, error_message: null })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show error banner when has_error is true but error_message is null', () => {
    const span = makeSpan({ has_error: true, error_message: null })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows critical path indicator when on_critical_path is true', () => {
    const span = makeSpan({ on_critical_path: true, success: false })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    // The "Critical Path" field row label appears
    expect(screen.getByText(/critical path/i)).toBeInTheDocument()
    // The value for the critical path field row is "Yes" in amber
    const yesElements = screen.getAllByText('Yes')
    expect(yesElements.some((el) => el.className.includes('amber'))).toBe(true)
  })

  it('does not show critical path row when on_critical_path is false', () => {
    const span = makeSpan({ on_critical_path: false })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByText(/critical path/i)).not.toBeInTheDocument()
  })

  it('renders raw field key-value pairs when fields are present', () => {
    const span = makeSpan({ fields: { rpc_id: 'rpc-001', level: 3 } })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('Raw Fields')).toBeInTheDocument()
    expect(screen.getByText('rpc_id:')).toBeInTheDocument()
    expect(screen.getByText('rpc-001')).toBeInTheDocument()
    expect(screen.getByText('level:')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('omits null and empty-string fields from raw fields', () => {
    const span = makeSpan({ fields: { empty: '', nullField: null, valid: 'ok' } })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByText('empty:')).not.toBeInTheDocument()
    expect(screen.queryByText('nullField:')).not.toBeInTheDocument()
    expect(screen.getByText('valid:')).toBeInTheDocument()
  })

  it('does not render Raw Fields section when fields object is empty', () => {
    const span = makeSpan({ fields: {} })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.queryByText('Raw Fields')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const span = makeSpan()
    render(<SpanDetail span={span} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close span details/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed on the aside', () => {
    const onClose = vi.fn()
    const span = makeSpan()
    render(<SpanDetail span={span} onClose={onClose} />)
    const aside = screen.getByRole('complementary')
    fireEvent.keyDown(aside, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on other key presses', () => {
    const onClose = vi.fn()
    const span = makeSpan()
    render(<SpanDetail span={span} onClose={onClose} />)
    const aside = screen.getByRole('complementary')
    fireEvent.keyDown(aside, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has accessible aside with aria-label', () => {
    const span = makeSpan()
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByRole('complementary', { name: /span details/i })).toBeInTheDocument()
  })

  it('renders boolean field values as strings', () => {
    const span = makeSpan({ fields: { active: true } })
    render(<SpanDetail span={span} onClose={vi.fn()} />)
    expect(screen.getByText('true')).toBeInTheDocument()
  })
})
