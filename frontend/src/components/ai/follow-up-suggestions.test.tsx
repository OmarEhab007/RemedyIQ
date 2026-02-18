/**
 * Tests for FollowUpSuggestions component.
 *
 * Covers: renders chips from suggestions array, click calls onSelect with
 * correct text, empty/null array renders nothing, disabled state blocks clicks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowUpSuggestions } from './follow-up-suggestions'

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FollowUpSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders nothing when suggestions array is empty', () => {
    const { container } = render(
      <FollowUpSuggestions suggestions={[]} onSelect={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when suggestions is an empty array (null guard)', () => {
    // The component checks `!suggestions || suggestions.length === 0`
    const { container } = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <FollowUpSuggestions suggestions={null as any} onSelect={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one chip per suggestion', () => {
    const suggestions = ['Tell me more', 'Show examples', 'Explain why']
    render(<FollowUpSuggestions suggestions={suggestions} onSelect={vi.fn()} />)

    expect(screen.getByText('Tell me more')).toBeInTheDocument()
    expect(screen.getByText('Show examples')).toBeInTheDocument()
    expect(screen.getByText('Explain why')).toBeInTheDocument()
  })

  it('renders the "Suggested follow-ups" label', () => {
    render(
      <FollowUpSuggestions suggestions={['A suggestion']} onSelect={vi.fn()} />,
    )
    expect(screen.getByText(/suggested follow-ups/i)).toBeInTheDocument()
  })

  it('renders the container with role="group" and accessible label', () => {
    render(
      <FollowUpSuggestions suggestions={['Question 1']} onSelect={vi.fn()} />,
    )
    expect(
      screen.getByRole('group', { name: /follow-up suggestions/i }),
    ).toBeInTheDocument()
  })

  it('each chip has an aria-label with the suggestion text', () => {
    render(
      <FollowUpSuggestions suggestions={['Analyze traces']} onSelect={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /suggest: analyze traces/i }),
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Interaction
  // -------------------------------------------------------------------------

  it('calls onSelect with the correct suggestion text when a chip is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <FollowUpSuggestions
        suggestions={['What caused this error?']}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /suggest: what caused this error/i }))
    expect(onSelect).toHaveBeenCalledWith('What caused this error?')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect with the correct text for each chip independently', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <FollowUpSuggestions
        suggestions={['Option A', 'Option B']}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /suggest: option b/i }))
    expect(onSelect).toHaveBeenCalledWith('Option B')
  })

  // -------------------------------------------------------------------------
  // Disabled state
  // -------------------------------------------------------------------------

  it('chips are disabled when disabled prop is true', () => {
    render(
      <FollowUpSuggestions
        suggestions={['Disabled chip']}
        onSelect={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: /suggest: disabled chip/i })).toBeDisabled()
  })

  it('clicking a disabled chip does not call onSelect', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <FollowUpSuggestions
        suggestions={['Disabled chip']}
        onSelect={onSelect}
        disabled
      />,
    )

    // userEvent respects disabled buttons and does not fire click handlers
    await user.click(screen.getByRole('button', { name: /suggest: disabled chip/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('applies disabled styling class when disabled', () => {
    render(
      <FollowUpSuggestions
        suggestions={['Chip']}
        onSelect={vi.fn()}
        disabled
      />,
    )
    const btn = screen.getByRole('button', { name: /suggest: chip/i })
    expect(btn.className).toContain('cursor-not-allowed')
    expect(btn.className).toContain('opacity-50')
  })

  it('chips are enabled by default (disabled prop defaults to false)', () => {
    render(
      <FollowUpSuggestions suggestions={['Active chip']} onSelect={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /suggest: active chip/i })).not.toBeDisabled()
  })
})
