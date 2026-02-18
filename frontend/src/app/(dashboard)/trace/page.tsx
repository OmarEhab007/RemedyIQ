'use client'

/**
 * trace/page.tsx — Global trace search page.
 *
 * TraceSearch (with job picker) + recent traces list.
 * When a job is selected, searches transactions within that job.
 */

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { useAnalyses, useRecentTraces } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import { TraceSearch } from '@/components/trace/trace-search'
import { TraceComparison } from '@/components/trace/trace-comparison'
import { useAuth } from '@clerk/nextjs'
import type { RecentTrace } from '@/lib/api-types'

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'
const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001'

function useUserId(): string | null {
  if (IS_DEV_MODE) return DEV_USER_ID
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Trace Explorer</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Search and compare distributed traces across your AR Server logs.
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
            onChange={(e) => setSelectedJobId(e.target.value)}
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
            onClick={() => setActiveTab(id)}
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
          selectedJobId ? (
            <TraceComparison jobId={selectedJobId} />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-12 text-center text-sm text-[var(--color-text-secondary)]">
              Select an analysis job above to compare traces.
            </div>
          )
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
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full border-collapse text-sm" role="table">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)]">
                  {['Trace ID', 'User', 'Queue', 'Duration', 'Spans', 'Errors', 'Time'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-[var(--color-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTraces.map((trace) => (
                  <tr
                    key={`${trace.job_id}-${trace.trace_id}`}
                    className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    role="row"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={ROUTES.ANALYSIS_TRACE(trace.job_id, trace.trace_id)}
                        className="font-mono text-xs text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                      >
                        {trace.trace_id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm">{trace.user || '—'}</td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">{trace.queue || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-sm font-medium">
                      {trace.duration_ms.toFixed(1)} ms
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                      {trace.span_count}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {trace.error_count > 0 ? (
                        <span className="text-xs font-semibold text-[var(--color-error)]">{trace.error_count}</span>
                      ) : (
                        <span className="text-xs text-[var(--color-success)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
                      {new Date(trace.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
