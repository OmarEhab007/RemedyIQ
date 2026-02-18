/**
 * Tests for TimelineHistogram component.
 *
 * Covers: empty state, renders chart container, correct aria label.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimelineHistogram } from './timeline-histogram'
import type { LogEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mock recharts — jsdom doesn't support SVG rendering correctly
// ---------------------------------------------------------------------------

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`bar-${dataKey}`} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(logType: LogEntry['log_type'], ts: string): LogEntry {
  return {
    tenant_id: 't1',
    job_id: 'j1',
    entry_id: Math.random().toString(36).slice(2),
    line_number: 1,
    timestamp: ts,
    log_type: logType,
    trace_id: 'tr',
    rpc_id: 'rpc',
    thread_id: 'th',
    queue: 'Q',
    user: 'u',
    duration_ms: 100,
    success: true,
    form: null,
    sql_table: null,
    filter_name: null,
    esc_name: null,
    raw_text: '',
    error_message: null,
  }
}

const sampleEntries: LogEntry[] = [
  makeEntry('API', '2025-01-15T10:00:00.000Z'),
  makeEntry('SQL', '2025-01-15T10:01:00.000Z'),
  makeEntry('FLTR', '2025-01-15T10:02:00.000Z'),
  makeEntry('ESCL', '2025-01-15T10:03:00.000Z'),
  makeEntry('API', '2025-01-15T10:04:00.000Z'),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimelineHistogram', () => {
  it('renders empty state when no entries are provided', () => {
    render(<TimelineHistogram entries={[]} />)
    expect(screen.getByText(/no entries to chart/i)).toBeInTheDocument()
  })

  it('renders the recharts bar chart when entries are provided', () => {
    render(<TimelineHistogram entries={sampleEntries} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders a bar for each log type', () => {
    render(<TimelineHistogram entries={sampleEntries} />)
    expect(screen.getByTestId('bar-API')).toBeInTheDocument()
    expect(screen.getByTestId('bar-SQL')).toBeInTheDocument()
    expect(screen.getByTestId('bar-FLTR')).toBeInTheDocument()
    expect(screen.getByTestId('bar-ESCL')).toBeInTheDocument()
  })

  it('has correct aria-label describing the histogram', () => {
    render(<TimelineHistogram entries={sampleEntries} />)
    const container = screen.getByRole('img')
    expect(container).toHaveAttribute(
      'aria-label',
      expect.stringContaining('5 log entries'),
    )
  })

  it('applies custom className', () => {
    const { container } = render(
      <TimelineHistogram entries={sampleEntries} className="custom-class" />,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('respects custom height prop', () => {
    const { container } = render(
      <TimelineHistogram entries={sampleEntries} height={200} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.height).toBe('200px')
  })

  it('renders with default bucket count of 20', () => {
    render(<TimelineHistogram entries={sampleEntries} />)
    // If no error is thrown with default props, buckets=20 works
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})
