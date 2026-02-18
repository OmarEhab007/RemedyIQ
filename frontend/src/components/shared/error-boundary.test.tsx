/**
 * Tests for ErrorBoundary component.
 *
 * Covers: default fallback, custom fallback, reset, onError callback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './error-boundary'

// ---------------------------------------------------------------------------
// Throwing component
// ---------------------------------------------------------------------------

let shouldThrow = false

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div data-testid="child">Normal content</div>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders default fallback when child throws', () => {
    shouldThrow = true
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('resets and re-renders children when Try Again is clicked', async () => {
    shouldThrow = true
    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Fix the error before resetting
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    shouldThrow = true

    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div data-testid="custom-fallback">
            <p>{error.message}</p>
            <button onClick={reset}>Custom Reset</button>
          </div>
        )}
      >
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByText('Custom Reset')).toBeInTheDocument()
  })

  it('calls onError callback when error is caught', () => {
    shouldThrow = true
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })

  it('logs error to console', () => {
    shouldThrow = true
    const spy = console.error as ReturnType<typeof vi.fn>

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(spy).toHaveBeenCalled()
  })
})
