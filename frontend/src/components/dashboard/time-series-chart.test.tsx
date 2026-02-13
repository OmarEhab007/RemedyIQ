import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TimeSeriesChart } from './time-series-chart'
import type { TimeSeriesPoint } from '@/lib/api'

describe('TimeSeriesChart', () => {
  const mockData: TimeSeriesPoint[] = [
    {
      timestamp: '2024-01-01T10:00:00Z',
      api_count: 100,
      sql_count: 200,
      filter_count: 50,
      esc_count: 10,
      avg_duration_ms: 150,
      error_count: 5,
    },
    {
      timestamp: '2024-01-01T10:15:00Z',
      api_count: 120,
      sql_count: 210,
      filter_count: 55,
      esc_count: 12,
      avg_duration_ms: 160,
      error_count: 3,
    },
    {
      timestamp: '2024-01-01T10:30:00Z',
      api_count: 90,
      sql_count: 190,
      filter_count: 45,
      esc_count: 8,
      avg_duration_ms: 140,
      error_count: 7,
    },
  ]

  it('renders chart with data', () => {
    render(<TimeSeriesChart data={mockData} />)

    expect(screen.getByText('Activity Over Time')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows empty state when no data provided', () => {
    render(<TimeSeriesChart data={[]} />)

    expect(screen.getByText('No time series data available')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('renders duration checkbox and toggles', () => {
    render(<TimeSeriesChart data={mockData} />)

    const durationCheckbox = screen.getByLabelText(/Duration/i)
    expect(durationCheckbox).toBeInTheDocument()
    expect(durationCheckbox).not.toBeChecked()

    fireEvent.click(durationCheckbox)
    expect(durationCheckbox).toBeChecked()

    fireEvent.click(durationCheckbox)
    expect(durationCheckbox).not.toBeChecked()
  })

  it('renders errors checkbox and toggles', () => {
    render(<TimeSeriesChart data={mockData} />)

    const errorsCheckbox = screen.getByLabelText(/Errors/i)
    expect(errorsCheckbox).toBeInTheDocument()
    expect(errorsCheckbox).not.toBeChecked()

    fireEvent.click(errorsCheckbox)
    expect(errorsCheckbox).toBeChecked()

    fireEvent.click(errorsCheckbox)
    expect(errorsCheckbox).not.toBeChecked()
  })

  it('passes correct data to chart component', () => {
    render(<TimeSeriesChart data={mockData} />)

    const chart = screen.getByTestId('line-chart')
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '[]')

    expect(chartData).toHaveLength(3)
    expect(chartData[0]).toHaveProperty('api_count', 100)
    expect(chartData[0]).toHaveProperty('time')
  })

  it('renders chart components', () => {
    render(<TimeSeriesChart data={mockData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('legend')).toBeInTheDocument()
  })

  it('handles null/undefined data gracefully', () => {
    // @ts-expect-error Testing null data
    render(<TimeSeriesChart data={null} />)

    expect(screen.getByText('No time series data available')).toBeInTheDocument()
  })

  it('formats timestamps correctly', () => {
    render(<TimeSeriesChart data={mockData} />)

    const chart = screen.getByTestId('line-chart')
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '[]')

    // Check that time field is formatted (contains colon for time)
    expect(chartData[0].time).toMatch(/\d{1,2}:\d{2}/)
  })
})
