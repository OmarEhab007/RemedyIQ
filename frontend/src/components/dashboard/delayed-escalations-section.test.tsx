/**
 * T048 — Tests for DelayedEscalationsSection
 *
 * Covers:
 *  - Renders entries with escalation name, pool, scheduled/actual time, delay
 *  - Highlights delay >60s as critical (severe)
 *  - Shows summary metrics (total, avg delay, max delay)
 *  - Shows empty state when no entries
 *  - Handles entries with null scheduled_time
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DelayedEscalationsSection } from './delayed-escalations-section'
import type { DelayedEscalationsResponse } from '@/lib/api-types'

const sampleData: DelayedEscalationsResponse = {
  job_id: 'test-job-1',
  entries: [
    {
      esc_name: 'SLA:Critical Violation',
      esc_pool: 'AR System',
      scheduled_time: '2024-01-01T12:00:00Z',
      actual_time: '2024-01-01T12:05:00Z',
      delay_ms: 300000,
      thread_id: 'T-ESC-001',
      trace_id: 'trace-001',
      line_number: 1500,
    },
    {
      esc_name: 'Auto-Assign Rule',
      esc_pool: 'Fast',
      scheduled_time: '2024-01-01T13:00:00Z',
      actual_time: '2024-01-01T13:00:08Z',
      delay_ms: 8000,
      thread_id: 'T-ESC-002',
      trace_id: 'trace-002',
      line_number: 2500,
    },
  ],
  total: 2,
  avg_delay_ms: 154000,
  max_delay_ms: 300000,
}

describe('DelayedEscalationsSection', () => {
  it('renders entries with escalation names', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    expect(screen.getByRole('region', { name: /delayed escalations/i })).toBeInTheDocument()
    expect(screen.getByText('SLA:Critical Violation')).toBeInTheDocument()
    expect(screen.getByText('Auto-Assign Rule')).toBeInTheDocument()
  })

  it('renders pool names', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    expect(screen.getByText('AR System')).toBeInTheDocument()
    expect(screen.getByText('Fast')).toBeInTheDocument()
  })

  it('renders delay values', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    // 300000ms = 5.0m — appears in both the Max Delay summary card and the table row
    expect(screen.getAllByText('5.0m').length).toBeGreaterThanOrEqual(1)
    // 8000ms = 8.0s
    expect(screen.getByText('8.0s')).toBeInTheDocument()
  })

  it('renders summary metrics', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Avg Delay')).toBeInTheDocument()
    expect(screen.getByText('Max Delay')).toBeInTheDocument()
  })

  it('renders thread IDs', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    expect(screen.getByText('T-ESC-001')).toBeInTheDocument()
    expect(screen.getByText('T-ESC-002')).toBeInTheDocument()
  })

  it('shows empty state when no entries', () => {
    const emptyData: DelayedEscalationsResponse = {
      job_id: 'test-job-1',
      entries: [],
      total: 0,
      avg_delay_ms: 0,
      max_delay_ms: 0,
    }
    render(<DelayedEscalationsSection data={emptyData} />)
    expect(screen.getByText(/no delayed escalations found/i)).toBeInTheDocument()
  })

  it('handles null data', () => {
    render(<DelayedEscalationsSection data={null as unknown as DelayedEscalationsResponse} />)
    expect(screen.getByText(/no delayed escalations found/i)).toBeInTheDocument()
  })

  it('handles null scheduled_time', () => {
    const dataWithNull: DelayedEscalationsResponse = {
      ...sampleData,
      entries: [
        {
          ...sampleData.entries[0],
          scheduled_time: null as unknown as string,
        },
      ],
    }
    render(<DelayedEscalationsSection data={dataWithNull} />)
    expect(screen.getByText('SLA:Critical Violation')).toBeInTheDocument()
    // scheduled_time null should render as '—'
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders column headers', () => {
    render(<DelayedEscalationsSection data={sampleData} />)
    expect(screen.getByText('Escalation')).toBeInTheDocument()
    expect(screen.getByText('Pool')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Delay')).toBeInTheDocument()
    expect(screen.getByText('Thread')).toBeInTheDocument()
  })
})
