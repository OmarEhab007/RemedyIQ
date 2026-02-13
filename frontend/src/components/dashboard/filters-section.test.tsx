import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FiltersSection } from './filters-section'
import type { FilterComplexityResponse } from '@/lib/api'

const mockData: FilterComplexityResponse = {
  most_executed: [
    { name: 'ValidateForm', count: 500, total_ms: 1250.5 },
    { name: 'SetDefaults', count: 200, total_ms: 800.75 },
  ],
  per_transaction: [
    {
      transaction_id: 'TXN-001',
      filter_name: 'ValidateForm',
      execution_count: 150,
      total_ms: 450.25,
      avg_ms: 3.0,
      max_ms: 25.5,
    },
    {
      transaction_id: 'TXN-002',
      filter_name: 'SetDefaults',
      execution_count: 50,
      total_ms: 200.0,
      avg_ms: 4.0,
      max_ms: 15.0,
    },
  ],
  total_filter_time_ms: 2051.25,
}

const mockEmptyData: FilterComplexityResponse = {
  most_executed: [],
  per_transaction: [],
  total_filter_time_ms: 0,
}

describe('FiltersSection', () => {
  it('renders loading state with pulse animation', () => {
    render(
      <FiltersSection data={null} loading={true} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Filter Complexity')).toBeInTheDocument()
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('renders error state with error message and retry button', () => {
    const errorMessage = 'Failed to load filters'
    render(
      <FiltersSection
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
      <FiltersSection
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

  it('renders "No filter activity detected" when data is null', () => {
    render(
      <FiltersSection data={null} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No filter activity detected')).toBeInTheDocument()
  })

  it('renders "No filter activity detected" when both lists are empty', () => {
    render(
      <FiltersSection data={mockEmptyData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('No filter activity detected')).toBeInTheDocument()
  })

  it('renders title and total filter time badge', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('Filter Complexity')).toBeInTheDocument()
    expect(screen.getByText('Total: 2051.25 ms')).toBeInTheDocument()
  })

  it('renders tab buttons: Most Executed and Per Transaction', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /Most Executed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Per Transaction/i })).toBeInTheDocument()
  })

  it('renders Most Executed tab by default with rank, filter name, count, total time', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // Column headers
    expect(screen.getByText('Rank')).toBeInTheDocument()
    expect(screen.getByText('Filter Name')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
    expect(screen.getByText('Total Time(ms)')).toBeInTheDocument()

    // Data
    expect(screen.getByText('ValidateForm')).toBeInTheDocument()
    expect(screen.getByText('SetDefaults')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('1250.50')).toBeInTheDocument()
  })

  it('switches to Per Transaction tab on click', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    const perTxnTab = screen.getByRole('button', { name: /Per Transaction/i })
    fireEvent.click(perTxnTab)

    // Per Transaction column headers
    expect(screen.getByText('Transaction ID')).toBeInTheDocument()
    expect(screen.getByText('Avg(ms)')).toBeInTheDocument()
    expect(screen.getByText('Max(ms)')).toBeInTheDocument()

    // Data
    expect(screen.getByText('TXN-001')).toBeInTheDocument()
    expect(screen.getByText('TXN-002')).toBeInTheDocument()
    expect(screen.getByText('450.25')).toBeInTheDocument()
  })

  it('highlights high execution count rows (> 100) with amber background', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    const perTxnTab = screen.getByRole('button', { name: /Per Transaction/i })
    fireEvent.click(perTxnTab)

    // TXN-001 has execution_count=150 (>100), should have amber background
    const highRow = screen.getByText('TXN-001').closest('tr')!
    expect(highRow.className).toContain('bg-amber-50')

    // TXN-002 has execution_count=50 (<=100), should not
    const normalRow = screen.getByText('TXN-002').closest('tr')!
    expect(normalRow.className).not.toContain('bg-amber-50')
  })

  it('formats count with toLocaleString', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    // count 500 renders as "500" (no comma needed)
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('formats total_ms with toFixed(2)', () => {
    render(
      <FiltersSection data={mockData} loading={false} error={null} refetch={vi.fn()} />
    )
    expect(screen.getByText('1250.50')).toBeInTheDocument()
    expect(screen.getByText('800.75')).toBeInTheDocument()
  })
})
