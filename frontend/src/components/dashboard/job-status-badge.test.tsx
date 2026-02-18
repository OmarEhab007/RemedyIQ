/**
 * T073 — Tests for JobStatusBadge component (T071)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobStatusBadge } from './job-status-badge'
import type { JobStatus } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobStatusBadge', () => {
  it('renders "Complete" label for complete status', () => {
    render(<JobStatusBadge status="complete" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveTextContent('Complete')
  })

  it('renders "Failed" label for failed status', () => {
    render(<JobStatusBadge status="failed" />)
    expect(screen.getByRole('status')).toHaveTextContent('Failed')
  })

  it('renders "Queued" label for queued status', () => {
    render(<JobStatusBadge status="queued" />)
    expect(screen.getByRole('status')).toHaveTextContent('Queued')
  })

  it('renders "Parsing" label for parsing status', () => {
    render(<JobStatusBadge status="parsing" />)
    expect(screen.getByRole('status')).toHaveTextContent('Parsing')
  })

  it('renders "Analyzing" label for analyzing status', () => {
    render(<JobStatusBadge status="analyzing" />)
    expect(screen.getByRole('status')).toHaveTextContent('Analyzing')
  })

  it('renders "Storing" label for storing status', () => {
    render(<JobStatusBadge status="storing" />)
    expect(screen.getByRole('status')).toHaveTextContent('Storing')
  })

  it('shows progress percentage when showProgress=true and in-progress', () => {
    render(<JobStatusBadge status="parsing" showProgress progressPct={42} />)
    expect(screen.getByRole('status')).toHaveTextContent('42%')
  })

  it('does not show percentage for complete status even with showProgress', () => {
    render(<JobStatusBadge status="complete" showProgress progressPct={100} />)
    expect(screen.getByRole('status')).not.toHaveTextContent('100%')
  })

  it('has aria-label with status label', () => {
    render(<JobStatusBadge status="complete" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('Complete'))
  })

  it('includes progress percentage in aria-label for in-progress status', () => {
    render(<JobStatusBadge status="analyzing" showProgress progressPct={75} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('75'))
  })

  it.each<JobStatus>(['queued', 'complete', 'failed', 'parsing', 'analyzing', 'storing'])(
    'renders without crashing for status "%s"',
    (status) => {
      expect(() => render(<JobStatusBadge status={status} />)).not.toThrow()
    }
  )
})
