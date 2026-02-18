'use client'

/**
 * Job-scoped Log Explorer — /analysis/[id]/explorer
 *
 * Composes all explorer components scoped to a specific analysis job.
 * The job ID comes from the URL param via useParams().
 *
 * Layout:
 *   [Toolbar: SearchBar | SavedSearches | ExportButton]
 *   [TimelineHistogram]
 *   [FilterPanel | LogTable | DetailPanel]
 */

import { useParams, useRouter } from 'next/navigation'
import { useMemo, useCallback, useState } from 'react'

import { useExplorerStore } from '@/stores/explorer-store'
import { useSearchLogs } from '@/hooks/use-api'
import type { ExplorerFilter } from '@/stores/explorer-store'
import type { SearchLogsParams } from '@/lib/api-types'

import { SearchBar } from '@/components/explorer/search-bar'
import { FilterPanel } from '@/components/explorer/filter-panel'
import { LogTable } from '@/components/explorer/log-table'
import { TimelineHistogram } from '@/components/explorer/timeline-histogram'
import { DetailPanel } from '@/components/explorer/detail-panel'
import { SavedSearches } from '@/components/explorer/saved-searches'
import { ExportButton } from '@/components/explorer/export-button'
import { PageState } from '@/components/ui/page-state'
import { ROUTES } from '@/lib/constants'
import { useDebounce } from '@/hooks/use-debounce'

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function JobExplorerPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = typeof params.id === 'string' ? params.id : null

  // Explorer store
  const query = useExplorerStore((s) => s.query)
  const filters = useExplorerStore((s) => s.filters)
  const selectedEntryId = useExplorerStore((s) => s.selectedEntryId)
  const setQuery = useExplorerStore((s) => s.setQuery)
  const addFilter = useExplorerStore((s) => s.addFilter)
  const removeFilter = useExplorerStore((s) => s.removeFilter)
  const clearFilters = useExplorerStore((s) => s.clearFilters)
  const selectEntry = useExplorerStore((s) => s.selectEntry)

  // Debounce the search query for the API call
  const debouncedQuery = useDebounce(query, 300)
  const [page, setPage] = useState(1)
  const pageSize = 200

  // Reset page when query or filters change
  const searchKey = useMemo(() => JSON.stringify({ q: debouncedQuery, filters }), [debouncedQuery, filters])
  const [prevSearchKey, setPrevSearchKey] = useState(searchKey)
  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey)
    setPage(1)
  }

  // Build search params from store state
  const searchParams = useMemo<SearchLogsParams>(() => {
    const params: SearchLogsParams = {
      page,
      page_size: pageSize,
    }

    if (debouncedQuery) params.q = debouncedQuery

    for (const filter of filters) {
      switch (filter.field) {
        case 'log_type':
          params.log_type = filter.value
          break
        case 'user':
          params.user = filter.value
          break
        case 'form':
          params.form = filter.value
          break
        case 'queue':
          params.queue = filter.value
          break
        case 'error_only':
          params.error_only = true
          break
        case 'min_duration':
          params.min_duration = parseInt(filter.value, 10)
          break
        case 'max_duration':
          params.max_duration = parseInt(filter.value, 10)
          break
      }
    }

    return params
  }, [debouncedQuery, filters, page])

  const {
    data: searchData,
    isLoading,
    isError,
    refetch,
  } = useSearchLogs(jobId, searchParams)

  const entries = searchData?.entries ?? []
  const total = searchData?.total ?? 0
  const totalPages = searchData?.pagination?.total_pages ?? 1
  const hasMore = page < totalPages

  // Restore a saved search into the store
  const handleLoadSavedSearch = useCallback(
    (savedQuery: string, savedFilters: ExplorerFilter[]) => {
      setQuery(savedQuery)
      clearFilters()
      savedFilters.forEach(addFilter)
    },
    [setQuery, clearFilters, addFilter],
  )

  if (!jobId) {
    return (
      <PageState
        variant="error"
        message="Invalid job ID. Please navigate from the analysis list."
        onRetry={() => router.push(ROUTES.ANALYSIS)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Page heading */}
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Log Explorer
        </h1>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          Job: <span className="font-mono">{jobId}</span>
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={setQuery}
          jobId={jobId}
          className="flex-1"
        />
        <SavedSearches
          currentQuery={query}
          currentFilters={filters}
          onLoad={handleLoadSavedSearch}
        />
        <ExportButton
          jobId={jobId}
          searchParams={searchParams}
          disabled={entries.length === 0}
        />
      </div>

      {/* Timeline histogram */}
      {entries.length > 0 && (
        <TimelineHistogram
          entries={entries}
          className="shrink-0"
          height={100}
        />
      )}

      {/* Error state */}
      {isError && (
        <PageState
          variant="error"
          message="Failed to load log entries. Check your search parameters."
          onRetry={() => void refetch()}
        />
      )}

      {/* Main content area: FilterPanel + LogTable + DetailPanel */}
      {!isError && (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          {/* Filter sidebar */}
          <FilterPanel
            filters={filters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onClearFilters={clearFilters}
          />

          {/* Log table — fills remaining space */}
          <LogTable
            entries={entries}
            selectedEntryId={selectedEntryId}
            onSelectEntry={selectEntry}
            isLoading={isLoading}
            total={total}
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            className="flex-1"
          />

          {/* Detail panel — shown when an entry is selected */}
          {selectedEntryId && (
            <DetailPanel
              jobId={jobId}
              entryId={selectedEntryId}
              onClose={() => selectEntry(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
