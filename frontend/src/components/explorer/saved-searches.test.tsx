/**
 * Tests for SavedSearches component.
 *
 * Covers: renders trigger button, empty state, search list, loading state,
 * click to load a search, delete mutation, save dialog flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SavedSearches } from './saved-searches'
import type { SavedSearch } from '@/lib/api-types'
import { useSavedSearches, useDeleteSavedSearch, useSaveSearch } from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-api', () => ({
  useSavedSearches: vi.fn(),
  useDeleteSavedSearch: vi.fn(),
  useSaveSearch: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}))

const mockUseSavedSearches = vi.mocked(useSavedSearches)
const mockUseDeleteSavedSearch = vi.mocked(useDeleteSavedSearch)
const mockUseSaveSearch = vi.mocked(useSaveSearch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSavedSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'search-1',
    name: 'Slow API calls',
    kql_query: 'duration_ms > 5000',
    filters: { log_type: 'API' },
    is_pinned: false,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDeleteMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  }
}

function makeSaveMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(makeSavedSearch()),
    isPending: false,
    ...overrides,
  }
}

const defaultProps = {
  currentQuery: 'error',
  currentFilters: [],
  onLoad: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SavedSearches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)
    mockUseDeleteSavedSearch.mockReturnValue(
      makeDeleteMutation() as unknown as ReturnType<typeof useDeleteSavedSearch>,
    )
    mockUseSaveSearch.mockReturnValue(
      makeSaveMutation() as unknown as ReturnType<typeof useSaveSearch>,
    )
  })

  it('renders the trigger button with "Saved" label', () => {
    render(<SavedSearches {...defaultProps} />)
    expect(screen.getByRole('button', { name: /saved searches/i })).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('opens the dropdown on trigger click', async () => {
    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Save current search')).toBeInTheDocument()
  })

  it('shows empty state message when there are no saved searches', async () => {
    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    expect(screen.getByText(/no saved searches yet/i)).toBeInTheDocument()
  })

  it('shows loading indicator while data is loading', async () => {
    mockUseSavedSearches.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders a list of saved searches', async () => {
    const searches = [
      makeSavedSearch({ id: 'search-1', name: 'Slow API calls' }),
      makeSavedSearch({ id: 'search-2', name: 'SQL errors', kql_query: 'level:ERROR' }),
    ]
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: searches },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    expect(screen.getByText('Slow API calls')).toBeInTheDocument()
    expect(screen.getByText('SQL errors')).toBeInTheDocument()
  })

  it('renders pinned searches before unpinned ones', async () => {
    const searches = [
      makeSavedSearch({ id: 'search-1', name: 'Unpinned', is_pinned: false, created_at: '2024-02-01T00:00:00Z' }),
      makeSavedSearch({ id: 'search-2', name: 'Pinned', is_pinned: true, created_at: '2024-01-01T00:00:00Z' }),
    ]
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: searches },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))

    const items = screen.getAllByRole('listitem')
    // First item in the list should contain 'Pinned'
    expect(items[0]).toHaveTextContent('Pinned')
  })

  it('calls onLoad with query and filters when a saved search is clicked', async () => {
    const onLoad = vi.fn()
    const search = makeSavedSearch({
      kql_query: 'duration_ms > 1000',
      filters: { log_type: 'SQL', user: 'admin' },
    })
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: [search] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} onLoad={onLoad} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Slow API calls'))

    expect(onLoad).toHaveBeenCalledWith('duration_ms > 1000', [
      { field: 'log_type', value: 'SQL', operator: 'eq' },
      { field: 'user', value: 'admin', operator: 'eq' },
    ])
  })

  it('closes dropdown after loading a search', async () => {
    const search = makeSavedSearch()
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: [search] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Slow API calls'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls deleteMutation.mutateAsync when delete button is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    mockUseDeleteSavedSearch.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteSavedSearch>)

    const search = makeSavedSearch({ id: 'search-1', name: 'Slow API calls' })
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: [search] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByRole('button', { name: /delete saved search: slow api calls/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('search-1')
    })
  })

  it('disables delete button while deletion is in progress', async () => {
    // mutateAsync returns a never-resolving promise so deletingId stays set
    let resolveMutate: () => void
    const mutateAsync = vi.fn().mockImplementation(
      () => new Promise<void>((res) => { resolveMutate = res }),
    )
    mockUseDeleteSavedSearch.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteSavedSearch>)

    const search = makeSavedSearch({ id: 'search-1', name: 'Slow API calls' })
    mockUseSavedSearches.mockReturnValue({
      data: { saved_searches: [search] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSavedSearches>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))

    // Click delete — this sets deletingId = search.id (button becomes disabled)
    await user.click(screen.getByRole('button', { name: /delete saved search: slow api calls/i }))

    // Now the button is disabled because deletingId === search.id
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete saved search: slow api calls/i }),
      ).toBeDisabled()
    })

    // Clean up: resolve the pending promise
    resolveMutate!()
  })

  it('opens save dialog when "Save current search" is clicked', async () => {
    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Save current search'))

    expect(screen.getByRole('dialog', { name: /save search/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('save dialog calls saveMutation.mutateAsync with trimmed name', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(makeSavedSearch())
    mockUseSaveSearch.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSaveSearch>)

    const user = userEvent.setup()
    render(
      <SavedSearches
        {...defaultProps}
        currentQuery="duration_ms > 5000"
        currentFilters={[{ field: 'log_type', value: 'API', operator: 'eq' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Save current search'))

    const input = screen.getByLabelText('Name')
    await user.type(input, '  My Search  ')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'My Search',
        query: 'duration_ms > 5000',
        filters: { log_type: 'API' },
      })
    })
  })

  it('save dialog submit button is disabled when name is empty', async () => {
    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Save current search'))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('closes save dialog on Cancel click', async () => {
    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Save current search'))
    expect(screen.getByRole('dialog', { name: /save search/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog', { name: /save search/i })).not.toBeInTheDocument()
  })

  it('shows "Saving…" label on submit button while save is pending', async () => {
    mockUseSaveSearch.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useSaveSearch>)

    const user = userEvent.setup()
    render(<SavedSearches {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /saved searches/i }))
    await user.click(screen.getByText('Save current search'))

    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
  })
})
