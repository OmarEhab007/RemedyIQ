/**
 * Tests for TimeSeriesChart component (T067).
 *
 * Covers: renders chart, empty state, card title, series rendering.
 * Recharts is mocked since jsdom can't render SVG charts.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimeSeriesChart } from './time-series-chart'
import type { TimeSeriesPoint } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mock Recharts — jsdom can't render SVG-based charts
// ---------------------------------------------------------------------------

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="area-chart" data-count={data.length}>{children}</div>
  ),
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`area-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoint(overrides: Partial<TimeSeriesPoint> = {}): TimeSeriesPoint {
  return {
    timestamp: '2024-01-01T10:00:00Z',
    api_count: 100,
    sql_count: 200,
    filter_count: 50,
    esc_count: 10,
    avg_duration_ms: 45.5,
    error_count: 3,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimeSeriesChart', () => {
  it('renders "Activity Over Time" title', () => {
    render(<TimeSeriesChart data={[makePoint()]} />)
    expect(screen.getByText('Activity Over Time')).toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    render(<TimeSeriesChart data={[]} />)
    expect(screen.getByText('No time series data available')).toBeInTheDocument()
  })

  it('renders the chart when data is provided', () => {
    render(<TimeSeriesChart data={[makePoint(), makePoint({ timestamp: '2024-01-01T11:00:00Z' })]} />)
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('renders all 5 area series (API, SQL, Filter, Escalation, Errors)', () => {
    render(<TimeSeriesChart data={[makePoint()]} />)
    expect(screen.getByTestId('area-api_count')).toBeInTheDocument()
    expect(screen.getByTestId('area-sql_count')).toBeInTheDocument()
    expect(screen.getByTestId('area-filter_count')).toBeInTheDocument()
    expect(screen.getByTestId('area-esc_count')).toBeInTheDocument()
    expect(screen.getByTestId('area-error_count')).toBeInTheDocument()
  })

  it('renders series with correct names', () => {
    render(<TimeSeriesChart data={[makePoint()]} />)
    expect(screen.getByTestId('area-api_count')).toHaveAttribute('data-name', 'API')
    expect(screen.getByTestId('area-sql_count')).toHaveAttribute('data-name', 'SQL')
    expect(screen.getByTestId('area-filter_count')).toHaveAttribute('data-name', 'Filter')
    expect(screen.getByTestId('area-esc_count')).toHaveAttribute('data-name', 'Escalation')
    expect(screen.getByTestId('area-error_count')).toHaveAttribute('data-name', 'Errors')
  })

  it('passes data count to chart', () => {
    const data = [
      makePoint(),
      makePoint({ timestamp: '2024-01-01T11:00:00Z' }),
      makePoint({ timestamp: '2024-01-01T12:00:00Z' }),
    ]
    render(<TimeSeriesChart data={data} />)
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '3')
  })

  it('renders responsive container', () => {
    render(<TimeSeriesChart data={[makePoint()]} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<TimeSeriesChart data={[makePoint()]} className="my-chart" />)
    expect(container.querySelector('.my-chart')).toBeInTheDocument()
  })
})
