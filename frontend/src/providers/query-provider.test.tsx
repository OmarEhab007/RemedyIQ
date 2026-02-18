/**
 * Tests for QueryProvider — TanStack React Query client wrapper.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { QueryProvider } from './query-provider'

// ---------------------------------------------------------------------------
// Consumer that exposes QueryClient default options
// ---------------------------------------------------------------------------

function QueryConsumer() {
  const client = useQueryClient()
  const defaults = client.getDefaultOptions()
  return (
    <div>
      <span data-testid="staleTime">{String(defaults.queries?.staleTime)}</span>
      <span data-testid="gcTime">{String(defaults.queries?.gcTime)}</span>
      <span data-testid="retry">{String(defaults.queries?.retry)}</span>
      <span data-testid="refetchOnWindowFocus">{String(defaults.queries?.refetchOnWindowFocus)}</span>
      <span data-testid="mutationRetry">{String(defaults.mutations?.retry)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QueryProvider', () => {
  it('renders children', () => {
    render(
      <QueryProvider>
        <div data-testid="child">Hello</div>
      </QueryProvider>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('provides a QueryClient with sensible defaults', () => {
    render(
      <QueryProvider>
        <QueryConsumer />
      </QueryProvider>,
    )
    expect(screen.getByTestId('staleTime').textContent).toBe('60000')
    expect(screen.getByTestId('gcTime').textContent).toBe('300000')
    expect(screen.getByTestId('retry').textContent).toBe('1')
    expect(screen.getByTestId('refetchOnWindowFocus').textContent).toBe('false')
    expect(screen.getByTestId('mutationRetry').textContent).toBe('0')
  })
})
