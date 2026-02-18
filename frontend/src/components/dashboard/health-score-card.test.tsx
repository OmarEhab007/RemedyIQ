/**
 * T066 — Tests for HealthScoreCard component (T052)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthScoreCard } from './health-score-card'
import type { HealthScore } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeScore(overrides: Partial<HealthScore> = {}): HealthScore {
  return {
    score: 85,
    status: 'ok',
    factors: [
      {
        name: 'Error Rate',
        score: 18,
        max_score: 20,
        weight: 0.2,
        description: 'Low error rate detected',
        severity: 'ok',
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthScoreCard', () => {
  it('renders the health score number', () => {
    render(<HealthScoreCard healthScore={makeScore({ score: 85 })} />)
    expect(screen.getByLabelText(/health score: 85/i)).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('shows "Healthy" badge for scores >= 80', () => {
    render(<HealthScoreCard healthScore={makeScore({ score: 90 })} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('shows "Degraded" badge for scores between 60 and 79', () => {
    render(<HealthScoreCard healthScore={makeScore({ score: 65 })} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('shows "Critical" badge for scores below 60', () => {
    render(<HealthScoreCard healthScore={makeScore({ score: 40 })} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders the factor name', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText('Error Rate')).toBeInTheDocument()
  })

  it('renders factor score / max_score', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText('18/20')).toBeInTheDocument()
  })

  it('renders factor description', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText('Low error rate detected')).toBeInTheDocument()
  })

  it('renders the factors section heading', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText('Factors')).toBeInTheDocument()
  })

  it('does not render factors section when no factors', () => {
    render(<HealthScoreCard healthScore={makeScore({ factors: [] })} />)
    expect(screen.queryByText('Factors')).toBeNull()
  })

  it('renders a progress bar for each factor', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    // Each FactorBar renders a role="progressbar"
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBeGreaterThanOrEqual(1)
  })

  it('shows factor count in description', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText(/composite score across 1 factor/i)).toBeInTheDocument()
  })

  it('renders "Health Score" card title', () => {
    render(<HealthScoreCard healthScore={makeScore()} />)
    expect(screen.getByText('Health Score')).toBeInTheDocument()
  })
})
