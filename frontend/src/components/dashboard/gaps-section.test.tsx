import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GapsSection } from './gaps-section'
import type { GapsResponse } from '@/lib/api'

const mockData: GapsResponse = {
  gaps: [
    {
      start_time: '2026-02-12T10:00:00Z',
      end_time: '2026-02-12T10:00:30Z',
      duration_ms: 30000,
      before_line: 100,
      after_line: 200,
      log_type: 'API',
    },
    {
      start_time: '2026-02-12T10:01:00Z',
      end_time: '2026-02-12T10:03:00Z',
      duration_ms: 120000,
      before_line: 300,
      after_line: 400,
      log_type: 'SQL',
    },
    {
      start_time: '2026-02-12T10:05:00Z',
      end_time: '2026-02-12T10:05:10Z',
      duration_ms: 10000,
      before_line: 500,
      after_line: 600,
      log_type: 'API',
      thread_id: 'T001',
    },
    {
      start_time: '2026-02-12T10:06:00Z',
      end_time: '2026-02-12T10:08:00Z',
      duration_ms: 120000,
      before_line: 700,
      after_line: 800,
      log_type: 'FLTR',
      thread_id: 'T002',
    },
  ],
  queue_health: [],
}

const mockEmptyData: GapsResponse = {
  gaps: [],
  queue_health: [],
}

describe('GapsSection', () => {
  it('renders loading state with pulse animation', () => {
    render(
      <GapsSection data={null} loading={true} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Gap Analysis')).toBeInTheDocument()
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders error state with error message and retry button', () => {
    const errorMessage = 'Failed to load gaps'
    render(
      <GapsSection
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
      <GapsSection
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

  it('renders "No significant gaps detected" when data is null', () => {
    render(
      <GapsSection data={null} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No significant gaps detected')).toBeInTheDocument()
  })

  it('renders "No significant gaps detected" when gaps array is empty', () => {
    render(
      <GapsSection data={mockEmptyData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No significant gaps detected')).toBeInTheDocument()
  })

  it('renders title and tab buttons with counts', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Gap Analysis')).toBeInTheDocument()
    // Line gaps: 2 (no thread_id), Thread gaps: 2 (with thread_id)
    expect(screen.getByRole('button', { name: /Line Gaps \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thread Gaps \(2\)/i })).toBeInTheDocument()
  })

  it('renders Line Gaps tab by default with correct columns', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Rank')).toBeInTheDocument()
    expect(screen.getByText('Gap Duration')).toBeInTheDocument()
    expect(screen.getByText('Start Time')).toBeInTheDocument()
    expect(screen.getByText('End Time')).toBeInTheDocument()
    expect(screen.getByText('Before Line')).toBeInTheDocument()
    expect(screen.getByText('After Line')).toBeInTheDocument()
    expect(screen.getByText('Log Type')).toBeInTheDocument()
    // Thread ID column should NOT appear in Line Gaps tab
    expect(screen.queryByText('Thread ID')).not.toBeInTheDocument()
  })

  it('formats durations correctly (ms, s, min)', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // 30000ms → "30.00s"
    expect(screen.getByText('30.00s')).toBeInTheDocument()
    // 120000ms → "2.00min"
    expect(screen.getByText('2.00min')).toBeInTheDocument()
  })

  it('displays before and after line numbers', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.getByText('400')).toBeInTheDocument()
  })

  it('displays log type badges', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    const apiElements = screen.getAllByText('API')
    expect(apiElements.length).toBeGreaterThan(0)
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('highlights critical gaps (>60s) with red styling', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // 120000ms gap is critical (>60000ms)
    const criticalRow = screen.getByText('2.00min').closest('tr')!
    expect(criticalRow.className).toContain('border-l-red-500')
    expect(criticalRow.className).toContain('bg-red-50')

    // 30000ms gap is NOT critical (<60000ms)
    const normalRow = screen.getByText('30.00s').closest('tr')!
    expect(normalRow.className).not.toContain('border-l-red-500')
  })

  it('switches to Thread Gaps tab and shows Thread ID column', () => {
    render(
      <GapsSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    const threadTab = screen.getByRole('button', { name: /Thread Gaps/i })
    fireEvent.click(threadTab)

    expect(screen.getByText('Thread ID')).toBeInTheDocument()
    expect(screen.getByText('T001')).toBeInTheDocument()
    expect(screen.getByText('T002')).toBeInTheDocument()
  })

  it('shows "No thread gaps detected" when switching to empty thread tab', () => {
    // Only line gaps, no thread gaps
    const lineOnlyData: GapsResponse = {
      gaps: [
        {
          start_time: '2026-02-12T10:00:00Z',
          end_time: '2026-02-12T10:00:30Z',
          duration_ms: 30000,
          before_line: 100,
          after_line: 200,
          log_type: 'API',
        },
      ],
      queue_health: [],
    }
    render(
      <GapsSection data={lineOnlyData} loading={false} error={null} refetch={vi.fn()} />
    )
    const threadTab = screen.getByRole('button', { name: /Thread Gaps/i })
    fireEvent.click(threadTab)

    expect(screen.getByText('No thread gaps detected')).toBeInTheDocument()
  })
})
