'use client'

/**
 * Global Log Explorer — /explorer
 *
 * Cross-job search: user selects a job from a dropdown, then the same
 * explorer components are used to search within that job. Falls back to
 * the most recent job if only one exists.
 *
 * Layout:
 *   [Job selector | SearchBar | SavedSearches | ExportButton]
 *   [TimelineHistogram]
 *   [FilterPanel | LogTable | DetailPanel]
 */

import { useState, useMemo, useCallback } from 'react'

import { useExplorerStore } from '@/stores/explorer-store'
import { useSearchLogs, useAnalyses } from '@/hooks/use-api'
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
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// JobSelector — dropdown to pick the active job
// ---------------------------------------------------------------------------

interface JobSelectorProps {
  jobId: string | null
  onChange: (jobId: string) => void
  className?: string
}

function JobSelector({ jobId, onChange, className }: JobSelectorProps) {
  const { data: analysesData, isLoading } = useAnalyses()
  const jobs = analysesData?.jobs ?? []
  const completedJobs = jobs.filter((j) => j.status === 'complete')

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        htmlFor="explorer-job-select"
        className="shrink-0 text-xs font-medium text-[var(--color-text-secondary)]"
      >
        Job
      </label>
      <select
        id="explorer-job-select"
        value={jobId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || completedJobs.length === 0}
        aria-label="Select analysis job"
        className={cn(
          'h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 pr-7 text-sm text-[var(--color-text-primary)]',
          'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20',
          'disabled:opacity-50',
        )}
      >
        {completedJobs.length === 0 && (
          <option value="">
            {isLoading ? 'Loading…' : 'No completed jobs'}
          </option>
        )}
        {completedJobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.id.slice(0, 8)}… — {new Date(job.created_at).toLocaleDateString()}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GlobalExplorerPage
// ---------------------------------------------------------------------------

export default function GlobalExplorerPage() {
  const { data: analysesData } = useAnalyses()

  // Derive default job from most recent completed job
  const defaultJobId = useMemo(() => {
    const jobs = analysesData?.jobs ?? []
    const completed = jobs
      .filter((j) => j.status === 'complete')
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    return completed[0]?.id ?? null
  }, [analysesData])

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const activeJobId = selectedJobId ?? defaultJobId

  // Explorer store
  const query = useExplorerStore((s) => s.query)
  const filters = useExplorerStore((s) => s.filters)
  const selectedEntryId = useExplorerStore((s) => s.selectedEntryId)
  const setQuery = useExplorerStore((s) => s.setQuery)
  const addFilter = useExplorerStore((s) => s.addFilter)
  const removeFilter = useExplorerStore((s) => s.removeFilter)
  const clearFilters = useExplorerStore((s) => s.clearFilters)
  const selectEntry = useExplorerStore((s) => s.selectEntry)
  const reset = useExplorerStore((s) => s.reset)

  const debouncedQuery = useDebounce(query, 300)

  // Build search params from store state
  const searchParams = useMemo<SearchLogsParams>(() => {
    const p: SearchLogsParams = { page: 1, page_size: 200 }
    if (debouncedQuery) p.q = debouncedQuery

    for (const filter of filters) {
      switch (filter.field) {
        case 'log_type':
          p.log_type = filter.value
          break
        case 'user':
          p.user = filter.value
          break
        case 'form':
          p.form = filter.value
          break
        case 'queue':
          p.queue = filter.value
          break
        case 'error_only':
          p.error_only = true
          break
        case 'min_duration':
          p.min_duration = parseInt(filter.value, 10)
          break
        case 'max_duration':
          p.max_duration = parseInt(filter.value, 10)
          break
      }
    }

    return p
  }, [debouncedQuery, filters])

  const {
    data: searchData,
    isLoading,
    isError,
    refetch,
  } = useSearchLogs(activeJobId, searchParams)

  const entries = searchData?.entries ?? []
  const total = searchData?.total ?? 0

  // When job changes, reset store so stale selection / query is cleared
  const handleJobChange = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId)
      reset()
    },
    [reset],
  )

  const handleLoadSavedSearch = useCallback(
    (savedQuery: string, savedFilters: ExplorerFilter[]) => {
      setQuery(savedQuery)
      clearFilters()
      savedFilters.forEach(addFilter)
    },
    [setQuery, clearFilters, addFilter],
  )

  if (!activeJobId && !isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Log Explorer
        </h1>
        <PageState
          variant="empty"
          title="No completed jobs"
          description="Upload a log file and run an analysis to start exploring log entries."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Page heading */}
      <div className="flex shrink-0 items-center gap-2">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Log Explorer
        </h1>
        <span className="text-[var(--color-text-tertiary)]" aria-hidden="true">
          —
        </span>
        <JobSelector
          jobId={activeJobId}
          onChange={handleJobChange}
        />
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={setQuery}
          jobId={activeJobId}
          className="flex-1"
        />
        <SavedSearches
          currentQuery={query}
          currentFilters={filters}
          onLoad={handleLoadSavedSearch}
        />
        {activeJobId && (
          <ExportButton
            jobId={activeJobId}
            searchParams={searchParams}
            disabled={entries.length === 0}
          />
        )}
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
          message="Failed to load log entries."
          onRetry={() => void refetch()}
        />
      )}

      {/* Main content area */}
      {!isError && (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <FilterPanel
            filters={filters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onClearFilters={clearFilters}
          />

          <LogTable
            entries={entries}
            selectedEntryId={selectedEntryId}
            onSelectEntry={selectEntry}
            isLoading={isLoading}
            total={total}
            className="flex-1"
          />

          {selectedEntryId && activeJobId && (
            <DetailPanel
              jobId={activeJobId}
              entryId={selectedEntryId}
              onClose={() => selectEntry(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
