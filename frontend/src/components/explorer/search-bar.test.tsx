/**
 * Tests for SearchBar component.
 *
 * Covers: rendering, typing, autocomplete dropdown, keyboard navigation,
 * submit on Enter, clear button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './search-bar'

// ---------------------------------------------------------------------------
// Mock useAutocomplete
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-api', () => ({
  useAutocomplete: vi.fn(),
}))

import { useAutocomplete } from '@/hooks/use-api'

const mockUseAutocomplete = useAutocomplete as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  value: '',
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  jobId: 'job-test-123',
}

function setup(props = defaultProps) {
  const user = userEvent.setup()
  const result = render(<SearchBar {...props} />)
  return { user, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAutocomplete.mockReturnValue({ data: undefined })
  })

  it('renders the search input with placeholder', () => {
    setup()
    const input = screen.getByRole('combobox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('Search logs'))
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    const { user } = setup({ ...defaultProps, onChange })
    const input = screen.getByRole('combobox')
    await user.type(input, 'error')
    expect(onChange).toHaveBeenCalled()
  })

  it('calls onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn()
    const { user } = setup({ ...defaultProps, value: 'user:john', onSubmit })
    const input = screen.getByRole('combobox')
    input.focus()
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('user:john')
  })

  it('calls onSubmit when Search button is clicked', async () => {
    const onSubmit = vi.fn()
    const { user } = setup({ ...defaultProps, value: 'form:HPD', onSubmit })
    const button = screen.getByRole('button', { name: /submit search/i })
    await user.click(button)
    expect(onSubmit).toHaveBeenCalledWith('form:HPD')
  })

  it('shows a clear button when value is non-empty', () => {
    setup({ ...defaultProps, value: 'some query' })
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
  })

  it('does not show clear button when value is empty', () => {
    setup({ ...defaultProps, value: '' })
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
  })

  it('calls onChange and onSubmit with empty string when clear button clicked', async () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const { user } = setup({ ...defaultProps, value: 'query', onChange, onSubmit })
    const clearBtn = screen.getByRole('button', { name: /clear search/i })
    await user.click(clearBtn)
    expect(onChange).toHaveBeenCalledWith('')
    expect(onSubmit).toHaveBeenCalledWith('')
  })

  it('renders autocomplete dropdown when suggestions are available', async () => {
    mockUseAutocomplete.mockReturnValue({
      data: {
        field: 'query',
        suggestions: [
          { value: 'user:john', count: 42 },
          { value: 'user:jane', count: 17 },
        ],
      },
    })

    setup({ ...defaultProps, value: 'user' })

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    expect(screen.getByText('user:john')).toBeInTheDocument()
    expect(screen.getByText('user:jane')).toBeInTheDocument()
  })

  it('navigates autocomplete with arrow keys', async () => {
    mockUseAutocomplete.mockReturnValue({
      data: {
        field: 'query',
        suggestions: [
          { value: 'form:HPD', count: 10 },
          { value: 'form:CHG', count: 5 },
        ],
      },
    })

    const { user } = setup({ ...defaultProps, value: 'form' })
    const input = screen.getByRole('combobox')

    await waitFor(() => screen.getByRole('listbox'))

    await user.click(input)
    await user.keyboard('{ArrowDown}')
    const opts = screen.getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')
    expect(opts[1]).toHaveAttribute('aria-selected', 'true')

    // Escape closes the list
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('has accessible combobox role', () => {
    setup({ ...defaultProps })
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Search logs')
  })

  it('passes jobId to useAutocomplete', () => {
    setup({ ...defaultProps, value: 'test', jobId: 'job-abc' })
    expect(mockUseAutocomplete).toHaveBeenCalledWith(
      'query',
      expect.any(String),
      'job-abc',
    )
  })
})
