'use client'

/**
 * Global Log Explorer — /explorer
 */

import { useState, useMemo, useCallback, useEffect, useRef, Suspense, startTransition } from 'react'
import { useSearchParams } from 'next/navigation'

import { useExplorerStore } from '@/stores/explorer-store'
import { useLogExplorerSearch, useAnalyses } from '@/hooks/use-api'
import type { ExplorerFilter } from '@/stores/explorer-store'

import { SearchBar } from '@/components/explorer/search-bar'
import { FilterPanel } from '@/components/explorer/filter-panel'
import { LogTable } from '@/components/explorer/log-table'
import { TimelineHistogram } from '@/components/explorer/timeline-histogram'
import { DetailPanel } from '@/components/explorer/detail-panel'
import { SavedSearches } from '@/components/explorer/saved-searches'
import { ExportButton } from '@/components/explorer/export-button'
import { PageState } from '@/components/ui/page-state'
import { LogExplorerShell } from '@/components/explorer/log-explorer-shell'
import { ExplorerTimeRangeBar } from '@/components/explorer/explorer-time-range-bar'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

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

function GlobalExplorerPageInner() {
  const { data: analysesData, isLoading: analysesLoading } = useAnalyses()
  const urlSearchParams = useSearchParams()

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
  const reset = useExplorerStore((s) => s.reset)
  const setTimeRange = useExplorerStore((s) => s.setTimeRange)
  const setSortColumn = useExplorerStore((s) => s.setSortColumn)

  const urlInitRef = useRef(false)
  useEffect(() => {
    if (urlInitRef.current) return
    const jobFromUrl = urlSearchParams.get('job')?.trim()
    const qFromUrl = urlSearchParams.get('q')?.trim()
    if (!jobFromUrl && !qFromUrl) return
    urlInitRef.current = true
    startTransition(() => {
      if (jobFromUrl) {
        setSelectedJobId(jobFromUrl)
      }
      if (qFromUrl) {
        setQuery(qFromUrl)
      }
    })
  }, [urlSearchParams, setQuery])

  const debouncedQuery = useDebounce(query, 300)

  const search = useLogExplorerSearch(activeJobId, {
    debouncedQuery,
    filters,
    timeRange,
    sortBy,
    sortOrder,
    pageSize: 200,
  })

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

  const showHistogram =
    !search.isError &&
    ((search.histogram?.length ?? 0) > 0 || search.entries.length > 0)

  if (!activeJobId && !analysesLoading) {
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
    <LogExplorerShell
      header={
        <>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Log Explorer
          </h1>
          <span className="text-[var(--color-text-tertiary)]" aria-hidden="true">
            —
          </span>
          <JobSelector jobId={activeJobId} onChange={handleJobChange} />
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
              searchParams={search.exportSearchParams}
              disabled={search.entries.length === 0}
            />
          )}
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
            message="Failed to load log entries."
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

          {selectedEntryId && activeJobId && (
            <DetailPanel
              jobId={activeJobId}
              entryId={selectedEntryId}
              onClose={() => selectEntry(null)}
            />
          )}
        </>
      ) : null}
    </LogExplorerShell>
  )
}

export default function GlobalExplorerPage() {
  return (
    <Suspense fallback={<PageState variant="loading" rows={4} />}>
      <GlobalExplorerPageInner />
    </Suspense>
  )
}
