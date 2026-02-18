/**
 * Tests for TraceComparison component.
 *
 * Covers: heading, trace ID inputs, swap button state, typing into inputs,
 * placeholder text, waterfall rendering on load, loading state, error state,
 * swap interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TraceComparison } from './trace-comparison'
import type { WaterfallResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseWaterfall = vi.fn()

vi.mock('@/hooks/use-api', () => ({
  useWaterfall: (...args: unknown[]) => mockUseWaterfall(...args),
}))

vi.mock('@/components/ui/page-state', () => ({
  PageState: ({ variant, message }: { variant: string; message?: string }) => (
    <div data-testid={`page-state-${variant}`}>{message}</div>
  ),
}))

vi.mock('./waterfall', () => ({
  Waterfall: ({ data }: { data: WaterfallResponse }) => (
    <div data-testid="waterfall">{data.span_count} spans</div>
  ),
}))

// ---------------------------------------------------------------------------
// Default hook return values
// ---------------------------------------------------------------------------

const idleState = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

const loadingState = {
  data: undefined,
  isLoading: true,
  isError: false,
  refetch: vi.fn(),
}

const errorState = {
  data: undefined,
  isLoading: false,
  isError: true,
  refetch: vi.fn(),
}

function makeWaterfallResponse(overrides: Partial<WaterfallResponse> = {}): WaterfallResponse {
  return {
    trace_id: 'trace-abc',
    total_duration_ms: 500,
    span_count: 7,
    error_count: 0,
    type_breakdown: { api_count: 3, sql_count: 2, filter_count: 1, esc_count: 1 },
    spans: [],
    flat_spans: [],
    critical_path: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: both panels idle (no trace ID entered)
    mockUseWaterfall.mockReturnValue(idleState)
  })

  it('renders heading "Trace Comparison"', () => {
    render(<TraceComparison jobId="job-1" />)
    expect(screen.getByText('Trace Comparison')).toBeInTheDocument()
  })

  it('renders heading as an h2 element', () => {
    render(<TraceComparison jobId="job-1" />)
    const heading = screen.getByText('Trace Comparison')
    expect(heading.tagName.toLowerCase()).toBe('h2')
  })

  it('renders two trace ID inputs (A and B)', () => {
    render(<TraceComparison jobId="job-1" />)
    expect(screen.getByLabelText('Trace A ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Trace B ID')).toBeInTheDocument()
  })

  it('renders the swap button with aria-label "Swap trace A and B"', () => {
    render(<TraceComparison jobId="job-1" />)
    expect(screen.getByRole('button', { name: /swap trace a and b/i })).toBeInTheDocument()
  })

  it('swap button text reads "Swap"', () => {
    render(<TraceComparison jobId="job-1" />)
    const button = screen.getByRole('button', { name: /swap trace a and b/i })
    expect(button).toHaveTextContent('Swap')
  })

  it('swap button is disabled when both inputs are empty', () => {
    render(<TraceComparison jobId="job-1" />)
    const button = screen.getByRole('button', { name: /swap trace a and b/i })
    expect(button).toBeDisabled()
  })

  it('swap button is enabled when trace A has a value', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-123')
    const button = screen.getByRole('button', { name: /swap trace a and b/i })
    expect(button).not.toBeDisabled()
  })

  it('swap button is enabled when trace B has a value', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)
    const inputB = screen.getByLabelText('Trace B ID')
    await user.type(inputB, 'trace-456')
    const button = screen.getByRole('button', { name: /swap trace a and b/i })
    expect(button).not.toBeDisabled()
  })

  it('typing in trace A input updates its value', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-abc')
    expect(inputA).toHaveValue('trace-abc')
  })

  it('typing in trace B input updates its value', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)
    const inputB = screen.getByLabelText('Trace B ID')
    await user.type(inputB, 'trace-xyz')
    expect(inputB).toHaveValue('trace-xyz')
  })

  it('both inputs start as empty strings', () => {
    render(<TraceComparison jobId="job-1" />)
    expect(screen.getByLabelText('Trace A ID')).toHaveValue('')
    expect(screen.getByLabelText('Trace B ID')).toHaveValue('')
  })

  it('shows placeholder text "Enter trace ID…" in both inputs', () => {
    render(<TraceComparison jobId="job-1" />)
    const inputs = screen.getAllByPlaceholderText('Enter trace ID…')
    expect(inputs).toHaveLength(2)
  })

  it('shows placeholder panel text when no trace ID is entered for panel A', () => {
    render(<TraceComparison jobId="job-1" />)
    const placeholders = screen.getAllByText('Enter a trace ID to compare')
    expect(placeholders.length).toBeGreaterThanOrEqual(1)
  })

  it('shows placeholder panel text for both panels when both inputs are empty', () => {
    render(<TraceComparison jobId="job-1" />)
    const placeholders = screen.getAllByText('Enter a trace ID to compare')
    expect(placeholders).toHaveLength(2)
  })

  it('renders waterfall when data is loaded for trace A', async () => {
    const user = userEvent.setup()
    const waterfallData = makeWaterfallResponse({ span_count: 7 })

    mockUseWaterfall.mockImplementation((_jobId: unknown, traceId: unknown) => {
      if (traceId === 'trace-loaded') {
        return { data: waterfallData, isLoading: false, isError: false, refetch: vi.fn() }
      }
      return idleState
    })

    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-loaded')

    expect(screen.getByTestId('waterfall')).toBeInTheDocument()
    expect(screen.getByTestId('waterfall')).toHaveTextContent('7 spans')
  })

  it('renders waterfall span count from response data', async () => {
    const user = userEvent.setup()
    const waterfallData = makeWaterfallResponse({ span_count: 42 })

    mockUseWaterfall.mockImplementation((_jobId: unknown, traceId: unknown) => {
      if (traceId === 'trace-42') {
        return { data: waterfallData, isLoading: false, isError: false, refetch: vi.fn() }
      }
      return idleState
    })

    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-42')

    expect(screen.getByTestId('waterfall')).toHaveTextContent('42 spans')
  })

  it('shows loading state (PageState loading) when trace is loading', async () => {
    const user = userEvent.setup()

    mockUseWaterfall.mockImplementation((_jobId: unknown, traceId: unknown) => {
      if (traceId === 'trace-loading') return loadingState
      return idleState
    })

    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-loading')

    expect(screen.getByTestId('page-state-loading')).toBeInTheDocument()
  })

  it('shows error state (PageState error) when trace fails to load', async () => {
    const user = userEvent.setup()

    mockUseWaterfall.mockImplementation((_jobId: unknown, traceId: unknown) => {
      if (traceId === 'trace-error') return errorState
      return idleState
    })

    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-error')

    expect(screen.getByTestId('page-state-error')).toBeInTheDocument()
  })

  it('shows "Failed to load trace data." message in error state', async () => {
    const user = userEvent.setup()

    mockUseWaterfall.mockImplementation((_jobId: unknown, traceId: unknown) => {
      if (traceId === 'trace-err') return errorState
      return idleState
    })

    render(<TraceComparison jobId="job-1" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 'trace-err')

    expect(screen.getByText('Failed to load trace data.')).toBeInTheDocument()
  })

  it('swap button swaps values between trace A and trace B inputs', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)

    const inputA = screen.getByLabelText('Trace A ID')
    const inputB = screen.getByLabelText('Trace B ID')

    await user.type(inputA, 'trace-alpha')
    await user.type(inputB, 'trace-beta')

    const swapButton = screen.getByRole('button', { name: /swap trace a and b/i })
    await user.click(swapButton)

    expect(inputA).toHaveValue('trace-beta')
    expect(inputB).toHaveValue('trace-alpha')
  })

  it('swap button swaps when only trace A has a value (B becomes A)', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="job-1" />)

    const inputA = screen.getByLabelText('Trace A ID')
    const inputB = screen.getByLabelText('Trace B ID')

    await user.type(inputA, 'only-a')

    const swapButton = screen.getByRole('button', { name: /swap trace a and b/i })
    await user.click(swapButton)

    expect(inputA).toHaveValue('')
    expect(inputB).toHaveValue('only-a')
  })

  it('applies custom className to the root element', () => {
    const { container } = render(<TraceComparison jobId="job-1" className="test-class" />)
    expect(container.firstChild).toHaveClass('test-class')
  })

  it('passes jobId to useWaterfall when a trace ID is entered', async () => {
    const user = userEvent.setup()
    render(<TraceComparison jobId="my-job-99" />)
    const inputA = screen.getByLabelText('Trace A ID')
    await user.type(inputA, 't')
    // useWaterfall should have been called with the jobId
    expect(mockUseWaterfall).toHaveBeenCalledWith('my-job-99', 't')
  })

  it('passes null jobId to useWaterfall when trace ID is empty', () => {
    render(<TraceComparison jobId="job-1" />)
    // When traceId is empty string, component passes null as jobId
    expect(mockUseWaterfall).toHaveBeenCalledWith(null, null)
  })

  it('does not show waterfall or page states when trace ID is empty', () => {
    render(<TraceComparison jobId="job-1" />)
    expect(screen.queryByTestId('waterfall')).not.toBeInTheDocument()
    expect(screen.queryByTestId('page-state-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('page-state-error')).not.toBeInTheDocument()
  })
})
