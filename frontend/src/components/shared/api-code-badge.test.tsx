/**
 * Tests for ApiCodeBadge component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApiCodeBadge } from './api-code-badge'
import { TooltipProvider } from '@/components/ui/tooltip'

function renderWithTooltip(code: string) {
  return render(
    <TooltipProvider>
      <ApiCodeBadge code={code} />
    </TooltipProvider>
  )
}

describe('ApiCodeBadge', () => {
  describe('known codes', () => {
    it('renders known API code with tooltip trigger', () => {
      renderWithTooltip('SE')
      const badge = screen.getByTestId('api-code-badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('SE')
    })

    it('sets aria-label with full name for known codes', () => {
      renderWithTooltip('CE')
      const badge = screen.getByTestId('api-code-badge')
      expect(badge).toHaveAttribute('aria-label', 'CE: Create Entry')
    })

    it('renders SE with correct label', () => {
      renderWithTooltip('SE')
      const badge = screen.getByTestId('api-code-badge')
      expect(badge).toHaveAttribute('aria-label', 'SE: Set Entry')
    })

    it('renders GE with correct label', () => {
      renderWithTooltip('GE')
      const badge = screen.getByTestId('api-code-badge')
      expect(badge).toHaveAttribute('aria-label', 'GE: Get Entry')
    })
  })

  describe('unknown codes', () => {
    it('renders unknown code as plain text', () => {
      renderWithTooltip('XYZ')
      const plain = screen.getByTestId('api-code-plain')
      expect(plain).toBeInTheDocument()
      expect(plain).toHaveTextContent('XYZ')
    })

    it('does not render tooltip for unknown codes', () => {
      renderWithTooltip('UNKNOWN')
      expect(screen.queryByTestId('api-code-badge')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('renders em dash for empty string', () => {
      render(
        <TooltipProvider>
          <ApiCodeBadge code="" />
        </TooltipProvider>
      )
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('applies className to wrapper', () => {
      render(
        <TooltipProvider>
          <ApiCodeBadge code="SE" className="my-custom-class" />
        </TooltipProvider>
      )
      const badge = screen.getByTestId('api-code-badge')
      expect(badge).toHaveClass('my-custom-class')
    })
  })
})
