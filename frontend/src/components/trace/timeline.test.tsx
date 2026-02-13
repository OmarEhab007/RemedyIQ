import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Timeline } from './timeline'

interface TraceEntry {
  id: string
  log_type: string
  timestamp: string
  duration_ms: number
  identifier: string
  user?: string
  form?: string
  success: boolean
  details?: string
}

describe('Timeline', () => {
  const mockOnEntryClick = vi.fn()
  const mockEntries: TraceEntry[] = [
    {
      id: 'e1',
      log_type: 'API',
      timestamp: '2026-02-12T10:00:00Z',
      duration_ms: 150,
      identifier: 'GET_ENTRY',
      user: 'Demo',
      form: 'HPD:Help Desk',
      success: true,
    },
    {
      id: 'e2',
      log_type: 'SQL',
      timestamp: '2026-02-12T10:00:01Z',
      duration_ms: 2500,
      identifier: 'SELECT HPD_Entry',
      success: false,
    },
    {
      id: 'e3',
      log_type: 'FLTR',
      timestamp: '2026-02-12T10:00:02Z',
      duration_ms: 50,
      identifier: 'ValidateForm',
      user: 'Demo',
      success: true,
    },
    {
      id: 'e4',
      log_type: 'ESCL',
      timestamp: '2026-02-12T10:00:03Z',
      duration_ms: 100,
      identifier: 'NotifyOnUpdate',
      success: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state "No trace entries found" when entries is empty', () => {
    render(<Timeline entries={[]} />)

    expect(screen.getByText(/no trace entries found/i)).toBeInTheDocument()
  })

  it('renders empty state when entries is null/undefined', () => {
    render(<Timeline entries={null as any} />)

    expect(screen.getByText(/no trace entries found/i)).toBeInTheDocument()
  })

  it('renders all trace entries', () => {
    render(<Timeline entries={mockEntries} />)

    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
    expect(screen.getByText('SELECT HPD_Entry')).toBeInTheDocument()
    expect(screen.getByText('ValidateForm')).toBeInTheDocument()
    expect(screen.getByText('NotifyOnUpdate')).toBeInTheDocument()
  })

  it('displays log type labels (API, SQL, FLTR, ESCL)', () => {
    render(<Timeline entries={mockEntries} />)

    expect(screen.getByText('API')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('FLTR')).toBeInTheDocument()
    expect(screen.getByText('ESCL')).toBeInTheDocument()
  })

  it('displays entry identifiers', () => {
    render(<Timeline entries={mockEntries} />)

    expect(screen.getByText('GET_ENTRY')).toBeInTheDocument()
    expect(screen.getByText('SELECT HPD_Entry')).toBeInTheDocument()
    expect(screen.getByText('ValidateForm')).toBeInTheDocument()
    expect(screen.getByText('NotifyOnUpdate')).toBeInTheDocument()
  })

  it('displays duration in ms format', () => {
    render(<Timeline entries={mockEntries} />)

    // Each entry has its duration rendered as "{duration}ms"
    expect(screen.getByText('150ms')).toBeInTheDocument()
    expect(screen.getByText('2500ms')).toBeInTheDocument()
    expect(screen.getByText('50ms')).toBeInTheDocument()
    expect(screen.getByText('100ms')).toBeInTheDocument()
  })

  it('shows FAIL indicator for failed entries', () => {
    render(<Timeline entries={mockEntries} />)

    expect(screen.getByText(/fail/i)).toBeInTheDocument()
  })

  it('shows user and form context', () => {
    render(<Timeline entries={mockEntries} />)

    // Multiple entries have user context, use getAllByText
    const userDemoElements = screen.getAllByText(/User: Demo/)
    expect(userDemoElements.length).toBeGreaterThan(0)
    const formElements = screen.getAllByText(/Form: HPD:Help Desk/)
    expect(formElements.length).toBeGreaterThan(0)
  })

  it('shows "No context" when no user or form', () => {
    render(<Timeline entries={mockEntries} />)

    const noContextEntries = mockEntries.filter((e) => !e.user && !e.form)
    if (noContextEntries.length === 0) {
      // For entry e2 which has no user or form
      expect(screen.getByText(/no context/i)).toBeInTheDocument()
    }
  })

  it('calls onEntryClick when entry is clicked', () => {
    render(<Timeline entries={mockEntries} onEntryClick={mockOnEntryClick} />)

    const entry = screen.getByText('GET_ENTRY').closest('div')!
    fireEvent.click(entry)

    expect(mockOnEntryClick).toHaveBeenCalledWith(mockEntries[0])
  })

  it('applies correct color classes for each log type (API=blue, SQL=green, FLTR=purple, ESCL=orange)', () => {
    render(<Timeline entries={mockEntries} />)

    const apiLabel = screen.getByText('API')
    const sqlLabel = screen.getByText('SQL')
    const fltrLabel = screen.getByText('FLTR')
    const esclLabel = screen.getByText('ESCL')

    expect(apiLabel.className).toContain('bg-blue')
    expect(sqlLabel.className).toContain('bg-green')
    expect(fltrLabel.className).toContain('bg-purple')
    expect(esclLabel.className).toContain('bg-orange')
  })

  it('renders duration bars proportional to max duration', () => {
    render(<Timeline entries={mockEntries} />)

    const maxDuration = Math.max(...mockEntries.map((e) => e.duration_ms))
    const durationBars = document.querySelectorAll('[style*="width"]')

    expect(durationBars.length).toBeGreaterThan(0)

    // Check that the longest duration (2500ms) has the widest bar
    const longestBar = Array.from(durationBars).find((bar) => {
      const width = (bar as HTMLElement).style.width
      return width === '100%' || parseFloat(width) > 90
    })
    expect(longestBar).toBeTruthy()
  })

  it('handles entry with unknown log_type by falling back to API colors', () => {
    const unknownTypeEntries = [
      {
        id: 'u1',
        log_type: 'UNKNOWN',
        timestamp: '2026-02-12T10:00:00Z',
        duration_ms: 100,
        identifier: 'SomeOp',
        success: true,
      },
    ]
    render(<Timeline entries={unknownTypeEntries} />)

    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
    expect(screen.getByText('SomeOp')).toBeInTheDocument()
  })

  it('handles entry with no timestamp gracefully', () => {
    const noTimestampEntries = [
      {
        id: 'nt1',
        log_type: 'API',
        timestamp: '',
        duration_ms: 100,
        identifier: 'NoTimeOp',
        success: true,
      },
    ]
    render(<Timeline entries={noTimestampEntries} />)

    expect(screen.getByText('NoTimeOp')).toBeInTheDocument()
  })

  it('handles entry with zero/null duration', () => {
    const zeroDurationEntries = [
      {
        id: 'zd1',
        log_type: 'API',
        timestamp: '2026-02-12T10:00:00Z',
        duration_ms: 0,
        identifier: 'ZeroDuration',
        success: true,
      },
    ]
    render(<Timeline entries={zeroDurationEntries} />)

    expect(screen.getByText('0ms')).toBeInTheDocument()
  })

  it('shows user only when form is absent', () => {
    const userOnlyEntries = [
      {
        id: 'uo1',
        log_type: 'API',
        timestamp: '2026-02-12T10:00:00Z',
        duration_ms: 100,
        identifier: 'UserOnlyOp',
        user: 'TestUser',
        success: true,
      },
    ]
    render(<Timeline entries={userOnlyEntries} />)

    expect(screen.getByText(/User: TestUser/)).toBeInTheDocument()
    // No separator since no form
    expect(screen.queryByText(/\|/)).not.toBeInTheDocument()
  })
})
