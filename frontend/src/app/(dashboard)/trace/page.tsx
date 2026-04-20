'use client'

/**
 * trace/page.tsx — Global trace search page.
 *
 * TraceSearch (with job picker) + recent traces list.
 * When a job is selected, searches transactions within that job.
 */

import { useEffect, useState, Suspense } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { trackEvent } from '@/lib/telemetry'
import { useAnalyses, useRecentTraces } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import { TraceSearch } from '@/components/trace/trace-search'
import { TraceComparison } from '@/components/trace/trace-comparison'
import { useAuth } from '@clerk/nextjs'
import type { RecentTrace } from '@/lib/api-types'
import { isHeaderAuthMode } from '@/lib/auth-mode'

const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001'

const RECENT_TRACES_RESIZE: ResizableColumnConfig[] = [
  { id: 'trace', defaultWidth: 200, minWidth: 120, maxWidth: 480 },
  { id: 'user', defaultWidth: 120, minWidth: 72, maxWidth: 240 },
  { id: 'queue', defaultWidth: 140, minWidth: 72, maxWidth: 360 },
  { id: 'duration', defaultWidth: 112, minWidth: 88, maxWidth: 180 },
  { id: 'spans', defaultWidth: 72, minWidth: 56, maxWidth: 120 },
  { id: 'errors', defaultWidth: 80, minWidth: 56, maxWidth: 120 },
  { id: 'time', defaultWidth: 168, minWidth: 120, maxWidth: 280 },
]

function RecentTracesTable({ traces }: { traces: RecentTrace[] }) {
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(RECENT_TRACES_RESIZE, {
    storageKey: 'remedyiq:recent-traces:v1',
  })

  const headers = ['Trace ID', 'User', 'Queue', 'Duration', 'Spans', 'Errors', 'Time'] as const

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="border-collapse text-sm" style={tableLayoutStyle} role="table">
        <thead>
          <tr className="bg-[var(--color-bg-secondary)]">
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                style={thStyle(i)}
                className={cn(
                  'relative box-border border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]',
                  (h === 'Duration' || h === 'Spans') && 'text-right',
                  h === 'Errors' && 'text-center',
                  !['Duration', 'Spans', 'Errors'].includes(h) && 'text-left',
                )}
              >
                <span className="pr-2">{h}</span>
                {renderResizeHandle(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr
              key={`${trace.job_id}-${trace.trace_id}`}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              role="row"
            >
              <td style={tdStyle(0)} className="box-border min-w-0 px-3 py-2 align-top">
                <Link
                  href={ROUTES.ANALYSIS_TRACE(trace.job_id, trace.trace_id)}
                  className="break-all font-mono text-xs text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                  title={trace.trace_id}
                >
                  {trace.trace_id}
                </Link>
              </td>
              <td style={tdStyle(1)} className="box-border min-w-0 px-3 py-2 align-top text-sm break-words">{trace.user || '—'}</td>
              <td style={tdStyle(2)} className="box-border min-w-0 px-3 py-2 align-top text-xs text-[var(--color-text-secondary)] break-words" title={trace.queue ?? undefined}>
                {trace.queue || '—'}
              </td>
              <td style={tdStyle(3)} className="box-border px-3 py-2 align-top tabular-nums text-sm font-medium">
                {trace.duration_ms.toFixed(1)} ms
              </td>
              <td style={tdStyle(4)} className="box-border px-3 py-2 align-top text-xs text-[var(--color-text-secondary)]">
                {trace.span_count}
              </td>
              <td style={tdStyle(5)} className="box-border px-3 py-2 align-top text-center">
                {trace.error_count > 0 ? (
                  <span className="text-xs font-semibold text-[var(--color-error)]">{trace.error_count}</span>
                ) : (
                  <span className="text-xs text-[var(--color-success)]">—</span>
                )}
              </td>
              <td style={tdStyle(6)} className="box-border min-w-0 px-3 py-2 align-top text-xs text-[var(--color-text-tertiary)] break-words">
                {new Date(trace.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function useUserId(): string | null {
  if (isHeaderAuthMode()) return DEV_USER_ID
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { userId } = useAuth()
  return userId ?? null
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams inside Suspense)
// ---------------------------------------------------------------------------

function TracePageContent() {
  const userId = useUserId()
  const searchParams = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string>(searchParams.get('job') ?? '')
  const [activeTab, setActiveTab] = useState<'search' | 'compare'>('search')

  const { data: analysesData, isLoading: analysesLoading } = useAnalyses()
  const { data: recentData, isLoading: recentLoading } = useRecentTraces(userId)

  const jobs = analysesData?.jobs ?? []
  const recentTraces: RecentTrace[] = recentData?.traces ?? []

  useEffect(() => {
    trackEvent('nav_click', {
      from_surface: 'sidebar',
      to_surface: 'trace',
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Trace Explorer</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Secondary surface for deep trace analysis. Core investigations begin in Investigate.
        </p>
      </div>

      {/* Job picker */}
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="trace-job-picker"
          className="text-sm font-semibold text-[var(--color-text-secondary)] shrink-0"
        >
          Analysis Job:
        </label>
        {analysesLoading ? (
          <div className="h-8 w-48 animate-pulse rounded-md bg-[var(--color-border)]" />
        ) : (
          <select
            id="trace-job-picker"
            value={selectedJobId}
            onChange={(e) => {
              const jobId = e.target.value
              setSelectedJobId(jobId)
              trackEvent('nav_click', {
                from_surface: 'trace',
                to_surface: 'trace',
                job_id: jobId || null,
              })
            }}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Select analysis job"
          >
            <option value="">-- Select a job --</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.id.slice(0, 12)} — {job.status}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs: Search | Compare */}
      <div className="flex border-b border-[var(--color-border)]" role="tablist" aria-label="Trace tools">
        {(
          [
            { id: 'search' as const, label: 'Search Traces' },
            { id: 'compare' as const, label: 'Compare Traces' },
          ]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`trace-page-tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`trace-page-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => {
              setActiveTab(id)
              trackEvent('nav_click', {
                from_surface: 'trace',
                to_surface: id === 'search' ? 'trace_search' : 'trace_compare',
              })
            }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none',
              activeTab === id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        id="trace-page-panel-search"
        role="tabpanel"
        aria-labelledby="trace-page-tab-search"
        hidden={activeTab !== 'search'}
      >
        {activeTab === 'search' && (
          selectedJobId ? (
            <TraceSearch jobId={selectedJobId} />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-secondary)]">
              Select an analysis job above to search for traces.
            </div>
          )
        )}
      </div>

      <div
        id="trace-page-panel-compare"
        role="tabpanel"
        aria-labelledby="trace-page-tab-compare"
        hidden={activeTab !== 'compare'}
      >
        {activeTab === 'compare' && (
          <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-[var(--color-text-secondary)]">
              Compare traces (advanced)
            </summary>
            <div className="mt-3">
              {selectedJobId ? (
                <TraceComparison jobId={selectedJobId} />
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-secondary)]">
                  Select an analysis job above to compare traces.
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* Recent traces */}
      <section aria-labelledby="recent-traces-heading">
        <h2
          id="recent-traces-heading"
          className="mb-3 text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          Recent Traces
        </h2>

        {recentLoading && <PageState variant="loading" rows={4} />}

        {!recentLoading && recentTraces.length === 0 && (
          <PageState
            variant="empty"
            title="No recent traces"
            description="Traces you view will appear here."
          />
        )}

        {!recentLoading && recentTraces.length > 0 && (
          <RecentTracesTable traces={recentTraces} />
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function TracePage() {
  return (
    <Suspense fallback={<PageState variant="loading" rows={6} />}>
      <TracePageContent />
    </Suspense>
  )
}
