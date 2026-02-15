import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNTable } from './top-n-table'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

interface TopNEntry {
  rank: number
  identifier: string
  duration_ms: number
  success: boolean
  line_number: number
  trace_id?: string
  rpc_id?: string
  form?: string
  user?: string
  queue?: string
  queue_time_ms?: number
  details?: string
}

const mockApiCalls: TopNEntry[] = [
  {
    rank: 1,
    identifier: 'GET_ENTRY',
    duration_ms: 5000,
    success: true,
    line_number: 100,
    trace_id: 'trace-1',
    rpc_id: 'rpc-1',
    form: 'HPD:Help Desk',
    user: 'Demo',
    queue: 'Default',
    details: '{"thread_id":"T001","raw_text":"sample log line"}',
  },
  {
    rank: 2,
    identifier: 'SET_ENTRY',
    duration_ms: 3000,
    success: false,
    line_number: 200,
    form: 'CHG:Change',
    user: 'Admin',
  },
]

const mockSqlStatements: TopNEntry[] = [
  {
    rank: 1,
    identifier: 'SELECT HPD_Entry',
    duration_ms: 2500,
    success: true,
    line_number: 150,
    details: '{"sql_table":"HPD_Entry","sql_statement":"SELECT * FROM HPD_Entry WHERE id=1"}',
  },
]

const mockFilters: TopNEntry[] = [
  {
    rank: 1,
    identifier: 'ValidateForm',
    duration_ms: 1000,
    success: true,
    line_number: 300,
    details: '{"filter_name":"ValidateForm","filter_level":2}',
  },
]

const mockEscalations: TopNEntry[] = [
  {
    rank: 1,
    identifier: 'NotifyOnUpdate',
    duration_ms: 500,
    success: true,
    line_number: 400,
    details: '{"esc_pool":"Pool1","delay_ms":50,"error_encountered":false}',
  },
]

describe('TopNTable', () => {
  it('renders tab buttons: API Calls, SQL, Filters, Escalations with counts', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
        jobId="job-123"
      />
    )

    // Check tab buttons exist with counts
    expect(screen.getByText(/API Calls/i)).toBeInTheDocument()
    expect(screen.getByText(/SQL/i)).toBeInTheDocument()
    expect(screen.getByText(/Filters/i)).toBeInTheDocument()
    expect(screen.getByText(/Escalations/i)).toBeInTheDocument()

    // Check counts are displayed
    expect(screen.getByText('2')).toBeInTheDocument() // API calls count
    expect(screen.getByText('1')).toBeInTheDocument() // SQL, Filters, Escalations count
  })

  it('renders API tab by default', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Check that API call data is visible
    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
    expect(screen.getByText('SET_ENTRY')).toBeInTheDocument()
  })

  it('shows API columns: #, Identifier, Form, User, Queue, Duration, Status', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Check for column headers (API tab has: #, Identifier, Form, Queue, Duration, Status)
    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('Identifier')).toBeInTheDocument()
    expect(screen.getByText('Form')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('Duration (ms)')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders API entries with rank, identifier, form, user, duration', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Check rank
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // Check identifier
    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
    expect(screen.getByText('SET_ENTRY')).toBeInTheDocument()

    // Check form
    expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument()
    expect(screen.getByText('CHG:Change')).toBeInTheDocument()

    // Check duration (formatted with toLocaleString)
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('3,000')).toBeInTheDocument()
  })

  it('shows green dot for success, red for failure', () => {
    const { container } = render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Check for success (green) and failure (red) indicators
    const greenDots = container.querySelectorAll('.bg-green-500, [class*="bg-green"]')
    const redDots = container.querySelectorAll('.bg-red-500, [class*="bg-red"]')

    expect(greenDots.length).toBeGreaterThan(0)
    expect(redDots.length).toBeGreaterThan(0)
  })

  it('switches to SQL tab on click and shows SQL-specific columns', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Click SQL tab
    const sqlTab = screen.getByRole('button', { name: /SQL/i })
    fireEvent.click(sqlTab)

    // Check that SQL data is visible
    expect(screen.getByText('SELECT HPD_Entry')).toBeInTheDocument()
    expect(screen.getByText('2,500')).toBeInTheDocument()
  })

  it('switches to Filters tab', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Click Filters tab
    const filtersTab = screen.getByRole('button', { name: /Filters/i })
    fireEvent.click(filtersTab)

    // Check that Filters data is visible (identifier column)
    const filterNames = screen.getAllByText('ValidateForm')
    expect(filterNames.length).toBeGreaterThan(0)
  })

  it('switches to Escalations tab', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Click Escalations tab
    const escalationsTab = screen.getByRole('button', { name: /Escalations/i })
    fireEvent.click(escalationsTab)

    // Check that Escalations data is visible
    expect(screen.getByText('NotifyOnUpdate')).toBeInTheDocument()
  })

  it('expands row on click to show trace details (trace_id, rpc_id, thread, line)', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Click on first row to expand
    const firstRow = screen.getByText('GET_ENTRY').closest('tr')
    expect(firstRow).toBeInTheDocument()
    fireEvent.click(firstRow!)

    // Check for trace details
    expect(screen.getByText(/trace-1/)).toBeInTheDocument()
    expect(screen.getByText(/rpc-1/)).toBeInTheDocument()
    expect(screen.getByText(/T001/)).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('collapses expanded row on second click', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Click on first row to expand
    const firstRow = screen.getByText('GET_ENTRY').closest('tr')
    fireEvent.click(firstRow!)

    // Verify details are visible
    expect(screen.getByText(/trace-1/)).toBeInTheDocument()

    // Click again to collapse
    fireEvent.click(firstRow!)

    // Details should no longer be visible
    expect(screen.queryByText(/trace-1/)).not.toBeInTheDocument()
  })

  it('shows "View in Explorer" link when jobId is provided', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
        jobId="job-123"
      />
    )

    // Click on first row to expand
    const firstRow = screen.getByText('GET_ENTRY').closest('tr')
    fireEvent.click(firstRow!)

    // Check for "View in Explorer" link
    const explorerLink = screen.getByRole('link', { name: /view in explorer/i })
    expect(explorerLink).toBeInTheDocument()
    expect(explorerLink).toHaveAttribute('href', expect.stringContaining('/explorer'))
    expect(explorerLink).toHaveAttribute('href', expect.stringContaining('job-123'))
  })

  it('shows "No data available" for empty tab', () => {
    render(
      <TopNTable
        apiCalls={[]}
        sqlStatements={[]}
        filters={[]}
        escalations={[]}
      />
    )

    // Should show "No data available" message
    expect(screen.getByText(/no data available/i)).toBeInTheDocument()
  })

  it('shows SQL-specific columns (Table, Statement, Queue Wait) with parsed details', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    const sqlTab = screen.getByRole('button', { name: /SQL/i })
    fireEvent.click(sqlTab)

    // SQL columns
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('Statement')).toBeInTheDocument()

    // Parsed details: sql_table and sql_statement
    expect(screen.getByText('HPD_Entry')).toBeInTheDocument()
    expect(screen.getByText(/SELECT \* FROM HPD_Entry/)).toBeInTheDocument()
  })

  it('shows Filter-specific columns (Filter Name, Level)', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    const filtersTab = screen.getByRole('button', { name: /Filters/i })
    fireEvent.click(filtersTab)

    // Filter columns
    expect(screen.getByText('Filter Name')).toBeInTheDocument()
    expect(screen.getByText('Level')).toBeInTheDocument()

    // Parsed filter details
    const filterNames = screen.getAllByText('ValidateForm')
    expect(filterNames.length).toBeGreaterThan(0)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows Escalation-specific columns (Pool, Delay, Error)', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    const escalationsTab = screen.getByRole('button', { name: /Escalations/i })
    fireEvent.click(escalationsTab)

    // Escalation columns
    expect(screen.getByText('Pool')).toBeInTheDocument()
    expect(screen.getByText('Delay (ms)')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()

    // Parsed escalation details
    expect(screen.getByText('Pool1')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('shows raw_text in expanded row when available', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Expand first API call which has raw_text in details
    const firstRow = screen.getByText('GET_ENTRY').closest('tr')
    fireEvent.click(firstRow!)

    expect(screen.getByText(/sample log line/)).toBeInTheDocument()
  })

  it('shows "-" for missing optional fields in API tab', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Second API call has no queue, so it renders "-"
    const dashCells = screen.getAllByText('-')
    expect(dashCells.length).toBeGreaterThan(0)
  })

  it('handles invalid JSON in details gracefully', () => {
    const badDetailsApiCalls: TopNEntry[] = [
      {
        rank: 1,
        identifier: 'BAD_ENTRY',
        duration_ms: 100,
        success: true,
        line_number: 50,
        details: 'not valid json{{{',
      },
    ]

    render(
      <TopNTable
        apiCalls={badDetailsApiCalls}
        sqlStatements={[]}
        filters={[]}
        escalations={[]}
      />
    )

    expect(screen.getByText('BAD_ENTRY')).toBeInTheDocument()

    // Expand row - should show "-" for parsed details
    const row = screen.getByText('BAD_ENTRY').closest('tr')
    fireEvent.click(row!)

    // Thread ID should show "-" since details couldn't be parsed
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders duration with toLocaleString formatting', () => {
    render(
      <TopNTable
        apiCalls={mockApiCalls}
        sqlStatements={mockSqlStatements}
        filters={mockFilters}
        escalations={mockEscalations}
      />
    )

    // Check that durations are formatted with commas
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('3,000')).toBeInTheDocument()

    // Switch to SQL tab
    const sqlTab = screen.getByRole('button', { name: /SQL/i })
    fireEvent.click(sqlTab)

    expect(screen.getByText('2,500')).toBeInTheDocument()

    // Switch to Filters tab
    const filtersTab = screen.getByRole('button', { name: /Filters/i })
    fireEvent.click(filtersTab)

    expect(screen.getByText('1,000')).toBeInTheDocument()

    // Switch to Escalations tab
    const escalationsTab = screen.getByRole('button', { name: /Escalations/i })
    fireEvent.click(escalationsTab)

    expect(screen.getByText('500')).toBeInTheDocument()
  })
})
