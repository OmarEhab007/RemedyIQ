/**
 * Tests for CriticalPathToggle component.
 *
 * Covers: toggle button rendering, aria-checked state, toggle behavior,
 * critical path stats display, legend visibility, duration percentage,
 * keyboard activation, onChange callback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CriticalPathToggle } from './critical-path'
import type { SpanNode } from '@/lib/api-types'

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
// Tests
// ---------------------------------------------------------------------------

describe('CriticalPathToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spanCounter = 0
  })

  it('renders the toggle button', () => {
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.getByRole('switch', { name: /highlight critical path/i })).toBeInTheDocument()
  })

  it('button has aria-checked="false" when disabled', () => {
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(
      screen.getByRole('switch', { name: /highlight critical path/i }),
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('button has aria-checked="true" when enabled', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(
      screen.getByRole('switch', { name: /highlight critical path/i }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('renders "Critical Path" button label text', () => {
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.getByText('Critical Path')).toBeInTheDocument()
  })

  it('clicking the button calls onChange with true when currently disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={onChange}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    await user.click(screen.getByRole('switch', { name: /highlight critical path/i }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('clicking the button calls onChange with false when currently enabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={onChange}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    await user.click(screen.getByRole('switch', { name: /highlight critical path/i }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('Enter key calls onChange with toggled value', () => {
    const onChange = vi.fn()
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={onChange}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('Space key calls onChange with toggled value', () => {
    const onChange = vi.fn()
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={onChange}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('other keys do not trigger onChange', () => {
    const onChange = vi.fn()
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={onChange}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not show critical span stats when disabled', () => {
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.queryByText(/3/)).not.toBeInTheDocument()
    expect(screen.queryByText(/10 spans/)).not.toBeInTheDocument()
  })

  it('shows critical span count and total when enabled', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/10 spans/)).toBeInTheDocument()
  })

  it('shows aria-live region when enabled with spans', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={4}
        totalSpanCount={15}
      />,
    )
    // The stats div has aria-live="polite" and aria-label describing the counts
    const statsEl = screen.getByLabelText(/critical path: 4 of 15 spans/i)
    expect(statsEl).toBeInTheDocument()
    expect(statsEl).toHaveAttribute('aria-live', 'polite')
  })

  it('shows duration percentage when criticalDurationMs and totalDurationMs are provided', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
        criticalDurationMs={300}
        totalDurationMs={1000}
      />,
    )
    // 300/1000 = 30%
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText(/of total time/i)).toBeInTheDocument()
  })

  it('does not show percentage when criticalDurationMs is not provided', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
        totalDurationMs={1000}
      />,
    )
    expect(screen.queryByText(/of total time/i)).not.toBeInTheDocument()
  })

  it('does not show percentage when totalDurationMs is not provided', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
        criticalDurationMs={300}
      />,
    )
    expect(screen.queryByText(/of total time/i)).not.toBeInTheDocument()
  })

  it('does not show legend when disabled', () => {
    render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.queryByText(/on critical path/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/other spans/i)).not.toBeInTheDocument()
  })

  it('shows legend when enabled', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
      />,
    )
    expect(screen.getByText(/on critical path/i)).toBeInTheDocument()
    expect(screen.getByText(/other spans/i)).toBeInTheDocument()
  })

  it('does not show stats when criticalSpanCount is 0 even if enabled', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={0}
        totalSpanCount={10}
      />,
    )
    // Stats section is hidden when criticalSpanCount === 0
    expect(screen.queryByLabelText(/critical path: 0 of/i)).not.toBeInTheDocument()
  })

  it('renders correctly with zero total spans', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={0}
        totalSpanCount={0}
      />,
    )
    // Should not throw — legend still shows
    expect(screen.getByText(/on critical path/i)).toBeInTheDocument()
  })

  it('percentage is rounded to nearest integer', () => {
    render(
      <CriticalPathToggle
        enabled={true}
        onChange={vi.fn()}
        criticalSpanCount={3}
        totalSpanCount={10}
        criticalDurationMs={333}
        totalDurationMs={1000}
      />,
    )
    // 333/1000 = 33.3% → rounds to 33
    expect(screen.getByText('33%')).toBeInTheDocument()
  })

  it('renders without className prop', () => {
    const { container } = render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={0}
        totalSpanCount={5}
      />,
    )
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders with custom className applied to wrapper', () => {
    const { container } = render(
      <CriticalPathToggle
        enabled={false}
        onChange={vi.fn()}
        criticalSpanCount={0}
        totalSpanCount={5}
        className="custom-class"
      />,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
