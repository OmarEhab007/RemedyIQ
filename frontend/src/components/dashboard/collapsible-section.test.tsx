/**
 * T067 — Tests for CollapsibleSection component (T057)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollapsibleSection } from './collapsible-section'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollapsibleSection', () => {
  it('renders the section title', () => {
    render(
      <CollapsibleSection title="Aggregates">
        <p>Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByText('Aggregates')).toBeInTheDocument()
  })

  it('does not show children when collapsed (default)', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p data-testid="inner-content">Inner Content</p>
      </CollapsibleSection>
    )
    expect(screen.queryByTestId('inner-content')).toBeNull()
  })

  it('shows children after clicking the header', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p data-testid="inner-content">Inner Content</p>
      </CollapsibleSection>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('inner-content')).toBeInTheDocument()
  })

  it('collapses again when header is clicked twice', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p data-testid="inner-content">Inner Content</p>
      </CollapsibleSection>
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.queryByTestId('inner-content')).toBeNull()
  })

  it('calls onExpand when first opened', () => {
    const onExpand = vi.fn()
    render(
      <CollapsibleSection title="Test Section" onExpand={onExpand}>
        <p>Content</p>
      </CollapsibleSection>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onExpand on second click (already expanded)', () => {
    const onExpand = vi.fn()
    render(
      <CollapsibleSection title="Test Section" onExpand={onExpand}>
        <p>Content</p>
      </CollapsibleSection>
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn) // expand (calls onExpand)
    fireEvent.click(btn) // collapse
    fireEvent.click(btn) // expand again (should NOT call onExpand)
    expect(onExpand).toHaveBeenCalledTimes(1) // only once on first expand
  })

  it('shows children when defaultOpen=true', () => {
    render(
      <CollapsibleSection title="Open Section" defaultOpen>
        <p data-testid="inner-content">Inner Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByTestId('inner-content')).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(
      <CollapsibleSection title="Section" description="Some helpful context">
        <p>Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByText('Some helpful context')).toBeInTheDocument()
  })

  it('renders the badge when provided', () => {
    render(
      <CollapsibleSection title="Section" badge={<span data-testid="badge">42</span>}>
        <p>Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('42')
  })

  it('shows loading skeleton when isLoading=true and expanded', () => {
    render(
      <CollapsibleSection title="Section" isLoading={true}>
        <p data-testid="inner-content">Content</p>
      </CollapsibleSection>
    )
    fireEvent.click(screen.getByRole('button'))
    // Should show aria-busy loading area instead of children
    expect(screen.getByLabelText(/loading section content/i)).toBeInTheDocument()
    expect(screen.queryByTestId('inner-content')).toBeNull()
  })

  it('has correct aria-expanded attribute', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p>Content</p>
      </CollapsibleSection>
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })
})
