import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DistributionChart } from './distribution-chart'

describe('DistributionChart', () => {
  it('renders empty state when no distribution data', () => {
    render(<DistributionChart distribution={{}} />)

    expect(screen.getByText('No distribution data available')).toBeInTheDocument()
  })

  it('renders chart with distribution data', () => {
    const distribution = {
      by_type: {
        'API': 100,
        'SQL': 50,
        'Filter': 25,
      },
    }

    render(<DistributionChart distribution={distribution} />)

    expect(screen.getByText(/Distribution/)).toBeInTheDocument()
  })

  it('renders dimension selectors', () => {
    const distribution = {
      by_type: { 'API': 100 },
    }

    const { container } = render(<DistributionChart distribution={distribution} />)

    const selects = container.querySelectorAll('select')
    expect(selects.length).toBe(2)
  })

  it('shows empty state when selected dimension has no data', () => {
    const distribution = {
      other_dimension: { 'API': 100 },
    }

    render(<DistributionChart distribution={distribution} />)

    expect(screen.getByText('No distribution data available for this dimension')).toBeInTheDocument()
  })

  it('handles empty data object', () => {
    render(<DistributionChart distribution={{ by_type: {} }} />)

    expect(screen.getByText('No distribution data available for this dimension')).toBeInTheDocument()
  })
})
