import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatsCards } from './stats-cards'
import type { GeneralStats } from '@/lib/api'

describe('StatsCards', () => {
  const mockStats: GeneralStats = {
    api_count: 1234,
    sql_count: 5678,
    filter_count: 910,
    esc_count: 42,
    total_lines: 123456,
    unique_users: 15,
    unique_forms: 8,
    log_duration: '2h 30m',
  }

  it('renders all stat cards with correct values', () => {
    render(<StatsCards stats={mockStats} />)

    // Check API Calls
    expect(screen.getByText('API Calls')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()

    // Check SQL Operations
    expect(screen.getByText('SQL Operations')).toBeInTheDocument()
    expect(screen.getByText('5,678')).toBeInTheDocument()

    // Check Filter Executions
    expect(screen.getByText('Filter Executions')).toBeInTheDocument()
    expect(screen.getByText('910')).toBeInTheDocument()

    // Check Escalations
    expect(screen.getByText('Escalations')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()

    // Check Total Lines
    expect(screen.getByText('Total Lines')).toBeInTheDocument()
    expect(screen.getByText('123,456')).toBeInTheDocument()

    // Check Unique Users
    expect(screen.getByText('Unique Users')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()

    // Check Unique Forms
    expect(screen.getByText('Unique Forms')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()

    // Check Duration
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('2h 30m')).toBeInTheDocument()
  })

  it('formats large numbers with commas', () => {
    const largeStats: GeneralStats = {
      ...mockStats,
      api_count: 1000000,
      sql_count: 999999,
      total_lines: 10000000,
    }

    render(<StatsCards stats={largeStats} />)

    expect(screen.getByText('1,000,000')).toBeInTheDocument()
    expect(screen.getByText('999,999')).toBeInTheDocument()
    expect(screen.getByText('10,000,000')).toBeInTheDocument()
  })

  it('handles zero values correctly', () => {
    const zeroStats: GeneralStats = {
      api_count: 0,
      sql_count: 0,
      filter_count: 0,
      esc_count: 0,
      total_lines: 0,
      unique_users: 0,
      unique_forms: 0,
      log_duration: '0s',
    }

    render(<StatsCards stats={zeroStats} />)

    const zeroElements = screen.getAllByText('0')
    expect(zeroElements.length).toBeGreaterThan(0)
  })

  it('renders in grid layout', () => {
    const { container } = render(<StatsCards stats={mockStats} />)

    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toBeInTheDocument()
    expect(gridContainer).toHaveClass('grid-cols-2', 'lg:grid-cols-4')
  })

  it('applies correct color classes to cards', () => {
    const { container } = render(<StatsCards stats={mockStats} />)

    // API Calls should have blue color
    const apiValue = screen.getByText('1,234')
    expect(apiValue).toHaveClass('text-blue-600')

    // SQL Operations should have green color
    const sqlValue = screen.getByText('5,678')
    expect(sqlValue).toHaveClass('text-green-600')

    // Filter Executions should have purple color
    const filterValue = screen.getByText('910')
    expect(filterValue).toHaveClass('text-purple-600')

    // Escalations should have orange color
    const escValue = screen.getByText('42')
    expect(escValue).toHaveClass('text-orange-600')
  })
})
