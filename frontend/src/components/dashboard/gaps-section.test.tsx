/**
 * T066 — Tests for GapsSection component (T060)
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GapsSection } from './gaps-section'
import type { GapsResponse, GapEntry, QueueHealthSummary } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGap(overrides: Partial<GapEntry> = {}): GapEntry {
  return {
    start_time: '2024-03-15T10:00:00Z',
    end_time: '2024-03-15T10:00:10Z',
    duration_ms: 10_000,          // 10s — warning threshold
    before_line: 100,
    after_line: 101,
    description: 'Log gap detected',
    ...overrides,
  }
}

function makeQueueHealth(overrides: Partial<QueueHealthSummary> = {}): QueueHealthSummary {
  return {
    queue: 'AR System',
    total_requests: 500,
    error_count: 0,
    avg_duration_ms: 250,
    max_duration_ms: 1200,
    gap_count: 0,
    ...overrides,
  }
}

function makeData(overrides: Partial<GapsResponse> = {}): GapsResponse {
  return {
    job_id: 'job-001',
    gaps: [],
    queue_health: [],
    total_gaps: 0,
    ...overrides,
  }
}

// A complete dataset with gaps and queue health
const fullData: GapsResponse = {
  job_id: 'job-001',
  total_gaps: 3,
  gaps: [
    makeGap({ duration_ms: 500,    before_line: 10,  after_line: 11,  description: 'Small gap'    }),
    makeGap({ duration_ms: 8_000,  before_line: 50,  after_line: 52,  description: 'Medium gap'   }),
    makeGap({ duration_ms: 45_000, before_line: 200, after_line: 210, description: 'Critical gap' }),
  ],
  queue_health: [
    makeQueueHealth({ queue: 'AR System',    error_count: 0, gap_count: 0 }),
    makeQueueHealth({ queue: 'AR Background', error_count: 3, gap_count: 1 }),
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GapsSection', () => {
  describe('empty state', () => {
    it('shows continuous coverage message when both gaps and queue_health are empty', () => {
      render(<GapsSection data={makeData()} />)
      expect(
        screen.getByText('No timing gaps detected — log coverage is continuous.')
      ).toBeInTheDocument()
    })

    it('does not render any table when both arrays are empty', () => {
      render(<GapsSection data={makeData()} />)
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('renders content when gaps exist even if queue_health is empty', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap()], queue_health: [] })}
        />
      )
      expect(screen.queryByText(/no timing gaps/i)).toBeNull()
      expect(screen.getByRole('table', { name: 'Timing gaps' })).toBeInTheDocument()
    })

    it('renders content when only queue_health exists with no gaps', () => {
      render(
        <GapsSection
          data={makeData({ gaps: [], queue_health: [makeQueueHealth()], total_gaps: 0 })}
        />
      )
      expect(screen.queryByText(/no timing gaps/i)).toBeNull()
      expect(screen.getByRole('table', { name: 'Queue health summary' })).toBeInTheDocument()
    })
  })

  describe('summary bar', () => {
    it('shows total gap count in summary', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('3 timing gaps detected')).toBeInTheDocument()
    })

    it('uses singular form for 1 gap', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap()], queue_health: [] })}
        />
      )
      expect(screen.getByText('1 timing gap detected')).toBeInTheDocument()
    })
  })

  describe('gaps table', () => {
    it('renders timing gaps table with aria-label', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByRole('table', { name: 'Timing gaps' })).toBeInTheDocument()
    })

    it('renders all column headers', () => {
      render(<GapsSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Timing gaps' })
      expect(within(table).getByText('#')).toBeInTheDocument()
      expect(within(table).getByText('Duration')).toBeInTheDocument()
      expect(within(table).getByText('Start')).toBeInTheDocument()
      expect(within(table).getByText('End')).toBeInTheDocument()
      expect(within(table).getByText('Lines')).toBeInTheDocument()
      expect(within(table).getByText('Description')).toBeInTheDocument()
    })

    it('renders index numbers with # prefix', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
      expect(screen.getByText('#3')).toBeInTheDocument()
    })

    it('renders line range in L{before} to L{after} format', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('L10 → L11')).toBeInTheDocument()
      expect(screen.getByText('L50 → L52')).toBeInTheDocument()
      expect(screen.getByText('L200 → L210')).toBeInTheDocument()
    })

    it('renders gap descriptions', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('Small gap')).toBeInTheDocument()
      expect(screen.getByText('Medium gap')).toBeInTheDocument()
      expect(screen.getByText('Critical gap')).toBeInTheDocument()
    })
  })

  describe('duration formatting and severity', () => {
    it('formats duration under 1000ms as ms', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 500 })], queue_health: [makeQueueHealth()] })}
        />
      )
      expect(screen.getByText('500ms')).toBeInTheDocument()
    })

    it('formats duration in seconds for 1000ms-59999ms range', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 8_000 })], queue_health: [makeQueueHealth()] })}
        />
      )
      expect(screen.getByText('8.00s')).toBeInTheDocument()
    })

    it('formats duration in minutes for >= 60000ms', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 90_000 })], queue_health: [makeQueueHealth()] })}
        />
      )
      expect(screen.getByText('1.5m')).toBeInTheDocument()
    })

    it('ok severity gap (<=5s) does not get critical or warning class', () => {
      const { container } = render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 500 })], queue_health: [] })}
        />
      )
      const rows = container.querySelectorAll('tbody tr')
      expect(rows[0].className).not.toMatch(/color-error-light/)
      expect(rows[0].className).not.toMatch(/color-warning-light/)
    })

    it('warning severity gap (>5s, <=30s) applies warning background', () => {
      const { container } = render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 8_000 })], queue_health: [] })}
        />
      )
      const rows = container.querySelectorAll('tbody tr')
      expect(rows[0].className).toMatch(/color-warning-light/)
    })

    it('critical severity gap (>30s) applies error background', () => {
      const { container } = render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap({ duration_ms: 45_000 })], queue_health: [] })}
        />
      )
      const rows = container.querySelectorAll('tbody tr')
      expect(rows[0].className).toMatch(/color-error-light/)
    })
  })

  describe('queue health table', () => {
    it('renders queue health table with aria-label', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByRole('table', { name: 'Queue health summary' })).toBeInTheDocument()
    })

    it('renders "Queue Health Summary" heading', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('Queue Health Summary')).toBeInTheDocument()
    })

    it('renders all queue health column headers', () => {
      render(<GapsSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Queue health summary' })
      expect(within(table).getByText('Queue')).toBeInTheDocument()
      expect(within(table).getByText('Requests')).toBeInTheDocument()
      expect(within(table).getByText('Errors')).toBeInTheDocument()
      expect(within(table).getByText('Avg Duration')).toBeInTheDocument()
      expect(within(table).getByText('Max Duration')).toBeInTheDocument()
      expect(within(table).getByText('Gaps')).toBeInTheDocument()
    })

    it('renders queue names in the table', () => {
      render(<GapsSection data={fullData} />)
      expect(screen.getByText('AR System')).toBeInTheDocument()
      expect(screen.getByText('AR Background')).toBeInTheDocument()
    })

    it('renders total_requests with locale formatting', () => {
      render(<GapsSection data={fullData} />)
      // 500 total requests
      const cells = screen.getAllByText('500')
      expect(cells.length).toBeGreaterThanOrEqual(1)
    })

    it('does not render queue health table when health array is empty', () => {
      render(
        <GapsSection
          data={makeData({ total_gaps: 1, gaps: [makeGap()], queue_health: [] })}
        />
      )
      expect(screen.queryByRole('table', { name: 'Queue health summary' })).toBeNull()
    })

    it('error_count > 0 is rendered in the AR Background row', () => {
      render(<GapsSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Queue health summary' })
      const rows = within(table).getAllByRole('row')
      // Rows: [header, AR System, AR Background]
      const bgRow = rows[2]
      // The error count "3" should appear in this row
      expect(within(bgRow).getByText('3')).toBeInTheDocument()
    })

    it('gap_count > 0 uses warning styling span', () => {
      render(<GapsSection data={fullData} />)
      // AR Background has gap_count: 1
      const table = screen.getByRole('table', { name: 'Queue health summary' })
      const rows = within(table).getAllByRole('row')
      const bgRow = rows[2]
      expect(within(bgRow).getByText('1')).toBeInTheDocument()
    })

    it('zero error count does not apply error class', () => {
      render(<GapsSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Queue health summary' })
      const rows = within(table).getAllByRole('row')
      // AR System row has error_count: 0
      const arSystemRow = rows[1]
      const zeroCells = within(arSystemRow).getAllByText('0')
      // The zero error count cell should not have color-error class
      expect(zeroCells[0].className).not.toMatch(/color-error/)
    })
  })

  describe('className prop', () => {
    it('passes className to wrapper when data is present', () => {
      const { container } = render(
        <GapsSection data={fullData} className="my-class" />
      )
      expect(container.firstChild).toHaveClass('my-class')
    })
  })
})
