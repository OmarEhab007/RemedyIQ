import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DetailPanel } from './detail-panel'
import type { SearchHit } from '@/hooks/use-search'

const mockAPIEntry: SearchHit = {
  id: 'entry-api-1',
  score: 1.0,
  fields: {
    line_number: 100,
    log_type: 'API',
    timestamp: '2026-02-12T10:00:00Z',
    duration_ms: 150,
    success: true,
    user: 'Demo',
    queue: 'Default',
    thread_id: 'thread-123',
    trace_id: 'trace-abc',
    rpc_id: 'rpc-xyz',
    api_code: 'GET_ENTRY',
    form: 'HPD:Help Desk',
    raw_text: 'Full log line here',
  },
}

const mockSQLEntry: SearchHit = {
  id: 'entry-sql-1',
  score: 0.9,
  fields: {
    line_number: 200,
    log_type: 'SQL',
    timestamp: '2026-02-12T10:01:00Z',
    duration_ms: 2500,
    success: false,
    sql_table: 'HPD_Entry',
    sql_statement: 'SELECT * FROM HPD_Entry WHERE id = 1',
    error_message: 'Connection timeout',
  },
}

const mockFLTREntry: SearchHit = {
  id: 'entry-fltr-1',
  score: 0.8,
  fields: {
    line_number: 300,
    log_type: 'FLTR',
    filter_name: 'ValidateForm',
    operation: 'SET',
  },
}

const mockESCLEntry: SearchHit = {
  id: 'entry-escl-1',
  score: 0.7,
  fields: {
    line_number: 400,
    log_type: 'ESCL',
    esc_name: 'NotifyOnUpdate',
    esc_pool: 'Pool1',
  },
}

describe('DetailPanel', () => {
  it('renders panel title', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Log Entry Details')).toBeInTheDocument()
  })

  it('renders close button with correct aria-label', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    const closeButton = screen.getByLabelText('Close detail panel')
    expect(closeButton).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<DetailPanel entry={mockAPIEntry} onClose={onClose} />)

    const closeButton = screen.getByLabelText('Close detail panel')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('displays entry ID', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Entry ID')).toBeInTheDocument()
    expect(screen.getByText('entry-api-1')).toBeInTheDocument()
  })

  it('displays log type with badge styling', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Log Type')).toBeInTheDocument()
    const logTypeBadge = screen.getByText('API')
    expect(logTypeBadge).toHaveClass('bg-primary/10')
  })

  it('displays line number', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Line Number')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('displays formatted timestamp', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    // Check for formatted date (will vary by locale)
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/
    expect(screen.getByText(dateRegex)).toBeInTheDocument()
  })

  it('displays duration with ms suffix', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('displays success status', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('displays failed status', () => {
    render(<DetailPanel entry={mockSQLEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('displays context section with user, queue, thread, trace, rpc', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Context')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Demo')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.getByText('Thread')).toBeInTheDocument()
    expect(screen.getByText('thread-123')).toBeInTheDocument()
    expect(screen.getByText('Trace ID')).toBeInTheDocument()
    expect(screen.getByText('trace-abc')).toBeInTheDocument()
    expect(screen.getByText('RPC ID')).toBeInTheDocument()
    expect(screen.getByText('rpc-xyz')).toBeInTheDocument()
  })

  it('displays API-specific details section', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('API Details')).toBeInTheDocument()
    expect(screen.getByText('API Code')).toBeInTheDocument()
    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
    expect(screen.getByText('Form')).toBeInTheDocument()
    expect(screen.getByText('HPD:Help Desk')).toBeInTheDocument()
  })

  it('displays SQL-specific details section', () => {
    render(<DetailPanel entry={mockSQLEntry} onClose={vi.fn()} />)

    expect(screen.getByText('SQL Details')).toBeInTheDocument()
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('HPD_Entry')).toBeInTheDocument()
    expect(screen.getByText('Statement')).toBeInTheDocument()
    expect(screen.getByText('SELECT * FROM HPD_Entry WHERE id = 1')).toBeInTheDocument()
  })

  it('displays FLTR-specific details section', () => {
    render(<DetailPanel entry={mockFLTREntry} onClose={vi.fn()} />)

    expect(screen.getByText('Filter Details')).toBeInTheDocument()
    expect(screen.getByText('Filter Name')).toBeInTheDocument()
    expect(screen.getByText('ValidateForm')).toBeInTheDocument()
    expect(screen.getByText('Operation')).toBeInTheDocument()
    expect(screen.getByText('SET')).toBeInTheDocument()
  })

  it('displays ESCL-specific details section', () => {
    render(<DetailPanel entry={mockESCLEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Escalation Details')).toBeInTheDocument()
    expect(screen.getByText('Escalation')).toBeInTheDocument()
    expect(screen.getByText('NotifyOnUpdate')).toBeInTheDocument()
    expect(screen.getByText('Pool')).toBeInTheDocument()
    expect(screen.getByText('Pool1')).toBeInTheDocument()
  })

  it('displays error message section when present', () => {
    render(<DetailPanel entry={mockSQLEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Connection timeout')).toBeInTheDocument()
  })

  it('displays raw text section when present', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Raw Text')).toBeInTheDocument()
    expect(screen.getByText('Full log line here')).toBeInTheDocument()
  })

  it('displays all fields section with count', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    // Entry has 13 fields (including raw_text)
    expect(screen.getByText(/All Fields \(13\)/)).toBeInTheDocument()
  })

  it('expands all fields section when clicked', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    const summary = screen.getByText(/All Fields/)
    fireEvent.click(summary)

    // Should show JSON content
    expect(screen.getByText(/"line_number"/)).toBeInTheDocument()
  })

  it('does not render missing optional fields', () => {
    const minimalEntry: SearchHit = {
      id: 'entry-minimal',
      score: 0.5,
      fields: {
        log_type: 'API',
      },
    }

    render(<DetailPanel entry={minimalEntry} onClose={vi.fn()} />)

    // Should not crash and not show empty fields
    expect(screen.queryByText('Demo')).not.toBeInTheDocument()
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  it('applies monospace font to appropriate fields', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    const entryId = screen.getByText('entry-api-1')
    expect(entryId).toHaveClass('font-mono')

    const threadId = screen.getByText('thread-123')
    expect(threadId).toHaveClass('font-mono')
  })

  it('handles entries with empty fields object', () => {
    const emptyEntry: SearchHit = {
      id: 'entry-empty',
      score: 0.0,
      fields: {},
    }

    render(<DetailPanel entry={emptyEntry} onClose={vi.fn()} />)

    expect(screen.getByText('Log Entry Details')).toBeInTheDocument()
    expect(screen.getByText(/All Fields \(0\)/)).toBeInTheDocument()
  })

  it('renders scrollable content area', () => {
    render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    const panel = screen.getByText('Log Entry Details').closest('div')?.parentElement
    expect(panel).toHaveClass('overflow-y-auto')
  })

  it('renders fixed width panel', () => {
    const { container } = render(<DetailPanel entry={mockAPIEntry} onClose={vi.fn()} />)

    const panel = container.firstChild as HTMLElement
    expect(panel).toHaveClass('w-96')
  })

  it('applies correct styling to error message section', () => {
    render(<DetailPanel entry={mockSQLEntry} onClose={vi.fn()} />)

    const errorSection = screen.getByText('Connection timeout').closest('pre')
    expect(errorSection).toHaveClass('bg-destructive/10', 'text-destructive')
  })
})
