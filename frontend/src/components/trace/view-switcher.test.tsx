/**
 * Tests for ViewSwitcher component.
 *
 * Covers: rendering tabs, active tab, keyboard navigation, span count display,
 * accessibility attributes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewSwitcher } from './view-switcher'
import type { TraceView } from './view-switcher'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(activeView: TraceView = 'waterfall', spanCount?: number) {
  const onChangeView = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <ViewSwitcher
      activeView={activeView}
      onChangeView={onChangeView}
      spanCount={spanCount}
    />,
  )
  return { onChangeView, user, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViewSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all three tab buttons', () => {
    setup()
    expect(screen.getByRole('tab', { name: /waterfall/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /flame graph/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /span list/i })).toBeInTheDocument()
  })

  it('marks the active tab as aria-selected', () => {
    setup('flame-graph')
    expect(screen.getByRole('tab', { name: /flame graph/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /waterfall/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /span list/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChangeView when a tab is clicked', async () => {
    const { user, onChangeView } = setup('waterfall')
    await user.click(screen.getByRole('tab', { name: /span list/i }))
    expect(onChangeView).toHaveBeenCalledWith('span-list')
  })

  it('calls onChangeView when flame graph tab is clicked', async () => {
    const { user, onChangeView } = setup('waterfall')
    await user.click(screen.getByRole('tab', { name: /flame graph/i }))
    expect(onChangeView).toHaveBeenCalledWith('flame-graph')
  })

  it('displays span count when provided', () => {
    setup('waterfall', 42)
    expect(screen.getByText(/42 spans/i)).toBeInTheDocument()
  })

  it('displays singular "span" when count is 1', () => {
    setup('waterfall', 1)
    expect(screen.getByText(/1 span/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 spans/i)).not.toBeInTheDocument()
  })

  it('does not display span count when not provided', () => {
    setup('waterfall')
    expect(screen.queryByText(/\d+ spans?/i)).not.toBeInTheDocument()
  })

  it('has a tablist role with accessible label', () => {
    setup()
    expect(screen.getByRole('tablist', { name: /trace view/i })).toBeInTheDocument()
  })

  it('navigates to next tab with ArrowRight', async () => {
    const { user, onChangeView } = setup('waterfall')
    screen.getByRole('tab', { selected: true }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChangeView).toHaveBeenCalledWith('flame-graph')
  })

  it('navigates to previous tab with ArrowLeft', async () => {
    const { user, onChangeView } = setup('flame-graph')
    screen.getByRole('tab', { selected: true }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChangeView).toHaveBeenCalledWith('waterfall')
  })

  it('wraps from last to first tab with ArrowRight', async () => {
    const { user, onChangeView } = setup('span-list')
    screen.getByRole('tab', { selected: true }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChangeView).toHaveBeenCalledWith('waterfall')
  })

  it('wraps from first to last tab with ArrowLeft', async () => {
    const { user, onChangeView } = setup('waterfall')
    screen.getByRole('tab', { selected: true }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChangeView).toHaveBeenCalledWith('span-list')
  })
})
