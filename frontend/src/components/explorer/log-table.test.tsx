import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LogTable } from './log-table'
import type { SearchHit } from '@/hooks/use-search'

const mockHits: SearchHit[] = [
  {
    id: 'entry-1',
    score: 1.0,
    fields: {
      line_number: 100,
      log_type: 'API',
      timestamp: '2026-02-12T10:00:00Z',
      user: 'Demo',
      form: 'HPD:Help Desk',
      api_code: 'GET_ENTRY',
      duration_ms: 150,
      success: true,
      raw_text: 'API call successful',
    },
  },
  {
    id: 'entry-2',
    score: 0.9,
    fields: {
      line_number: 101,
      log_type: 'SQL',
      timestamp: '2026-02-12T10:00:01Z',
      user: 'Admin',
      sql_statement: 'SELECT * FROM table',
      duration_ms: 2500,
      success: false,
    },
  },
  {
    id: 'entry-3',
    score: 0.8,
    fields: {
      line_number: 102,
      log_type: 'FLTR',
      timestamp: '2026-02-12T10:00:02Z',
      filter_name: 'ValidateForm',
      duration_ms: 50,
    },
  },
  {
    id: 'entry-4',
    score: 0.7,
    fields: {
      line_number: 103,
      log_type: 'ESCL',
      timestamp: '2026-02-12T10:00:03Z',
      esc_name: 'NotifyOnUpdate',
    },
  },
]

describe('LogTable', () => {
  it('renders empty state when no hits provided', () => {
    render(<LogTable hits={[]} onSelect={vi.fn()} />)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('renders table header with all columns', () => {
    render(<LogTable hits={mockHits} onSelect={vi.fn()} />)

    expect(screen.getByText('Line')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Context')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders all log entries using virtual list', () => {
    render(<LogTable hits={mockHits} onSelect={vi.fn()} />)

    // Check that virtual-list mock is rendered
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument()

    // Verify entries are rendered by checking for identifiable content
    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('FLTR')).toBeInTheDocument()
    expect(screen.getByText('ESCL')).toBeInTheDocument()
  })

  it('displays API type with correct styling', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    const apiType = screen.getByText('API')
    expect(apiType).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('displays SQL type with correct styling', () => {
    render(<LogTable hits={[mockHits[1]]} onSelect={vi.fn()} />)

    const sqlType = screen.getByText('SQL')
    expect(sqlType).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('displays FLTR type with correct styling', () => {
    render(<LogTable hits={[mockHits[2]]} onSelect={vi.fn()} />)

    const fltrType = screen.getByText('FLTR')
    expect(fltrType).toHaveClass('bg-orange-100', 'text-orange-800')
  })

  it('displays formatted timestamp', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    // Check for time format (HH:MM:SS)
    const timeElements = screen.getAllByText(/\d{2}:\d{2}:\d{2}/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('displays duration with ms suffix', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('displays success status as OK', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    const okStatus = screen.getByText('OK')
    expect(okStatus).toHaveClass('text-green-600')
  })

  it('displays failed status as ERR', () => {
    render(<LogTable hits={[mockHits[1]]} onSelect={vi.fn()} />)

    const errStatus = screen.getByText('ERR')
    expect(errStatus).toHaveClass('text-red-600')
  })

  it('calls onSelect when row is clicked', () => {
    const onSelect = vi.fn()
    render(<LogTable hits={mockHits} onSelect={onSelect} />)

    // Click on the row div (parent of the line number div)
    const firstRow = screen.getByText('100').parentElement!
    fireEvent.click(firstRow)
    expect(onSelect).toHaveBeenCalledWith(mockHits[0])
  })

  it('highlights selected row', () => {
    render(<LogTable hits={mockHits} onSelect={vi.fn()} selectedId="entry-1" />)

    // getByText('100') returns the inner div; parentElement is the row div with bg-primary/10
    const lineNumberDiv = screen.getByText('100')
    const selectedRow = lineNumberDiv.parentElement
    expect(selectedRow).toHaveClass('bg-primary/10')
  })

  it('displays form name in context column for API entries', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument()
  })

  it('displays filter name in context column for FLTR entries', () => {
    render(<LogTable hits={[mockHits[2]]} onSelect={vi.fn()} />)

    expect(screen.getByText('ValidateForm')).toBeInTheDocument()
  })

  it('displays escalation name in context column for ESCL entries', () => {
    render(<LogTable hits={[mockHits[3]]} onSelect={vi.fn()} />)

    expect(screen.getByText('NotifyOnUpdate')).toBeInTheDocument()
  })

  it('displays api_code in details column for API entries', () => {
    render(<LogTable hits={[mockHits[0]]} onSelect={vi.fn()} />)

    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
  })

  it('displays sql_statement in details column for SQL entries', () => {
    render(<LogTable hits={[mockHits[1]]} onSelect={vi.fn()} />)

    expect(screen.getByText('SELECT * FROM table')).toBeInTheDocument()
  })

  it('displays hyphen for missing optional fields', () => {
    const hitWithMissingFields: SearchHit = {
      id: 'entry-5',
      score: 0.5,
      fields: {
        line_number: 105,
        log_type: 'API',
      },
    }

    render(<LogTable hits={[hitWithMissingFields]} onSelect={vi.fn()} />)

    // Check for multiple hyphens representing missing data
    const hyphens = screen.getAllByText('-')
    expect(hyphens.length).toBeGreaterThan(3)
  })

  it('handles missing fields object gracefully', () => {
    const hitWithoutFields: SearchHit = {
      id: 'entry-6',
      score: 0.4,
      fields: {},
    }

    render(<LogTable hits={[hitWithoutFields]} onSelect={vi.fn()} />)

    // Should render without crashing
    expect(screen.getByTestId('virtual-list')).toBeInTheDocument()
  })

  it('renders correct number of rows', () => {
    render(<LogTable hits={mockHits} onSelect={vi.fn()} />)

    // All 4 mock entries should be present (check line numbers)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('102')).toBeInTheDocument()
    expect(screen.getByText('103')).toBeInTheDocument()
  })
})
