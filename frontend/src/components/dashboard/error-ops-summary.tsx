'use client'

/**
 * ErrorOpsSummary — AR-admin focused error strip: JAR totals, timeline supplement,
 * top queues, top patterns, deep links to Explorer and the error catalog section.
 */

import Link from 'next/link'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  ROUTES,
  DASHBOARD_EXPAND_SECTION_EVENT,
  type DashboardExpandSectionDetail,
} from '@/lib/constants'
import { analysisExplorerHref, buildTraceExplorerQuery } from '@/lib/explorer-query'
import type { ErrorSummary } from '@/lib/api-types'

export interface ErrorOpsSummaryProps {
  jobId: string
  summary: ErrorSummary | undefined
  className?: string
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'jar_primary':
      return 'JAR (primary)'
    case 'jar_plus_timeseries':
      return 'JAR + timeline'
    case 'derived_topn':
      return 'Derived (Top-N)'
    default:
      return source
  }
}

export function ErrorOpsSummary({ jobId, summary, className }: ErrorOpsSummaryProps) {
  const openExceptions = useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent<DashboardExpandSectionDetail>(DASHBOARD_EXPAND_SECTION_EVENT, {
        detail: { sectionId: 'section-exceptions' },
      }),
    )
    window.requestAnimationFrame(() => {
      document.getElementById('section-exceptions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  if (!summary) return null
  const hasSignal =
    summary.jar_event_total > 0 ||
    summary.timeseries_error_events > 0 ||
    (summary.top_messages?.length ?? 0) > 0 ||
    (summary.top_error_queues?.length ?? 0) > 0
  if (!hasSignal) return null

  const explorerErrorsHref = ROUTES.ANALYSIS_EXPLORER(jobId) + `?q=${encodeURIComponent('status:false')}`

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm',
        className,
      )}
      aria-label="Error operations summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Error operations</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            Source: <span className="font-medium text-[var(--color-text-primary)]">{sourceLabel(summary.source)}</span>
            {' · '}
            <span className="tabular-nums">{summary.unique_messages}</span> distinct patterns
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={explorerErrorsHref}
            className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Explorer: failures
          </Link>
          <button
            type="button"
            onClick={openExceptions}
            className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Error catalog
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-error-light)]/25 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">JAR events</p>
          <p className="text-xl font-bold tabular-nums text-[var(--color-error)]">{summary.jar_event_total.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Timeline buckets</p>
          <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">{summary.timeseries_error_events.toLocaleString()}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">Sum of error_count in chart</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Top error queues</h3>
          {(summary.top_error_queues?.length ?? 0) === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">No per-queue API error breakdown.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {summary.top_error_queues?.slice(0, 6).map((row) => (
                <li key={row.queue} className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-bg-secondary)] px-2 py-1">
                  <span className="min-w-0 truncate font-mono text-[var(--color-text-secondary)]" title={row.queue}>
                    {row.queue}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-[var(--color-error)]">{row.errors}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Top error patterns</h3>
          {(summary.top_messages?.length ?? 0) === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">No grouped messages in summary.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {summary.top_messages?.slice(0, 6).map((row) => {
                const href = row.sample_trace
                  ? analysisExplorerHref(jobId, buildTraceExplorerQuery(row.sample_trace, { errorsOnly: true }))
                  : explorerErrorsHref
                return (
                  <li key={`${row.message}-${row.count}`} className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 break-words text-[var(--color-text-primary)]" title={row.message}>
                        {row.message}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-[var(--color-error)]">{row.count}</span>
                    </div>
                    {row.sample_trace ? (
                      <Link
                        href={href}
                        className="mt-1 inline-block font-mono text-[10px] text-[var(--color-primary)] hover:underline"
                        title="Open sample trace in Log Explorer"
                      >
                        Trace sample →
                      </Link>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
