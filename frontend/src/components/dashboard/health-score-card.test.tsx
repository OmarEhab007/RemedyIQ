import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HealthScoreCard } from './health-score-card'
import type { HealthScore } from '@/lib/api'

describe('HealthScoreCard', () => {
  const mockHealthScore: HealthScore = {
    score: 85,
    status: 'healthy',
    factors: [
      {
        name: 'API Response Time',
        score: 90,
        max_score: 100,
        severity: 'green',
        weight: 1,
        description: 'API calls are responding within acceptable limits',
      },
      {
        name: 'SQL Performance',
        score: 75,
        max_score: 100,
        severity: 'yellow',
        weight: 0.5,
        description: 'Some SQL queries are slow',
      },
    ],
  }

  it('renders nothing when healthScore is null', () => {
    const { container } = render(<HealthScoreCard healthScore={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when healthScore is undefined', () => {
    const { container } = render(<HealthScoreCard healthScore={undefined} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders health score value', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('renders status', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('renders all factors', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('API Response Time')).toBeInTheDocument()
    expect(screen.getByText('SQL Performance')).toBeInTheDocument()
  })

  it('renders factor scores', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders factor descriptions', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('API calls are responding within acceptable limits')).toBeInTheDocument()
    expect(screen.getByText('Some SQL queries are slow')).toBeInTheDocument()
  })

  it('renders title', () => {
    render(<HealthScoreCard healthScore={mockHealthScore} />)

    expect(screen.getByText('System Health Score')).toBeInTheDocument()
  })

  it('handles score of 100', () => {
    const perfectScore: HealthScore = {
      ...mockHealthScore,
      score: 100,
    }

    render(<HealthScoreCard healthScore={perfectScore} />)

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('handles score of 0', () => {
    const zeroScore: HealthScore = {
      ...mockHealthScore,
      score: 0,
    }

    render(<HealthScoreCard healthScore={zeroScore} />)

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('highlights red zone factors', () => {
    const redZoneScore: HealthScore = {
      ...mockHealthScore,
      factors: [
        {
          name: 'Critical Issue',
          score: 10,
          max_score: 100,
          severity: 'red',
          weight: 1,
          description: 'This is a critical issue',
        },
      ],
    }

    const { container } = render(<HealthScoreCard healthScore={redZoneScore} />)

    expect(container.querySelector('.border-destructive')).toBeInTheDocument()
  })
})
