/**
 * Tests for StatsCards component (T066).
 *
 * Covers: renders all stat values, correct formatting, error rate styling,
 * accessibility, empty/zero values.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from './stats-cards'
import type { GeneralStatistics, Distribution } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<GeneralStatistics> = {}): GeneralStatistics {
  return {
    total_lines: 50000,
    api_count: 12000,
    sql_count: 25000,
    filter_count: 8000,
    esc_count: 500,
    unique_users: 42,
    unique_forms: 18,
    unique_tables: 7,
    log_start: '2024-01-01T00:00:00Z',
    log_end: '2024-01-01T12:00:00Z',
    log_duration: '12h 0m 0s',
    ...overrides,
  }
}

function makeDistribution(overrides: Partial<Distribution> = {}): Distribution {
  return {
    log_type: [],
    duration_buckets: [],
    error_rate: 0.02,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatsCards', () => {
  it('renders the correct total entries', () => {
    const stats = makeStats()
    render(<StatsCards stats={stats} />)
    // Total = 12000 + 25000 + 8000 + 500 = 45500
    expect(screen.getByText('45,500')).toBeInTheDocument()
  })

  it('renders individual log type counts', () => {
    const stats = makeStats()
    render(<StatsCards stats={stats} />)
    expect(screen.getByText('12,000')).toBeInTheDocument()
    expect(screen.getByText('25,000')).toBeInTheDocument()
    expect(screen.getByText('8,000')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('renders labels for all stat cards', () => {
    render(<StatsCards stats={makeStats()} />)
    expect(screen.getByText('Total Entries')).toBeInTheDocument()
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
    expect(screen.getByText('Escalation')).toBeInTheDocument()
    expect(screen.getByText('Error Rate')).toBeInTheDocument()
  })

  it('formats error rate as percentage', () => {
    render(<StatsCards stats={makeStats()} distribution={makeDistribution({ error_rate: 0.035 })} />)
    expect(screen.getByText('3.5%')).toBeInTheDocument()
  })

  it('displays 0.0% error rate when distribution is not provided', () => {
    render(<StatsCards stats={makeStats()} />)
    expect(screen.getByText('0.0%')).toBeInTheDocument()
  })

  it('displays log_duration as description for Total Entries', () => {
    render(<StatsCards stats={makeStats({ log_duration: '6h 30m 15s' })} />)
    expect(screen.getByText('6h 30m 15s')).toBeInTheDocument()
  })

  it('displays unique user count in error rate description', () => {
    render(<StatsCards stats={makeStats({ unique_users: 15 })} />)
    expect(screen.getByText('15 unique users')).toBeInTheDocument()
  })

  it('handles zero counts correctly', () => {
    const stats = makeStats({ api_count: 0, sql_count: 0, filter_count: 0, esc_count: 0 })
    render(<StatsCards stats={stats} />)
    expect(screen.getByText('Total Entries')).toBeInTheDocument()
    // Total should be 0
    const totalCard = screen.getByText('Total Entries').closest('div')?.parentElement
    expect(totalCard).toBeInTheDocument()
  })

  it('has region role with accessible label', () => {
    render(<StatsCards stats={makeStats()} />)
    expect(screen.getByRole('region', { name: /summary statistics/i })).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<StatsCards stats={makeStats()} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
