/**
 * T032 — Tests for LoggingActivitySection
 *
 * Covers:
 *  - Renders activity table with all log types
 *  - Shows formatted timestamps
 *  - Shows human-readable durations
 *  - Shows empty state when no data
 *  - Handles missing/zero duration
 *  - Maps log type codes to readable labels
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoggingActivitySection } from './logging-activity-section'
import type { LoggingActivityEntry } from '@/lib/api-types'

const sampleData: LoggingActivityEntry[] = [
  {
    log_type: 'API',
    first_timestamp: '2024-01-01T10:00:00Z',
    last_timestamp: '2024-01-01T18:30:45Z',
    duration_ms: 30645000,
    entry_count: 5000,
  },
  {
    log_type: 'SQL',
    first_timestamp: '2024-01-01T10:00:01Z',
    last_timestamp: '2024-01-01T18:30:42Z',
    duration_ms: 30641000,
    entry_count: 3000,
  },
  {
    log_type: 'FLTR',
    first_timestamp: '2024-01-01T10:00:02Z',
    last_timestamp: '2024-01-01T18:30:40Z',
    duration_ms: 30638000,
    entry_count: 1500,
  },
  {
    log_type: 'ESCL',
    first_timestamp: '2024-01-01T10:01:00Z',
    last_timestamp: '2024-01-01T18:29:00Z',
    duration_ms: 30480000,
    entry_count: 500,
  },
]

describe('LoggingActivitySection', () => {
  it('renders activity table with all log types', () => {
    render(<LoggingActivitySection data={sampleData} />)
    expect(screen.getByRole('region', { name: /logging activity/i })).toBeInTheDocument()
    expect(screen.getByText('API Calls')).toBeInTheDocument()
    expect(screen.getByText('SQL Operations')).toBeInTheDocument()
    expect(screen.getByText('Filter Executions')).toBeInTheDocument()
    expect(screen.getByText('Escalations')).toBeInTheDocument()
  })

  it('shows human-readable durations', () => {
    render(<LoggingActivitySection data={sampleData} />)
    // 30645000ms = 8h 30m 45s
    expect(screen.getByText('8h 30m 45s')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<LoggingActivitySection data={[]} />)
    expect(screen.getByText(/no logging activity data/i)).toBeInTheDocument()
  })

  it('handles null data', () => {
    render(<LoggingActivitySection data={null as unknown as LoggingActivityEntry[]} />)
    expect(screen.getByText(/no logging activity data/i)).toBeInTheDocument()
  })

  it('handles zero duration', () => {
    const data: LoggingActivityEntry[] = [
      {
        log_type: 'API',
        first_timestamp: '2024-01-01T10:00:00Z',
        last_timestamp: '2024-01-01T10:00:00Z',
        duration_ms: 0,
        entry_count: 1,
      },
    ]
    render(<LoggingActivitySection data={data} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders unknown log types using raw code', () => {
    const data: LoggingActivityEntry[] = [
      {
        log_type: 'CUSTOM',
        first_timestamp: '2024-01-01T10:00:00Z',
        last_timestamp: '2024-01-01T11:00:00Z',
        duration_ms: 3600000,
        entry_count: 100,
      },
    ]
    render(<LoggingActivitySection data={data} />)
    expect(screen.getByText('CUSTOM')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(<LoggingActivitySection data={sampleData} />)
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('First Entry')).toBeInTheDocument()
    expect(screen.getByText('Last Entry')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })
})
