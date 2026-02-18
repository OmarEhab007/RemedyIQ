/**
 * Tests for TimestampRuler component.
 *
 * Covers: null rendering edge cases, tick count, ms formatting,
 * custom className, accessibility attributes, startOffsetMs offset.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimestampRuler } from './timestamp-ruler'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimestampRuler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when totalDurationMs is 0', () => {
    const { container } = render(<TimestampRuler totalDurationMs={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when totalDurationMs is negative', () => {
    const { container } = render(<TimestampRuler totalDurationMs={-100} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when tickCount is 0', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} tickCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when tickCount is negative', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} tickCount={-1} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders correct number of ticks with default tickCount=5 (6 tick marks)', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} />)
    // tickCount=5 produces tickCount+1 = 6 tick marks
    const tickMarks = container.querySelectorAll('.absolute.bottom-0.flex.flex-col')
    expect(tickMarks).toHaveLength(6)
  })

  it('renders correct number of ticks with custom tickCount=3 (4 tick marks)', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} tickCount={3} />)
    const tickMarks = container.querySelectorAll('.absolute.bottom-0.flex.flex-col')
    expect(tickMarks).toHaveLength(4)
  })

  it('renders correct number of ticks with tickCount=10 (11 tick marks)', () => {
    const { container } = render(<TimestampRuler totalDurationMs={1000} tickCount={10} />)
    const tickMarks = container.querySelectorAll('.absolute.bottom-0.flex.flex-col')
    expect(tickMarks).toHaveLength(11)
  })

  it('formats 0ms as "0"', () => {
    render(<TimestampRuler totalDurationMs={500} tickCount={1} />)
    // First tick is always 0
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('formats values under 100ms with one decimal place (e.g. 50ms -> "50.0ms")', () => {
    // totalDurationMs=100, tickCount=2: ticks at 0, 50, 100ms
    render(<TimestampRuler totalDurationMs={100} tickCount={2} />)
    expect(screen.getByText('50.0ms')).toBeInTheDocument()
  })

  it('formats values >= 100ms and < 1000ms as rounded integer + "ms"', () => {
    // totalDurationMs=500, tickCount=1: ticks at 0 and 500ms
    render(<TimestampRuler totalDurationMs={500} tickCount={1} />)
    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  it('formats values >= 1000ms as seconds with one decimal place', () => {
    // totalDurationMs=2000, tickCount=1: ticks at 0 and 2000ms -> "2.0s"
    render(<TimestampRuler totalDurationMs={2000} tickCount={1} />)
    expect(screen.getByText('2.0s')).toBeInTheDocument()
  })

  it('formats 1000ms as "1.0s"', () => {
    render(<TimestampRuler totalDurationMs={1000} tickCount={1} />)
    expect(screen.getByText('1.0s')).toBeInTheDocument()
  })

  it('formats 1500ms as "1.5s"', () => {
    render(<TimestampRuler totalDurationMs={1500} tickCount={1} />)
    expect(screen.getByText('1.5s')).toBeInTheDocument()
  })

  it('applies custom className to the root element', () => {
    const { container } = render(
      <TimestampRuler totalDurationMs={500} className="custom-ruler-class" />,
    )
    expect(container.firstChild).toHaveClass('custom-ruler-class')
  })

  it('always includes the base classes on the root element', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} />)
    expect(container.firstChild).toHaveClass('relative', 'h-5', 'select-none')
  })

  it('has role="presentation" on the root element', () => {
    render(<TimestampRuler totalDurationMs={500} />)
    // The element has aria-hidden="true" so we must pass hidden:true to find it
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument()
  })

  it('has aria-hidden="true" on the root element', () => {
    render(<TimestampRuler totalDurationMs={500} />)
    const root = screen.getByRole('presentation', { hidden: true })
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders with startOffsetMs offset — first tick shows offset value', () => {
    // startOffsetMs=100, totalDurationMs=400, tickCount=1
    // ticks: { ms: 100 } and { ms: 500 }
    render(<TimestampRuler totalDurationMs={400} tickCount={1} startOffsetMs={100} />)
    expect(screen.getByText('100ms')).toBeInTheDocument()
    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  it('renders startOffsetMs in seconds when offset >= 1000ms', () => {
    // startOffsetMs=1000, totalDurationMs=1000, tickCount=1
    // ticks: { ms: 1000 -> "1.0s" } and { ms: 2000 -> "2.0s" }
    render(<TimestampRuler totalDurationMs={1000} tickCount={1} startOffsetMs={1000} />)
    expect(screen.getByText('1.0s')).toBeInTheDocument()
    expect(screen.getByText('2.0s')).toBeInTheDocument()
  })

  it('positions first tick at 0% left', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} tickCount={4} />)
    const tickContainers = container.querySelectorAll('.absolute.bottom-0.flex.flex-col')
    const firstTick = tickContainers[0] as HTMLElement
    expect(firstTick.style.left).toBe('0%')
  })

  it('positions last tick at 100% left', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} tickCount={4} />)
    const tickContainers = container.querySelectorAll('.absolute.bottom-0.flex.flex-col')
    const lastTick = tickContainers[tickContainers.length - 1] as HTMLElement
    expect(lastTick.style.left).toBe('100%')
  })

  it('renders baseline border element', () => {
    const { container } = render(<TimestampRuler totalDurationMs={500} />)
    const baseline = container.querySelector('.absolute.bottom-0.left-0.right-0.h-px')
    expect(baseline).toBeInTheDocument()
  })
})
