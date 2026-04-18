/**
 * T067 — Tests for CollapsibleSection component (T057)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { DASHBOARD_EXPAND_SECTION_EVENT } from '@/lib/constants'
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

  describe('jump navigation / hash targeting', () => {
    afterEach(() => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    })

    it('expands and calls onExpand when the dashboard expand event matches this section', async () => {
      const onExpand = vi.fn()
      render(
        <CollapsibleSection title="Test Section" onExpand={onExpand}>
          <p data-testid="inner-content">Inner Content</p>
        </CollapsibleSection>
      )
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(DASHBOARD_EXPAND_SECTION_EVENT, {
            detail: { sectionId: 'section-test-section' },
          })
        )
      })
      await waitFor(() => expect(screen.getByTestId('inner-content')).toBeInTheDocument())
      await waitFor(() => expect(onExpand).toHaveBeenCalledTimes(1))
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })

    it('ignores expand events that target a different section id', () => {
      render(
        <CollapsibleSection title="Test Section" onExpand={vi.fn()}>
          <p data-testid="inner-content">Inner Content</p>
        </CollapsibleSection>
      )
      act(() => {
        window.dispatchEvent(
          new CustomEvent(DASHBOARD_EXPAND_SECTION_EVENT, {
            detail: { sectionId: 'section-other-section' },
          })
        )
      })
      expect(screen.queryByTestId('inner-content')).toBeNull()
    })

    it('expands on mount when the URL hash matches this section id', async () => {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#section-test-section`)
      render(
        <CollapsibleSection title="Test Section" onExpand={vi.fn()}>
          <p data-testid="inner-content">Inner Content</p>
        </CollapsibleSection>
      )
      await waitFor(() => expect(screen.getByTestId('inner-content')).toBeInTheDocument())
    })
  })
})
