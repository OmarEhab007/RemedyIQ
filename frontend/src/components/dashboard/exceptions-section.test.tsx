/**
 * T066 — Tests for ExceptionsSection component (T059)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExceptionsSection } from './exceptions-section'
import type { ExceptionsResponse, ExceptionEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/constants', () => ({
  LOG_TYPE_COLORS: {
    API:  { bg: '#dbeafe', text: '#1d4ed8', label: 'API',  description: '' },
    SQL:  { bg: '#fef3c7', text: '#92400e', label: 'SQL',  description: '' },
    FLTR: { bg: '#d1fae5', text: '#065f46', label: 'FLTR', description: '' },
    ESCL: { bg: '#fce7f3', text: '#9d174d', label: 'ESCL', description: '' },
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ExceptionEntry> = {}): ExceptionEntry {
  return {
    line_number: 42,
    timestamp: '2024-03-15T10:30:00Z',
    trace_id: 'trace-abc',
    rpc_id: 'rpc-001',
    thread_id: 'thread-1',
    queue: 'AR System',
    user: 'admin',
    log_type: 'API',
    message: 'NullPointerException in handler',
    stack_trace: null,
    form: null,
    duration_ms: null,
    ...overrides,
  }
}

function makeData(overrides: Partial<ExceptionsResponse> = {}): ExceptionsResponse {
  return {
    job_id: 'job-001',
    exceptions: [],
    total: 0,
    ...overrides,
  }
}

const threeExceptions: ExceptionsResponse = {
  job_id: 'job-001',
  total: 3,
  exceptions: [
    makeEntry({
      line_number: 10,
      trace_id: 'trace-1',
      log_type: 'API',
      user: 'admin',
      message: 'API error message',
      stack_trace: 'java.lang.NullPointerException\n\tat com.remedy.Foo.bar(Foo.java:42)',
    }),
    makeEntry({
      line_number: 20,
      trace_id: 'trace-2',
      log_type: 'SQL',
      user: 'sysadmin',
      message: 'SQL error message',
      stack_trace: null,
    }),
    makeEntry({
      line_number: 30,
      trace_id: 'trace-3',
      log_type: 'FLTR',
      user: '',
      message: 'Filter error message',
      stack_trace: 'com.remedy.FilterException\n\tat Filter.run:10',
    }),
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExceptionsSection', () => {
  describe('empty state', () => {
    it('shows clean log message when exceptions array is empty', () => {
      render(<ExceptionsSection data={makeData()} />)
      expect(
        screen.getByText('No exceptions found — log looks clean.')
      ).toBeInTheDocument()
    })

    it('does not render the exceptions table when empty', () => {
      render(<ExceptionsSection data={makeData()} />)
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('does not render the summary bar when empty', () => {
      render(<ExceptionsSection data={makeData()} />)
      // Summary bar shows "{N} exceptions found" — check no digit-prefixed exception text
      expect(screen.queryByText(/^\d+ exception/i)).toBeNull()
    })
  })

  describe('summary bar', () => {
    it('shows total count in summary for multiple exceptions', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByText('3 exceptions found')).toBeInTheDocument()
    })

    it('uses singular form for exactly 1 exception', () => {
      render(
        <ExceptionsSection
          data={makeData({ total: 1, exceptions: [makeEntry({ trace_id: 'trace-x' })] })}
        />
      )
      expect(screen.getByText('1 exception found')).toBeInTheDocument()
    })
  })

  describe('table structure', () => {
    it('renders the exceptions table with aria-label', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByRole('table', { name: 'Exceptions list' })).toBeInTheDocument()
    })

    it('renders all column headers', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      const table = screen.getByRole('table', { name: 'Exceptions list' })
      expect(within(table).getByText('Line')).toBeInTheDocument()
      expect(within(table).getByText('Type')).toBeInTheDocument()
      expect(within(table).getByText('Time')).toBeInTheDocument()
      expect(within(table).getByText('User')).toBeInTheDocument()
      expect(within(table).getByText('Message')).toBeInTheDocument()
      expect(within(table).getByText('Stack')).toBeInTheDocument()
    })

    it('renders one data row per exception entry', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      const table = screen.getByRole('table', { name: 'Exceptions list' })
      const tbody = within(table).getAllByRole('row')
      // 1 header row + 3 data rows (expanded trace rows not yet visible)
      expect(tbody.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('row content', () => {
    it('renders line number with L prefix', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByText('L10')).toBeInTheDocument()
      expect(screen.getByText('L20')).toBeInTheDocument()
      expect(screen.getByText('L30')).toBeInTheDocument()
    })

    it('renders log type badge text for each entry', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByText('API')).toBeInTheDocument()
      expect(screen.getByText('SQL')).toBeInTheDocument()
      expect(screen.getByText('FLTR')).toBeInTheDocument()
    })

    it('renders user value in the user cell', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByText('admin')).toBeInTheDocument()
      expect(screen.getByText('sysadmin')).toBeInTheDocument()
    })

    it('renders em dash for empty user field', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      // The FLTR entry has user: '' — rendered as '—'
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('renders exception message text', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(screen.getByText('API error message')).toBeInTheDocument()
      expect(screen.getByText('SQL error message')).toBeInTheDocument()
      expect(screen.getByText('Filter error message')).toBeInTheDocument()
    })

    it('applies mocked bg color to the log type badge via style', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      const apiBadge = screen.getByText('API')
      expect(apiBadge).toHaveStyle({ backgroundColor: '#dbeafe' })
    })
  })

  describe('stack trace expand/collapse', () => {
    it('renders "Trace" button only for entries with a stack trace', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      // entries with stack_trace: trace-1 and trace-3 — 2 buttons
      const traceButtons = screen.getAllByRole('button', { name: /expand stack trace/i })
      expect(traceButtons).toHaveLength(2)
    })

    it('does not render a stack trace button when stack_trace is null', () => {
      render(
        <ExceptionsSection
          data={makeData({ total: 1, exceptions: [makeEntry({ trace_id: 'trace-y', stack_trace: null })] })}
        />
      )
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('stack trace is not visible before expand', () => {
      render(<ExceptionsSection data={threeExceptions} />)
      expect(
        screen.queryByText('java.lang.NullPointerException')
      ).toBeNull()
    })

    it('shows stack trace in a pre block after clicking "Trace" button', async () => {
      const user = userEvent.setup()
      render(<ExceptionsSection data={threeExceptions} />)

      const [expandBtn] = screen.getAllByRole('button', { name: /expand stack trace/i })
      await user.click(expandBtn)

      expect(screen.getByText(/java\.lang\.NullPointerException/)).toBeInTheDocument()
    })

    it('button text changes to "Hide" after expanding', async () => {
      const user = userEvent.setup()
      render(<ExceptionsSection data={threeExceptions} />)

      const [expandBtn] = screen.getAllByRole('button', { name: /expand stack trace/i })
      await user.click(expandBtn)

      expect(screen.getByRole('button', { name: /collapse stack trace/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /collapse stack trace/i })).toHaveTextContent('Hide')
    })

    it('hides stack trace again after clicking "Hide"', async () => {
      const user = userEvent.setup()
      render(<ExceptionsSection data={threeExceptions} />)

      const [expandBtn] = screen.getAllByRole('button', { name: /expand stack trace/i })
      await user.click(expandBtn)
      expect(screen.getByText(/java\.lang\.NullPointerException/)).toBeInTheDocument()

      const hideBtn = screen.getByRole('button', { name: /collapse stack trace/i })
      await user.click(hideBtn)
      expect(screen.queryByText(/java\.lang\.NullPointerException/)).toBeNull()
    })

    it('expanding one row does not expand other rows', async () => {
      const user = userEvent.setup()
      render(<ExceptionsSection data={threeExceptions} />)

      const expandBtns = screen.getAllByRole('button', { name: /expand stack trace/i })
      // Click first button (trace-1)
      await user.click(expandBtns[0])

      // trace-1 stack is visible
      expect(screen.getByText(/java\.lang\.NullPointerException/)).toBeInTheDocument()
      // trace-3 stack is NOT visible
      expect(screen.queryByText(/com\.remedy\.FilterException/)).toBeNull()
    })

    it('aria-expanded attribute reflects expanded state', async () => {
      const user = userEvent.setup()
      render(<ExceptionsSection data={threeExceptions} />)

      const [expandBtn] = screen.getAllByRole('button', { name: /expand stack trace/i })
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

      await user.click(expandBtn)
      expect(
        screen.getByRole('button', { name: /collapse stack trace/i })
      ).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('className prop', () => {
    it('passes className to wrapper when data is present', () => {
      const { container } = render(
        <ExceptionsSection data={threeExceptions} className="custom-cls" />
      )
      expect(container.firstChild).toHaveClass('custom-cls')
    })
  })
})
