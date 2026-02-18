'use client'

/**
 * ThreadsSection — T061
 *
 * Renders ThreadStatsResponse: a sortable thread table with request counts,
 * error counts, and duration stats (avg/max/min).
 *
 * Usage:
 *   <ThreadsSection data={threadsData} />
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ThreadStatsResponse, ThreadStatsEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadsSectionProps {
  data: ThreadStatsResponse
  className?: string
}

type SortKey = keyof Pick<
  ThreadStatsEntry,
  'thread_id' | 'total_requests' | 'error_count' | 'avg_duration_ms' | 'max_duration_ms' | 'busy_pct'
>
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

// ---------------------------------------------------------------------------
// ThreadsSection
// ---------------------------------------------------------------------------

export function ThreadsSection({ data, className }: ThreadsSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_requests')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...(data.thread_stats ?? [])].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'thread_id') {
        cmp = a.thread_id.localeCompare(b.thread_id)
      } else if (sortKey === 'busy_pct') {
        cmp = (a.busy_pct ?? -1) - (b.busy_pct ?? -1)
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data.thread_stats, sortKey, sortDir])

  if (!data.thread_stats || data.thread_stats.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
        No thread statistics available for this job.
      </div>
    )
  }

  // Check if any thread has busy_pct data
  const hasBusyPct = (data.thread_stats ?? []).some((t) => t.busy_pct != null)

  const columns: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
    { key: 'thread_id', label: 'Thread ID', align: 'left' },
    { key: 'total_requests', label: 'Requests', align: 'right' },
    { key: 'error_count', label: 'Errors', align: 'right' },
    { key: 'avg_duration_ms', label: 'Avg Duration', align: 'right' },
    { key: 'max_duration_ms', label: 'Max Duration', align: 'right' },
    ...(hasBusyPct ? [{ key: 'busy_pct' as SortKey, label: 'Busy %', align: 'right' as const }] : []),
  ]

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-5 py-3">
        <span className="text-xs text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">{data.total_threads ?? data.thread_stats?.length ?? 0}</span>{' '}
          thread{(data.total_threads ?? data.thread_stats?.length ?? 0) !== 1 ? 's' : ''} active
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Thread statistics">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)]">
              {columns.map(({ key, label, align = 'left' }) => (
                <th
                  key={key}
                  scope="col"
                  className={cn(
                    'border-b border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none',
                    align === 'right' ? 'text-right' : 'text-left'
                  )}
                  onClick={() => handleSort(key)}
                  aria-sort={
                    sortKey === key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortKey === key && (
                      <svg
                        className="h-3 w-3 text-[var(--color-primary)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        {sortDir === 'asc' ? (
                          <path d="M7 14l5-5 5 5" />
                        ) : (
                          <path d="M7 10l5 5 5-5" />
                        )}
                      </svg>
                    )}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="border-b border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
              >
                Queue
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((thread) => (
              <tr
                key={thread.thread_id}
                className={cn(
                  'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                  thread.error_count > 0 && 'bg-[var(--color-error-light)]/10'
                )}
              >
                <td className="px-4 py-2 font-mono font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                  {thread.thread_id}
                </td>
                <td className="px-4 py-2 text-right font-mono text-[var(--color-text-secondary)]">
                  {thread.total_requests.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  <span
                    className={
                      thread.error_count > 0
                        ? 'font-semibold text-[var(--color-error)]'
                        : 'text-[var(--color-text-secondary)]'
                    }
                  >
                    {thread.error_count.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-[var(--color-text-secondary)]">
                  {formatDuration(thread.avg_duration_ms)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  <span
                    className={
                      thread.max_duration_ms > 5000
                        ? 'font-semibold text-[var(--color-error)]'
                        : thread.max_duration_ms > 1000
                          ? 'text-[var(--color-warning)]'
                          : 'text-[var(--color-text-secondary)]'
                    }
                  >
                    {formatDuration(thread.max_duration_ms)}
                  </span>
                </td>
                {hasBusyPct && (
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {thread.busy_pct != null ? (
                      <div className="flex items-center justify-end gap-2" aria-label={`Busy: ${thread.busy_pct.toFixed(1)}%`}>
                        <div className="w-16 h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(thread.busy_pct, 100)}%`,
                              backgroundColor:
                                thread.busy_pct > 80
                                  ? 'var(--color-error)'
                                  : thread.busy_pct >= 50
                                    ? 'var(--color-warning)'
                                    : 'var(--color-success)',
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            'font-mono text-[11px] tabular-nums w-10 text-right',
                            thread.busy_pct > 80
                              ? 'text-[var(--color-error)] font-semibold'
                              : thread.busy_pct >= 50
                                ? 'text-[var(--color-warning)]'
                                : 'text-[var(--color-text-secondary)]'
                          )}
                        >
                          {thread.busy_pct.toFixed(1)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2 text-right font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
                  {thread.queue || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
