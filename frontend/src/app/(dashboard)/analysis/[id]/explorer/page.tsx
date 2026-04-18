'use client'

/**
 * Job-scoped Log Explorer — /analysis/[id]/explorer
 */

import { useParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useExplorerStore } from '@/stores/explorer-store'
import { useLogExplorerSearch } from '@/hooks/use-api'
import type { ExplorerFilter } from '@/stores/explorer-store'

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
import { LogExplorerShell } from '@/components/explorer/log-explorer-shell'
import { ExplorerTimeRangeBar } from '@/components/explorer/explorer-time-range-bar'

export default function JobExplorerPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = typeof params.id === 'string' ? params.id : null

  const query = useExplorerStore((s) => s.query)
  const filters = useExplorerStore((s) => s.filters)
  const selectedEntryId = useExplorerStore((s) => s.selectedEntryId)
  const timeRange = useExplorerStore((s) => s.timeRange)
  const sortBy = useExplorerStore((s) => s.sortBy)
  const sortOrder = useExplorerStore((s) => s.sortOrder)
  const setQuery = useExplorerStore((s) => s.setQuery)
  const addFilter = useExplorerStore((s) => s.addFilter)
  const removeFilter = useExplorerStore((s) => s.removeFilter)
  const clearFilters = useExplorerStore((s) => s.clearFilters)
  const selectEntry = useExplorerStore((s) => s.selectEntry)
  const setTimeRange = useExplorerStore((s) => s.setTimeRange)
  const setSortColumn = useExplorerStore((s) => s.setSortColumn)

  const debouncedQuery = useDebounce(query, 300)

  const search = useLogExplorerSearch(jobId, {
    debouncedQuery,
    filters,
    timeRange,
    sortBy,
    sortOrder,
    pageSize: 200,
  })

  const handleLoadSavedSearch = useCallback(
    (savedQuery: string, savedFilters: ExplorerFilter[]) => {
      setQuery(savedQuery)
      clearFilters()
      savedFilters.forEach(addFilter)
    },
    [setQuery, clearFilters, addFilter],
  )

  const showHistogram =
    !search.isError &&
    ((search.histogram?.length ?? 0) > 0 || search.entries.length > 0)

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
    <LogExplorerShell
      header={
        <>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Log Explorer
          </h1>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Job: <span className="font-mono">{jobId}</span>
          </span>
        </>
      }
      accessory={
        <>
          <ExplorerTimeRangeBar timeRange={timeRange} onChange={setTimeRange} />
          {search.took_ms !== undefined && search.took_ms >= 0 && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Search took {search.took_ms} ms
            </span>
          )}
        </>
      }
      toolbar={
        <>
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
            searchParams={search.exportSearchParams}
            disabled={search.entries.length === 0}
          />
        </>
      }
      histogram={
        showHistogram ? (
          <TimelineHistogram
            entries={search.entries}
            serverHistogram={search.histogram}
            className="shrink-0"
            height={100}
          />
        ) : undefined
      }
      error={
        search.isError ? (
          <PageState
            variant="error"
            message="Failed to load log entries. Check your search parameters."
            onRetry={() => void search.refetch()}
          />
        ) : undefined
      }
    >
      {!search.isError ? (
        <>
          <FilterPanel
            filters={filters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onClearFilters={clearFilters}
            facets={search.facets}
          />

          <LogTable
            entries={search.entries}
            selectedEntryId={selectedEntryId}
            onSelectEntry={selectEntry}
            isLoading={search.isInitialLoading}
            total={search.total}
            hasMore={search.hasNextPage}
            onLoadMore={() => void search.fetchNextPage()}
            isFetchingMore={search.isFetchingNextPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortColumn={setSortColumn}
            className="flex-1"
          />

          {selectedEntryId && (
            <DetailPanel
              jobId={jobId}
              entryId={selectedEntryId}
              onClose={() => selectEntry(null)}
            />
          )}
        </>
      ) : null}
    </LogExplorerShell>
  )
}
