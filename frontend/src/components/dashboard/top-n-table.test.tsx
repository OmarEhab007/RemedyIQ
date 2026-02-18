/**
 * Tests for TopNTable component (rebuilt)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TopNTable } from './top-n-table'
import type { TopNEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'job-123' }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<TopNEntry> = {}): TopNEntry {
  return {
    rank: 1,
    line_number: 100,
    timestamp: '2024-01-01T00:00:00Z',
    trace_id: 'trace-001',
    rpc_id: 'rpc-001',
    queue: 'AR System',
    identifier: 'REMEDY:GetEntry',
    form: 'HPD:Help Desk',
    user: 'demo',
    duration_ms: 350,
    success: true,
    details: '',
    ...overrides,
  }
}

function makeAPIEntries(count: number): TopNEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      rank: i + 1,
      trace_id: `trace-${i}`,
      identifier: `API:Call${i}`,
      duration_ms: 1000 - i * 50,
      user: `user${i}`,
    })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopNTable', () => {

  // --- Rendering basics ---

  it('renders the title in non-compact mode', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top API Calls" logType="API" />)
    expect(screen.getByText('Top API Calls')).toBeInTheDocument()
  })

  it('renders the log type badge in non-compact mode', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top SQL" logType="SQL" />)
    expect(screen.getByLabelText('Log type: SQL')).toBeInTheDocument()
  })

  it('renders an accessible table with aria-label', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top API Calls" logType="API" />)
    expect(screen.getByRole('table', { name: 'Top API Calls' })).toBeInTheDocument()
  })

  it('renders in compact mode without Card wrapper', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByRole('table', { name: 'Top API Calls' })).toBeInTheDocument()
    // No CardTitle in compact mode
    expect(screen.queryByText('Top API Calls')).toBeNull()
  })

  // --- Empty state ---

  it('renders empty state with icon when no entries', () => {
    render(<TopNTable entries={[]} title="Top API Calls" logType="API" />)
    expect(screen.getByText(/no top api calls found/i)).toBeInTheDocument()
  })

  // --- Type-specific columns ---

  it('shows API-specific columns for API type', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top API Calls" logType="API" compact />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('API Call')).toBeInTheDocument()
    expect(within(table).getByText('Q-Time')).toBeInTheDocument()
    expect(within(table).getByText('User')).toBeInTheDocument()
  })

  it('decodes known API codes to human-readable names', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'SE' })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByText('Set Entry')).toBeInTheDocument()
    expect(screen.getByText('SE')).toBeInTheDocument()
  })

  it('shows raw identifier for unknown API codes', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'UNKNOWN_CODE' })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByTitle('UNKNOWN_CODE')).toBeInTheDocument()
  })

  it('shows SQL-specific columns for SQL type', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'user_table' })]} title="Top SQL" logType="SQL" compact />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Table')).toBeInTheDocument()
    expect(within(table).getByText('SQL Statement')).toBeInTheDocument()
    expect(within(table).getByText('Time')).toBeInTheDocument()
    // SQL type should NOT have User or Q-Time columns
    expect(within(table).queryByText('User')).toBeNull()
    expect(within(table).queryByText('Q-Time')).toBeNull()
  })

  it('shows sql_statement from parsed details in SQL tab', () => {
    const entry = makeEntry({
      identifier: 'T4381',
      details: JSON.stringify({ sql_statement: 'SELECT * FROM users WHERE id = 1' }),
    })
    render(<TopNTable entries={[entry]} title="Top SQL" logType="SQL" compact />)
    expect(screen.getByTitle('SELECT * FROM users WHERE id = 1')).toBeInTheDocument()
  })

  it('shows Filter-specific columns for FLTR type', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'SetDefaults' })]} title="Top Filters" logType="FLTR" compact />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Filter Name')).toBeInTheDocument()
    expect(within(table).getByText('Level')).toBeInTheDocument()
  })

  it('shows Escalation-specific columns for ESCL type', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'HPD:AutoAssign' })]} title="Top Escalations" logType="ESCL" compact />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Escalation')).toBeInTheDocument()
    expect(within(table).getByText('Pool')).toBeInTheDocument()
    expect(within(table).getByText('Delay')).toBeInTheDocument()
  })

  // --- Data rendering ---

  it('renders an entry row with identifier', () => {
    render(<TopNTable entries={[makeEntry({ identifier: 'REMEDY:GetEntry' })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByTitle('REMEDY:GetEntry')).toBeInTheDocument()
  })

  it('renders duration with visual bar', () => {
    render(<TopNTable entries={[makeEntry({ duration_ms: 2500 })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByText('2.50s')).toBeInTheDocument()
  })

  it('renders duration in ms for small values', () => {
    render(<TopNTable entries={[makeEntry({ duration_ms: 350 })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByText('350ms')).toBeInTheDocument()
  })

  it('renders success status as OK', () => {
    render(<TopNTable entries={[makeEntry({ success: true })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByLabelText('Success')).toBeInTheDocument()
  })

  it('renders error status as ERR with row highlight', () => {
    render(<TopNTable entries={[makeEntry({ success: false })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByLabelText('Error')).toBeInTheDocument()
  })

  it('renders rank number', () => {
    render(<TopNTable entries={[makeEntry({ rank: 3 })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders user column for API type', () => {
    render(<TopNTable entries={[makeEntry({ user: 'testuser' })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renders queue column', () => {
    render(<TopNTable entries={[makeEntry({ queue: 'Fast' })]} title="Top API Calls" logType="API" compact />)
    expect(screen.getByTitle('Fast')).toBeInTheDocument()
  })

  // --- Sorting ---

  it('renders sortable column headers with aria-sort', () => {
    render(<TopNTable entries={[makeEntry()]} title="Top API Calls" logType="API" compact />)
    const durationHeader = screen.getByRole('columnheader', { name: /duration/i })
    expect(durationHeader).toBeInTheDocument()
  })

  it('changes sort direction when sortable header is clicked', () => {
    render(<TopNTable entries={makeAPIEntries(3)} title="Top API Calls" logType="API" compact />)
    const durationHeader = screen.getByRole('columnheader', { name: /duration/i })
    fireEvent.click(durationHeader)
    expect(durationHeader).toHaveAttribute('aria-sort', 'descending')
    fireEvent.click(durationHeader)
    expect(durationHeader).toHaveAttribute('aria-sort', 'ascending')
  })

  // --- maxRows ---

  it('limits rows when maxRows is set', () => {
    const entries = makeAPIEntries(15)
    render(<TopNTable entries={entries} title="Top API Calls" logType="API" maxRows={5} compact />)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(6) // 1 header + 5 data
    expect(screen.getByText(/show all 15 entries/i)).toBeInTheDocument()
  })

  it('expands to show all rows when "Show all" is clicked', () => {
    const entries = makeAPIEntries(15)
    render(<TopNTable entries={entries} title="Top API Calls" logType="API" maxRows={5} compact />)
    fireEvent.click(screen.getByText(/show all/i))
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(16) // 1 header + 15 data
    expect(screen.getByText(/show less/i)).toBeInTheDocument()
  })

  // --- Click-to-expand detail panel ---

  it('expands detail panel when row is clicked', () => {
    render(
      <TopNTable
        entries={[makeEntry({ trace_id: 'abc123', form: 'HPD:Help Desk', user: 'Demo' })]}
        title="Top API Calls"
        logType="API"
        compact
      />
    )
    const row = screen.getAllByRole('row')[1] // first data row
    fireEvent.click(row)
    // Detail panel should show labels like "Trace ID", "Form", etc.
    expect(screen.getByText('Trace ID')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
  })

  it('collapses detail panel when same row is clicked again', () => {
    render(
      <TopNTable
        entries={[makeEntry({ trace_id: 'abc123' })]}
        title="Top API Calls"
        logType="API"
        compact
      />
    )
    const row = screen.getAllByRole('row')[1]
    fireEvent.click(row) // expand
    expect(screen.getByText('abc123')).toBeInTheDocument()
    fireEvent.click(row) // collapse
    // The detail panel trace_id text should no longer be visible
    // (trace_id may still appear in the table row itself if it's a column, so check for detail label)
    expect(screen.queryByText('Trace ID')).not.toBeInTheDocument()
  })

  // --- Details parsing ---

  it('shows escalation pool from parsed details', () => {
    const entry = makeEntry({
      identifier: 'HPD:AutoAssign',
      details: JSON.stringify({ esc_pool: 'Assignment', delay_ms: 500, thread_id: 'T001' }),
    })
    render(<TopNTable entries={[entry]} title="Top Escalations" logType="ESCL" compact />)
    expect(screen.getByTitle('Assignment')).toBeInTheDocument()
    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  it('shows filter level from parsed details', () => {
    const entry = makeEntry({
      identifier: 'SetDefaults',
      details: JSON.stringify({ filter_level: 3, filter_name: 'SetDefaults' }),
    })
    render(<TopNTable entries={[entry]} title="Top Filters" logType="FLTR" compact />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // --- Count badge in non-compact mode ---

  it('shows entry count next to title in non-compact mode', () => {
    render(<TopNTable entries={makeAPIEntries(5)} title="Top API Calls" logType="API" />)
    expect(screen.getByText('(5)')).toBeInTheDocument()
  })
})
