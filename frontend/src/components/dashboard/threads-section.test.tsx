/**
 * T066 — Tests for ThreadsSection component (T061)
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreadsSection } from './threads-section'
import type { ThreadStatsResponse, ThreadStatsEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeThread(overrides: Partial<ThreadStatsEntry> = {}): ThreadStatsEntry {
  return {
    thread_id: 'thread-01',
    queue: 'AR System',
    total_requests: 100,
    error_count: 0,
    avg_duration_ms: 250,
    max_duration_ms: 800,
    min_duration_ms: 10,
    total_duration_ms: 25_000,
    unique_users: 3,
    unique_forms: 2,
    ...overrides,
  }
}

function makeData(overrides: Partial<ThreadStatsResponse> = {}): ThreadStatsResponse {
  return {
    job_id: 'job-001',
    thread_stats: [],
    total_threads: 0,
    ...overrides,
  }
}

const twoThreads: ThreadStatsResponse = {
  job_id: 'job-001',
  total_threads: 2,
  thread_stats: [
    makeThread({
      thread_id: 'thread-alpha',
      queue: 'AR System',
      total_requests: 200,
      error_count: 0,
      avg_duration_ms: 300,
      max_duration_ms: 900,
    }),
    makeThread({
      thread_id: 'thread-beta',
      queue: 'AR Background',
      total_requests: 50,
      error_count: 5,
      avg_duration_ms: 1500,
      max_duration_ms: 6000,
    }),
  ],
}

const singleThread: ThreadStatsResponse = {
  job_id: 'job-002',
  total_threads: 1,
  thread_stats: [
    makeThread({ thread_id: 'thread-only', total_requests: 10 }),
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThreadsSection', () => {
  describe('empty state', () => {
    it('shows empty message when thread_stats is empty', () => {
      render(<ThreadsSection data={makeData()} />)
      expect(
        screen.getByText('No thread statistics available for this job.')
      ).toBeInTheDocument()
    })

    it('does not render a table when no threads', () => {
      render(<ThreadsSection data={makeData()} />)
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('does not render the summary bar when no threads', () => {
      render(<ThreadsSection data={makeData()} />)
      expect(screen.queryByText(/thread.*active/i)).toBeNull()
    })
  })

  describe('summary bar', () => {
    it('shows thread count with plural form', () => {
      render(<ThreadsSection data={twoThreads} />)
      // The summary bar renders "{count} threads active" as two sibling nodes
      expect(screen.getByText(/threads active/i)).toBeInTheDocument()
      // The count span is a child of the same parent — query by exact text on the span
      const countSpan = screen.getByText('2', { selector: 'span' })
      expect(countSpan).toBeInTheDocument()
    })

    it('uses singular form for 1 thread', () => {
      render(<ThreadsSection data={singleThread} />)
      expect(screen.getByText(/thread active/i)).toBeInTheDocument()
      // should not say "threads" (plural)
      expect(screen.queryByText(/threads active/i)).toBeNull()
    })
  })

  describe('table structure', () => {
    it('renders the thread statistics table with aria-label', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.getByRole('table', { name: 'Thread statistics' })).toBeInTheDocument()
    })

    it('renders sortable column headers', () => {
      render(<ThreadsSection data={twoThreads} />)
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      expect(within(table).getByText('Thread ID')).toBeInTheDocument()
      expect(within(table).getByText('Requests')).toBeInTheDocument()
      expect(within(table).getByText('Errors')).toBeInTheDocument()
      expect(within(table).getByText('Avg Duration')).toBeInTheDocument()
      expect(within(table).getByText('Max Duration')).toBeInTheDocument()
    })

    it('renders non-sortable Queue column header', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.getByText('Queue')).toBeInTheDocument()
    })

    it('renders one data row per thread entry', () => {
      render(<ThreadsSection data={twoThreads} />)
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const allRows = within(table).getAllByRole('row')
      // 1 header + 2 data rows
      expect(allRows).toHaveLength(3)
    })
  })

  describe('row content', () => {
    it('renders thread IDs in data rows', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.getByText('thread-alpha')).toBeInTheDocument()
      expect(screen.getByText('thread-beta')).toBeInTheDocument()
    })

    it('renders total_requests values', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.getByText('200')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })

    it('renders queue names', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.getByText('AR System')).toBeInTheDocument()
      expect(screen.getByText('AR Background')).toBeInTheDocument()
    })

    it('renders em dash when queue is empty string', () => {
      render(
        <ThreadsSection
          data={makeData({
            total_threads: 1,
            thread_stats: [makeThread({ queue: '' })],
          })}
        />
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('error count styling', () => {
    it('error_count > 0 renders with error class on the span', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-beta has error_count: 5
      const errorSpan = screen.getByText('5')
      expect(errorSpan.className).toMatch(/color-error/)
    })

    it('zero error_count renders with secondary text class', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-alpha has error_count: 0
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const alphaRow = within(table).getAllByRole('row')[1]
      // The error count cell contains "0"
      const zeroSpan = within(alphaRow).getByText('0')
      expect(zeroSpan.className).not.toMatch(/color-error/)
    })

    it('row with error_count > 0 gets error-light background class', () => {
      render(<ThreadsSection data={twoThreads} />)
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      // Default sort is total_requests desc: alpha(200) first, beta(50) second
      const rows = within(table).getAllByRole('row')
      const betaRow = rows[2]
      expect(betaRow.className).toMatch(/color-error-light/)
    })
  })

  describe('duration formatting', () => {
    it('formats avg_duration_ms < 1000 as ms', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-alpha avg: 300ms
      expect(screen.getByText('300ms')).toBeInTheDocument()
    })

    it('formats avg_duration_ms >= 1000 as seconds with 2 decimal places', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-beta avg: 1500ms
      expect(screen.getByText('1.50s')).toBeInTheDocument()
    })

    it('formats max_duration_ms < 1000 as ms', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-alpha max: 900ms
      expect(screen.getByText('900ms')).toBeInTheDocument()
    })

    it('formats max_duration_ms >= 1000 as seconds', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-beta max: 6000ms -> 6.00s
      expect(screen.getByText('6.00s')).toBeInTheDocument()
    })

    it('max_duration_ms > 5000 renders with error color', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-beta max is 6000ms > 5000
      const maxDurationSpan = screen.getByText('6.00s')
      expect(maxDurationSpan.className).toMatch(/color-error/)
    })

    it('max_duration_ms > 1000 and <= 5000 renders with warning color', () => {
      render(
        <ThreadsSection
          data={makeData({
            total_threads: 1,
            thread_stats: [makeThread({ max_duration_ms: 3000 })],
          })}
        />
      )
      const maxDurationSpan = screen.getByText('3.00s')
      expect(maxDurationSpan.className).toMatch(/color-warning/)
    })

    it('max_duration_ms <= 1000 renders with secondary text color', () => {
      render(<ThreadsSection data={twoThreads} />)
      // thread-alpha max is 900ms <= 1000
      const maxDurationSpan = screen.getByText('900ms')
      expect(maxDurationSpan.className).not.toMatch(/color-error/)
      expect(maxDurationSpan.className).not.toMatch(/color-warning/)
    })
  })

  describe('column sorting', () => {
    it('default sort is total_requests descending — higher count appears first', () => {
      render(<ThreadsSection data={twoThreads} />)
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const rows = within(table).getAllByRole('row')
      // thread-alpha (200 requests) should come before thread-beta (50 requests)
      expect(rows[1]).toHaveTextContent('thread-alpha')
      expect(rows[2]).toHaveTextContent('thread-beta')
    })

    it('Requests column header has aria-sort="descending" by default', () => {
      render(<ThreadsSection data={twoThreads} />)
      const requestsHeader = screen.getByRole('columnheader', { name: /requests/i })
      expect(requestsHeader).toHaveAttribute('aria-sort', 'descending')
    })

    it('clicking Requests header toggles sort to ascending', async () => {
      const user = userEvent.setup()
      render(<ThreadsSection data={twoThreads} />)

      const requestsHeader = screen.getByRole('columnheader', { name: /requests/i })
      await user.click(requestsHeader)

      expect(requestsHeader).toHaveAttribute('aria-sort', 'ascending')
    })

    it('ascending sort on Requests places lower count first', async () => {
      const user = userEvent.setup()
      render(<ThreadsSection data={twoThreads} />)

      await user.click(screen.getByRole('columnheader', { name: /requests/i }))

      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const rows = within(table).getAllByRole('row')
      // thread-beta (50) should come before thread-alpha (200) in ascending
      expect(rows[1]).toHaveTextContent('thread-beta')
      expect(rows[2]).toHaveTextContent('thread-alpha')
    })

    it('clicking a different header switches sort key with descending direction', async () => {
      const user = userEvent.setup()
      render(<ThreadsSection data={twoThreads} />)

      const errorsHeader = screen.getByRole('columnheader', { name: /errors/i })
      await user.click(errorsHeader)

      expect(errorsHeader).toHaveAttribute('aria-sort', 'descending')
      // thread-beta (5 errors) should appear first after sort by errors desc
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const rows = within(table).getAllByRole('row')
      expect(rows[1]).toHaveTextContent('thread-beta')
    })

    it('clicking same header twice returns to descending', async () => {
      const user = userEvent.setup()
      render(<ThreadsSection data={twoThreads} />)

      const requestsHeader = screen.getByRole('columnheader', { name: /requests/i })
      // First click -> ascending
      await user.click(requestsHeader)
      expect(requestsHeader).toHaveAttribute('aria-sort', 'ascending')
      // Second click -> descending again
      await user.click(requestsHeader)
      expect(requestsHeader).toHaveAttribute('aria-sort', 'descending')
    })

    it('non-active column headers have aria-sort="none"', () => {
      render(<ThreadsSection data={twoThreads} />)
      const errorsHeader = screen.getByRole('columnheader', { name: /errors/i })
      expect(errorsHeader).toHaveAttribute('aria-sort', 'none')
    })

    it('sorting by Thread ID (string sort) works correctly', async () => {
      const user = userEvent.setup()
      render(<ThreadsSection data={twoThreads} />)

      const threadIdHeader = screen.getByRole('columnheader', { name: /thread id/i })
      await user.click(threadIdHeader)

      // descending alphabetical: thread-beta comes before thread-alpha
      const table = screen.getByRole('table', { name: 'Thread statistics' })
      const rows = within(table).getAllByRole('row')
      expect(rows[1]).toHaveTextContent('thread-beta')
      expect(rows[2]).toHaveTextContent('thread-alpha')
    })
  })

  describe('busy % column', () => {
    const threadsWithBusy: ThreadStatsResponse = {
      job_id: 'job-busy',
      total_threads: 3,
      thread_stats: [
        makeThread({
          thread_id: 'thread-low',
          total_requests: 100,
          busy_pct: 25.5,
        }),
        makeThread({
          thread_id: 'thread-med',
          total_requests: 80,
          busy_pct: 65.0,
        }),
        makeThread({
          thread_id: 'thread-high',
          total_requests: 60,
          busy_pct: 92.3,
        }),
      ],
    }

    it('shows Busy % column header when any thread has busy_pct', () => {
      render(<ThreadsSection data={threadsWithBusy} />)
      expect(screen.getByText('Busy %')).toBeInTheDocument()
    })

    it('does not show Busy % column when no threads have busy_pct', () => {
      render(<ThreadsSection data={twoThreads} />)
      expect(screen.queryByText('Busy %')).toBeNull()
    })

    it('renders busy_pct values with percentage', () => {
      render(<ThreadsSection data={threadsWithBusy} />)
      expect(screen.getByText('25.5%')).toBeInTheDocument()
      expect(screen.getByText('65.0%')).toBeInTheDocument()
      expect(screen.getByText('92.3%')).toBeInTheDocument()
    })

    it('renders progress bar with green color for low utilization (<50%)', () => {
      render(<ThreadsSection data={threadsWithBusy} />)
      const lowLabel = screen.getByLabelText('Busy: 25.5%')
      const bar = lowLabel.querySelector('[style]')
      expect(bar).toBeTruthy()
      expect(bar?.getAttribute('style')).toContain('var(--color-success)')
    })

    it('renders progress bar with amber/warning color for medium utilization (50-80%)', () => {
      render(<ThreadsSection data={threadsWithBusy} />)
      const medLabel = screen.getByLabelText('Busy: 65.0%')
      const bar = medLabel.querySelector('[style]')
      expect(bar).toBeTruthy()
      expect(bar?.getAttribute('style')).toContain('var(--color-warning)')
    })

    it('renders progress bar with red/error color for high utilization (>80%)', () => {
      render(<ThreadsSection data={threadsWithBusy} />)
      const highLabel = screen.getByLabelText('Busy: 92.3%')
      const bar = highLabel.querySelector('[style]')
      expect(bar).toBeTruthy()
      expect(bar?.getAttribute('style')).toContain('var(--color-error)')
    })

    it('renders em dash when busy_pct is undefined', () => {
      const mixed: ThreadStatsResponse = {
        job_id: 'job-mixed',
        total_threads: 2,
        thread_stats: [
          makeThread({ thread_id: 'with-busy', busy_pct: 50 }),
          makeThread({ thread_id: 'without-busy' }),
        ],
      }
      render(<ThreadsSection data={mixed} />)
      // Should show the column (one thread has data) and em-dash for the other
      expect(screen.getByText('Busy %')).toBeInTheDocument()
      expect(screen.getByText('50.0%')).toBeInTheDocument()
      // The em-dash should be present for the thread without busy_pct
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('className prop', () => {
    it('passes className to wrapper when data is present', () => {
      const { container } = render(
        <ThreadsSection data={twoThreads} className="my-custom-class" />
      )
      expect(container.firstChild).toHaveClass('my-custom-class')
    })
  })
})
