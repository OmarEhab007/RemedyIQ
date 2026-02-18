/**
 * Integration tests for Job-scoped Explorer page.
 *
 * Covers: renders with valid jobId, shows search bar / filter panel,
 * renders results, opens detail panel on row click, error state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import JobExplorerPage from './page'
import type { SearchLogsResponse, LogEntry } from '@/lib/api-types'
import type { ExplorerFilter } from '@/stores/explorer-store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/navigation — useParams is already globally mocked in test-setup.tsx
// We override per-test using vi.mocked

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-api', () => ({
  useSearchLogs: vi.fn(),
  useAutocomplete: vi.fn(),
  useSavedSearches: vi.fn(),
}))

vi.mock('@/stores/explorer-store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useExplorerStore: vi.fn() as any,
}))

// Mock sub-components to isolate page logic
vi.mock('@/components/explorer/detail-panel', () => ({
  DetailPanel: ({ entryId, onClose }: { entryId: string; onClose: () => void }) => (
    <div data-testid="detail-panel" data-entry-id={entryId}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

vi.mock('@/components/explorer/timeline-histogram', () => ({
  TimelineHistogram: () => <div data-testid="timeline-histogram" />,
}))

vi.mock('@/components/explorer/saved-searches', () => ({
  SavedSearches: () => <div data-testid="saved-searches" />,
}))

vi.mock('@/components/explorer/export-button', () => ({
  ExportButton: () => <div data-testid="export-button" />,
}))

import { useParams } from 'next/navigation'
import { useSearchLogs, useAutocomplete, useSavedSearches } from '@/hooks/use-api'
import { useExplorerStore } from '@/stores/explorer-store'

const mockUseParams = useParams as ReturnType<typeof vi.fn>
const mockUseSearchLogs = useSearchLogs as ReturnType<typeof vi.fn>
const mockUseAutocomplete = useAutocomplete as ReturnType<typeof vi.fn>
const mockUseSavedSearches = useSavedSearches as ReturnType<typeof vi.fn>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseExplorerStore = useExplorerStore as unknown as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// react-window mock
// ---------------------------------------------------------------------------

vi.mock('react-window', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-window')>()
  return {
    ...actual,
    FixedSizeList: ({
      children: Children,
      itemCount,
      itemData,
    }: {
      children: React.ComponentType<{ index: number; style: React.CSSProperties; data: unknown }>
      itemCount: number
      itemData: unknown
    }) => (
      <div data-testid="fixed-size-list">
        {Array.from({ length: itemCount }, (_, i) => (
          <Children key={i} index={i} style={{}} data={itemData} />
        ))}
      </div>
    ),
  }
})

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  constructor(callback: ResizeObserverCallback) {
    callback(
      [{ contentRect: { height: 500, width: 800 } } as ResizeObserverEntry],
      this,
    )
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JOB_ID = 'test-job-abc'

function makeEntry(id: string): LogEntry {
  return {
    tenant_id: 'tenant-1',
    job_id: JOB_ID,
    entry_id: id,
    line_number: 1,
    timestamp: '2025-01-15T10:30:00.000Z',
    log_type: 'API',
    trace_id: 'trace-1',
    rpc_id: 'rpc-1',
    thread_id: 'th-1',
    queue: 'Q1',
    user: 'alice',
    duration_ms: 200,
    success: true,
    form: 'HPD:Help_Desk',
    sql_table: null,
    filter_name: null,
    esc_name: null,
    raw_text: 'raw text',
    error_message: null,
  }
}

const mockSearchResponse: SearchLogsResponse = {
  entries: [makeEntry('e1'), makeEntry('e2')],
  total: 2,
  pagination: { page: 1, page_size: 200, total: 2, total_pages: 1 },
}

// ---------------------------------------------------------------------------
// Setup store mock
// ---------------------------------------------------------------------------

interface MockExplorerState {
  query: string
  filters: ExplorerFilter[]
  selectedEntryId: string | null
  setQuery: ReturnType<typeof vi.fn>
  addFilter: ReturnType<typeof vi.fn>
  removeFilter: ReturnType<typeof vi.fn>
  clearFilters: ReturnType<typeof vi.fn>
  selectEntry: ReturnType<typeof vi.fn>
}

function setupStoreMock(selectedEntryId: string | null = null) {
  const setQuery = vi.fn()
  const addFilter = vi.fn()
  const removeFilter = vi.fn()
  const clearFilters = vi.fn()
  const selectEntry = vi.fn()

  const state: MockExplorerState = {
    query: '',
    filters: [],
    selectedEntryId,
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    selectEntry,
  }

  mockUseExplorerStore.mockImplementation(
    (selector: (s: MockExplorerState) => unknown) => selector(state),
  )

  return { setQuery, addFilter, removeFilter, clearFilters, selectEntry }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobExplorerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: JOB_ID })
    mockUseAutocomplete.mockReturnValue({ data: undefined })
    mockUseSavedSearches.mockReturnValue({ data: { saved_searches: [] } })
  })

  it('renders the page heading', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('heading', { name: /log explorer/i })).toBeInTheDocument()
  })

  it('shows the job ID in the toolbar', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByText(JOB_ID)).toBeInTheDocument()
  })

  it('renders the search bar', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders filter panel and log table when data is available', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('complementary', { name: /log filters/i })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: /log entries/i })).toBeInTheDocument()
  })

  it('renders loading state while fetching', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('status', { name: /loading content/i })).toBeInTheDocument()
  })

  it('renders error state when fetch fails', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders detail panel when an entry is selected', () => {
    setupStoreMock('e1')
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    const panel = screen.getByTestId('detail-panel')
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute('data-entry-id', 'e1')
  })

  it('does not render detail panel when no entry is selected', () => {
    setupStoreMock(null)
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument()
  })

  it('shows error message for invalid jobId', () => {
    setupStoreMock()
    mockUseParams.mockReturnValue({ id: undefined })
    mockUseSearchLogs.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/invalid job id/i)).toBeInTheDocument()
  })

  it('renders timeline histogram when entries are present', () => {
    setupStoreMock()
    mockUseSearchLogs.mockReturnValue({
      data: mockSearchResponse,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<JobExplorerPage />)
    expect(screen.getByTestId('timeline-histogram')).toBeInTheDocument()
  })
})
