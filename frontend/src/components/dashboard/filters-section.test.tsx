/**
 * T066 — Tests for FiltersSection component (T062)
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FiltersSection } from './filters-section'
import type {
  FilterComplexityResponse,
  MostExecutedFilter,
  FilterPerTransaction,
} from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMostExecuted(overrides: Partial<MostExecutedFilter> = {}): MostExecutedFilter {
  return {
    filter_name: 'SYS:ValidateFields',
    execution_count: 150,
    avg_duration_ms: 200,
    max_duration_ms: 800,
    total_duration_ms: 30_000,
    error_count: 0,
    form: 'HPD:Help Desk',
    ...overrides,
  }
}

function makePerTxn(overrides: Partial<FilterPerTransaction> = {}): FilterPerTransaction {
  return {
    trace_id: 'trace-001',
    rpc_id: 'rpc-1',
    timestamp: '2024-03-15T10:00:00Z',
    filter_count: 5,
    total_filter_duration_ms: 1200,
    user: 'admin',
    queue: 'AR System',
    ...overrides,
  }
}

function makeData(overrides: Partial<FilterComplexityResponse> = {}): FilterComplexityResponse {
  return {
    job_id: 'job-001',
    most_executed: [],
    filters_per_transaction: [],
    avg_filters_per_transaction: 0,
    max_filters_per_transaction: 0,
    ...overrides,
  }
}

const fullData: FilterComplexityResponse = {
  job_id: 'job-001',
  avg_filters_per_transaction: 7.4,
  max_filters_per_transaction: 25,
  most_executed: [
    makeMostExecuted({
      filter_name: 'SYS:ValidateFields',
      execution_count: 500,
      avg_duration_ms: 250,
      max_duration_ms: 800,
      error_count: 0,
      form: 'HPD:Help Desk',
    }),
    makeMostExecuted({
      filter_name: 'SYS:SetDefaults',
      execution_count: 300,
      avg_duration_ms: 120,
      max_duration_ms: 1500,
      error_count: 2,
      form: null,
    }),
    makeMostExecuted({
      filter_name: 'SYS:SlowFilter',
      execution_count: 10,
      avg_duration_ms: 3000,
      max_duration_ms: 7000,
      error_count: 0,
      form: 'CHG:Change Request',
    }),
  ],
  filters_per_transaction: [
    makePerTxn({ trace_id: 'trace-alpha', filter_count: 30, total_filter_duration_ms: 5000, user: 'admin', queue: 'AR System' }),
    makePerTxn({ trace_id: 'trace-beta',  filter_count: 12, total_filter_duration_ms: 800,  user: 'sysadmin', queue: '' }),
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FiltersSection', () => {
  describe('empty state', () => {
    it('shows empty message when both arrays are empty', () => {
      render(<FiltersSection data={makeData()} />)
      expect(
        screen.getByText('No filter complexity data available for this job.')
      ).toBeInTheDocument()
    })

    it('does not render any table when both arrays are empty', () => {
      render(<FiltersSection data={makeData()} />)
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('renders content when only most_executed has data', () => {
      render(
        <FiltersSection
          data={makeData({
            most_executed: [makeMostExecuted()],
            filters_per_transaction: [],
            avg_filters_per_transaction: 1,
            max_filters_per_transaction: 1,
          })}
        />
      )
      expect(screen.queryByText(/no filter complexity/i)).toBeNull()
      expect(screen.getByRole('table', { name: 'Most executed filters' })).toBeInTheDocument()
    })

    it('renders content when only filters_per_transaction has data', () => {
      render(
        <FiltersSection
          data={makeData({
            most_executed: [],
            filters_per_transaction: [makePerTxn()],
            avg_filters_per_transaction: 5,
            max_filters_per_transaction: 5,
          })}
        />
      )
      expect(screen.queryByText(/no filter complexity/i)).toBeNull()
      expect(screen.getByRole('table', { name: 'Filters per transaction' })).toBeInTheDocument()
    })
  })

  describe('summary stats', () => {
    it('renders avg filters per transaction label', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('Avg Filters/Transaction')).toBeInTheDocument()
    })

    it('renders avg filters per transaction value with one decimal', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('7.4')).toBeInTheDocument()
    })

    it('renders max filters per transaction label', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('Max Filters/Transaction')).toBeInTheDocument()
    })

    it('renders max filters per transaction value', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('25')).toBeInTheDocument()
    })

    it('max > 50 applies error color class to value', () => {
      render(
        <FiltersSection
          data={makeData({
            most_executed: [makeMostExecuted()],
            avg_filters_per_transaction: 10,
            max_filters_per_transaction: 55,
          })}
        />
      )
      const maxValue = screen.getByText('55')
      expect(maxValue.className).toMatch(/color-error/)
    })

    it('max > 20 and <= 50 applies warning color class to value', () => {
      render(
        <FiltersSection
          data={makeData({
            most_executed: [makeMostExecuted()],
            avg_filters_per_transaction: 10,
            max_filters_per_transaction: 30,
          })}
        />
      )
      const maxValue = screen.getByText('30')
      expect(maxValue.className).toMatch(/color-warning/)
    })

    it('max value 25 (> 20) applies warning color', () => {
      render(<FiltersSection data={fullData} />)
      const maxValue = screen.getByText('25')
      expect(maxValue.className).toMatch(/color-warning/)
    })

    it('max <= 20 applies no error or warning', () => {
      render(
        <FiltersSection
          data={makeData({
            most_executed: [makeMostExecuted()],
            avg_filters_per_transaction: 3,
            max_filters_per_transaction: 10,
          })}
        />
      )
      const maxValue = screen.getByText('10')
      expect(maxValue.className).not.toMatch(/color-error/)
      expect(maxValue.className).not.toMatch(/color-warning/)
    })
  })

  describe('most executed filters table', () => {
    it('renders table with aria-label', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByRole('table', { name: 'Most executed filters' })).toBeInTheDocument()
    })

    it('renders section heading', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('Most Executed Filters')).toBeInTheDocument()
    })

    it('renders all column headers', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Most executed filters' })
      expect(within(table).getByText('Filter Name')).toBeInTheDocument()
      expect(within(table).getByText('Executions')).toBeInTheDocument()
      expect(within(table).getByText('Avg Duration')).toBeInTheDocument()
      expect(within(table).getByText('Max Duration')).toBeInTheDocument()
      expect(within(table).getByText('Errors')).toBeInTheDocument()
      expect(within(table).getByText('Form')).toBeInTheDocument()
    })

    it('renders filter names', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('SYS:ValidateFields')).toBeInTheDocument()
      expect(screen.getByText('SYS:SetDefaults')).toBeInTheDocument()
      expect(screen.getByText('SYS:SlowFilter')).toBeInTheDocument()
    })

    it('renders execution counts in the most-executed table', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Most executed filters' })
      expect(within(table).getByText('500')).toBeInTheDocument()
      expect(within(table).getByText('300')).toBeInTheDocument()
    })

    it('renders form name or em dash when null', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument()
      // SYS:SetDefaults has form: null -> rendered as '—'
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('most executed filters duration color coding', () => {
    it('max_duration_ms > 5000 renders max duration with error color', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:SlowFilter max: 7000ms -> 7.00s
      const maxDuration = screen.getByText('7.00s')
      expect(maxDuration.className).toMatch(/color-error/)
    })

    it('max_duration_ms > 1000 and <= 5000 renders max duration with warning color', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:SetDefaults max: 1500ms -> 1.50s
      const maxDuration = screen.getByText('1.50s')
      expect(maxDuration.className).toMatch(/color-warning/)
    })

    it('max_duration_ms <= 1000 renders max duration without error or warning color', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:ValidateFields max: 800ms — may appear in both tables; check all
      const allDurations = screen.getAllByText('800ms')
      const hasNeutral = allDurations.some(
        (el) => !el.className.match(/color-error/) && !el.className.match(/color-warning/)
      )
      expect(hasNeutral).toBe(true)
    })

    it('duration values format correctly for sub-second values', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:ValidateFields avg: 250ms
      const table = screen.getByRole('table', { name: 'Most executed filters' })
      expect(within(table).getByText('250ms')).toBeInTheDocument()
    })

    it('duration values format correctly for multi-second values', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:SlowFilter avg: 3000ms -> 3.00s
      expect(screen.getByText('3.00s')).toBeInTheDocument()
    })
  })

  describe('most executed filters error count styling', () => {
    it('error_count > 0 renders error count with error color', () => {
      render(<FiltersSection data={fullData} />)
      // SYS:SetDefaults has error_count: 2
      const errorSpan = screen.getByText('2')
      expect(errorSpan.className).toMatch(/color-error/)
    })

    it('zero error count does not get error color', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Most executed filters' })
      const rows = within(table).getAllByRole('row')
      // SYS:ValidateFields row (index 1) has error_count: 0
      const validateRow = rows[1]
      const zeroSpan = within(validateRow).getByText('0')
      expect(zeroSpan.className).not.toMatch(/color-error/)
    })

    it('row with error_count > 0 gets error-light background class', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Most executed filters' })
      const rows = within(table).getAllByRole('row')
      // SYS:SetDefaults is index 2 (has error_count: 2)
      const setDefaultsRow = rows[2]
      expect(setDefaultsRow.className).toMatch(/color-error-light/)
    })
  })

  describe('filters per transaction table', () => {
    it('renders table with aria-label', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByRole('table', { name: 'Filters per transaction' })).toBeInTheDocument()
    })

    it('renders "Filters Per Transaction" section heading with item count', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText(/Filters Per Transaction \(Top 2\)/i)).toBeInTheDocument()
    })

    it('renders all column headers', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      expect(within(table).getByText('Trace ID')).toBeInTheDocument()
      expect(within(table).getByText('Filter Count')).toBeInTheDocument()
      expect(within(table).getByText('Total Duration')).toBeInTheDocument()
      expect(within(table).getByText('User')).toBeInTheDocument()
      expect(within(table).getByText('Queue')).toBeInTheDocument()
    })

    it('renders trace IDs', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('trace-alpha')).toBeInTheDocument()
      expect(screen.getByText('trace-beta')).toBeInTheDocument()
    })

    it('renders filter counts scoped to per-transaction table', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      expect(within(table).getByText('30')).toBeInTheDocument()
      expect(within(table).getByText('12')).toBeInTheDocument()
    })

    it('renders total duration scoped to per-transaction table', () => {
      render(<FiltersSection data={fullData} />)
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      // trace-alpha: 5000ms -> 5.00s
      expect(within(table).getByText('5.00s')).toBeInTheDocument()
      // trace-beta: 800ms -> 800ms
      expect(within(table).getByText('800ms')).toBeInTheDocument()
    })

    it('renders user values', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.getByText('admin')).toBeInTheDocument()
      expect(screen.getByText('sysadmin')).toBeInTheDocument()
    })

    it('renders em dash for empty queue string', () => {
      render(<FiltersSection data={fullData} />)
      // trace-beta has queue: '' -> rendered as '—'
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('limits per-transaction table to 20 rows', () => {
      // Create 25 transactions
      const manyTxns = Array.from({ length: 25 }, (_, i) =>
        makePerTxn({ trace_id: `trace-${i}` })
      )
      render(
        <FiltersSection
          data={makeData({
            filters_per_transaction: manyTxns,
            most_executed: [],
            avg_filters_per_transaction: 5,
            max_filters_per_transaction: 10,
          })}
        />
      )
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      const rows = within(table).getAllByRole('row')
      // 1 header + 20 data rows (capped at 20)
      expect(rows).toHaveLength(21)
      expect(screen.getByText(/Top 20/i)).toBeInTheDocument()
    })
  })

  describe('filters per second column', () => {
    const dataWithFps: FilterComplexityResponse = {
      ...fullData,
      filters_per_transaction: [
        makePerTxn({ trace_id: 'fps-normal', filter_count: 10, filters_per_sec: 25.5 }),
        makePerTxn({ trace_id: 'fps-high', filter_count: 200, filters_per_sec: 150.3 }),
        makePerTxn({ trace_id: 'fps-missing', filter_count: 5 }),
      ],
    }

    it('shows Filters/sec column header when FPS data is present', () => {
      render(<FiltersSection data={dataWithFps} />)
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      expect(within(table).getByText('Filters/sec')).toBeInTheDocument()
    })

    it('does not show Filters/sec column when no FPS data', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.queryByText('Filters/sec')).toBeNull()
    })

    it('renders FPS values with one decimal place', () => {
      render(<FiltersSection data={dataWithFps} />)
      expect(screen.getByText('25.5')).toBeInTheDocument()
      expect(screen.getByText('150.3')).toBeInTheDocument()
    })

    it('highlights FPS > 100 with warning color', () => {
      render(<FiltersSection data={dataWithFps} />)
      const highFps = screen.getByText('150.3')
      expect(highFps.className).toMatch(/color-warning/)
    })

    it('normal FPS values do not get warning color', () => {
      render(<FiltersSection data={dataWithFps} />)
      const normalFps = screen.getByText('25.5')
      expect(normalFps.className).not.toMatch(/color-warning/)
    })

    it('renders em dash when filters_per_sec is missing', () => {
      render(<FiltersSection data={dataWithFps} />)
      const table = screen.getByRole('table', { name: 'Filters per transaction' })
      const dashes = within(table).getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('filter levels sub-table', () => {
    const dataWithLevels: FilterComplexityResponse = {
      ...fullData,
      filter_levels: [
        { line_number: 100, filter_level: 2, operation: 'SET', form: 'HPD:Help Desk', trace_id: 'trace-1', request_id: 'req-1' },
        { line_number: 250, filter_level: 7, operation: 'GET', form: 'CHG:Change Request', trace_id: 'trace-2', request_id: 'req-2' },
        { line_number: 500, filter_level: 3, operation: 'MODIFY', form: '', trace_id: 'trace-3', request_id: 'req-3' },
      ],
    }

    it('renders filter levels table when data is present', () => {
      render(<FiltersSection data={dataWithLevels} />)
      expect(screen.getByRole('table', { name: 'Filter nesting levels' })).toBeInTheDocument()
    })

    it('renders Filter Levels heading', () => {
      render(<FiltersSection data={dataWithLevels} />)
      expect(screen.getByText('Filter Levels (Nesting Depth)')).toBeInTheDocument()
    })

    it('renders column headers for filter levels', () => {
      render(<FiltersSection data={dataWithLevels} />)
      const table = screen.getByRole('table', { name: 'Filter nesting levels' })
      expect(within(table).getByText('Line')).toBeInTheDocument()
      expect(within(table).getByText('Level')).toBeInTheDocument()
      expect(within(table).getByText('Operation')).toBeInTheDocument()
    })

    it('renders level values', () => {
      render(<FiltersSection data={dataWithLevels} />)
      const table = screen.getByRole('table', { name: 'Filter nesting levels' })
      expect(within(table).getByText('2')).toBeInTheDocument()
      expect(within(table).getByText('7')).toBeInTheDocument()
      expect(within(table).getByText('3')).toBeInTheDocument()
    })

    it('highlights level > 5 with warning styling', () => {
      render(<FiltersSection data={dataWithLevels} />)
      const table = screen.getByRole('table', { name: 'Filter nesting levels' })
      const level7 = within(table).getByText('7')
      expect(level7.className).toMatch(/color-warning/)
    })

    it('level <= 5 does not get warning styling', () => {
      render(<FiltersSection data={dataWithLevels} />)
      const table = screen.getByRole('table', { name: 'Filter nesting levels' })
      const level2 = within(table).getByText('2')
      expect(level2.className).not.toMatch(/color-warning/)
    })

    it('does not render filter levels table when no data', () => {
      render(<FiltersSection data={fullData} />)
      expect(screen.queryByRole('table', { name: 'Filter nesting levels' })).toBeNull()
    })

    it('renders operation names', () => {
      render(<FiltersSection data={dataWithLevels} />)
      expect(screen.getByText('SET')).toBeInTheDocument()
      expect(screen.getByText('GET')).toBeInTheDocument()
      expect(screen.getByText('MODIFY')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('passes className to wrapper when data is present', () => {
      const { container } = render(
        <FiltersSection data={fullData} className="filters-wrapper" />
      )
      expect(container.firstChild).toHaveClass('filters-wrapper')
    })
  })
})
