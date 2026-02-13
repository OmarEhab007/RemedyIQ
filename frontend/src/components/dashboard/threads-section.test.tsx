import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThreadsSection } from './threads-section'
import type { ThreadStatsResponse } from '@/lib/api'

const mockData: ThreadStatsResponse = {
  threads: [
    {
      thread_id: 'T001',
      total_calls: 1500,
      total_ms: 45000.5,
      avg_ms: 30.0,
      max_ms: 500.25,
      error_count: 5,
      busy_pct: 95.5,
    },
    {
      thread_id: 'T002',
      total_calls: 800,
      total_ms: 20000.0,
      avg_ms: 25.0,
      max_ms: 300.0,
      error_count: 2,
      busy_pct: 45.0,
    },
    {
      thread_id: 'T003',
      total_calls: 300,
      total_ms: 5000.0,
      avg_ms: 16.67,
      max_ms: 100.0,
      error_count: 0,
      busy_pct: 15.0,
    },
  ],
  total_threads: 3,
}

describe('ThreadsSection', () => {
  it('renders loading state with pulse animation', () => {
    render(
      <ThreadsSection data={null} loading={true} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Thread Statistics')).toBeInTheDocument()
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders error state with error message and retry button', () => {
    const errorMessage = 'Failed to load threads'
    render(
      <ThreadsSection
        data={null}
        loading={false}
        error={errorMessage}
        refetch={vi.fn()}
      />
    )
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('calls refetch on retry button click', () => {
    const refetchMock = vi.fn()
    render(
      <ThreadsSection
        data={null}
        loading={false}
        error="Test error"
        refetch={refetchMock}
      />
    )
    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)
    expect(refetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders "No thread data available" when data is null', () => {
    render(
      <ThreadsSection data={null} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No thread data available')).toBeInTheDocument()
  })

  it('renders "No thread data available" when threads array is empty', () => {
    const emptyData: ThreadStatsResponse = { threads: [], total_threads: 0 }
    render(
      <ThreadsSection data={emptyData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No thread data available')).toBeInTheDocument()
  })

  it('renders title and total threads badge', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Thread Statistics')).toBeInTheDocument()
    expect(screen.getByText('3 threads detected')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Thread ID')).toBeInTheDocument()
    expect(screen.getByText('Total Calls')).toBeInTheDocument()
    expect(screen.getByText('Total Time(ms)')).toBeInTheDocument()
    expect(screen.getByText('Avg Time(ms)')).toBeInTheDocument()
    expect(screen.getByText('Max Time(ms)')).toBeInTheDocument()
    expect(screen.getByText('Errors')).toBeInTheDocument()
    expect(screen.getByText('Busy%')).toBeInTheDocument()
  })

  it('renders thread data rows', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('T001')).toBeInTheDocument()
    expect(screen.getByText('T002')).toBeInTheDocument()
    expect(screen.getByText('T003')).toBeInTheDocument()
  })

  it('formats total_calls with toLocaleString', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('1,500')).toBeInTheDocument()
    expect(screen.getByText('800')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('formats timing values with toFixed(2)', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('45000.50')).toBeInTheDocument()
    expect(screen.getByText('30.00')).toBeInTheDocument()
    expect(screen.getByText('500.25')).toBeInTheDocument()
  })

  it('renders busy% with progress bar and percentage text', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('95.5%')).toBeInTheDocument()
    expect(screen.getByText('45.0%')).toBeInTheDocument()
    expect(screen.getByText('15.0%')).toBeInTheDocument()

    // Check progress bar widths
    const progressBars = document.querySelectorAll('[style*="width"]')
    expect(progressBars.length).toBeGreaterThanOrEqual(3)
  })

  it('applies correct busy% colors (>=90 red, >=50 yellow, <50 green)', () => {
    const { container } = render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // T001 has 95.5% → red
    const redBars = container.querySelectorAll('.bg-red-500')
    expect(redBars.length).toBeGreaterThan(0)

    // T002 has 45.0% → green (< 50)
    const greenBars = container.querySelectorAll('.bg-green-500')
    expect(greenBars.length).toBeGreaterThan(0)
  })

  it('highlights high busy% rows (>90%) with amber background', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // T001 has 95.5% (>90), should have amber background
    const warningRow = screen.getByText('T001').closest('tr')!
    expect(warningRow.className).toContain('bg-amber-50')

    // T002 has 45.0% (<=90), should not
    const normalRow = screen.getByText('T002').closest('tr')!
    expect(normalRow.className).not.toContain('bg-amber-50')
  })

  it('sorts by clicking column headers - default is busy_pct desc', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // Default sort: busy_pct desc → T001 (95.5%) first
    const rows = screen.getAllByRole('row')
    // rows[0] is header, rows[1] is first data row
    expect(rows[1]).toHaveTextContent('T001')
    expect(rows[2]).toHaveTextContent('T002')
    expect(rows[3]).toHaveTextContent('T003')

    // Sort arrow should show on Busy%
    expect(screen.getByText('↓')).toBeInTheDocument()
  })

  it('toggles sort direction when clicking same column', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // Default: busy_pct desc (↓)
    expect(screen.getByText('↓')).toBeInTheDocument()

    // Click Busy% to toggle to asc
    const busyHeader = screen.getByText('Busy%')
    fireEvent.click(busyHeader)
    expect(screen.getByText('↑')).toBeInTheDocument()

    // Rows should now be sorted ascending: T003, T002, T001
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('T003')
    expect(rows[3]).toHaveTextContent('T001')
  })

  it('sorts by different column when clicking a new header', () => {
    render(
      <ThreadsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // Click Thread ID header
    const threadHeader = screen.getByText('Thread ID')
    fireEvent.click(threadHeader)

    // Should sort by thread_id desc
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('T003')
    expect(rows[3]).toHaveTextContent('T001')
  })
})
