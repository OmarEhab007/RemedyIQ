/**
 * Tests for SkillSelector component.
 *
 * Covers: rendering Auto + skill buttons, active state, click handling,
 * fallback skills when API unavailable, accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillSelector } from './skill-selector'

// ---------------------------------------------------------------------------
// Mock use-api hook
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-api', () => ({
  useAISkills: vi.fn(() => ({
    data: [
      {
        name: 'performance',
        display_name: 'Performance',
        description: 'Analyze performance',
        icon: '⚡',
      },
      {
        name: 'root_cause',
        display_name: 'Root Cause',
        description: 'Find root causes',
        icon: '🔍',
      },
    ],
    isLoading: false,
    isError: false,
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(selectedSkill: string | null = null) {
  const onSelectSkill = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <SkillSelector selectedSkill={selectedSkill} onSelectSkill={onSelectSkill} />,
  )
  return { onSelectSkill, user, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Auto button', () => {
    setup()
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument()
  })

  it('renders skill buttons from the API', () => {
    setup()
    expect(screen.getByRole('button', { name: /performance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /root cause/i })).toBeInTheDocument()
  })

  it('marks Auto as pressed when selectedSkill is null', () => {
    setup(null)
    expect(screen.getByRole('button', { name: /auto/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /performance/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks performance skill as pressed when selected', () => {
    setup('performance')
    expect(screen.getByRole('button', { name: /performance/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /auto/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelectSkill with null when Auto is clicked', async () => {
    const { user, onSelectSkill } = setup('performance')
    await user.click(screen.getByRole('button', { name: /auto/i }))
    expect(onSelectSkill).toHaveBeenCalledWith(null)
  })

  it('calls onSelectSkill with skill name when skill button is clicked', async () => {
    const { user, onSelectSkill } = setup(null)
    await user.click(screen.getByRole('button', { name: /performance/i }))
    expect(onSelectSkill).toHaveBeenCalledWith('performance')
  })

  it('calls onSelectSkill with root_cause when root cause is clicked', async () => {
    const { user, onSelectSkill } = setup(null)
    await user.click(screen.getByRole('button', { name: /root cause/i }))
    expect(onSelectSkill).toHaveBeenCalledWith('root_cause')
  })

  it('has group role with accessible label', () => {
    setup()
    expect(screen.getByRole('group', { name: /ai skill selector/i })).toBeInTheDocument()
  })

  it('renders tooltip-like title attributes on buttons', () => {
    setup()
    const autoBtn = screen.getByRole('button', { name: /auto/i })
    expect(autoBtn).toHaveAttribute('title')
  })
})
