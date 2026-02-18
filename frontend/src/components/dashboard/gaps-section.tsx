'use client'

/**
 * GapsSection — T060
 *
 * Renders GapsResponse: a gap list with duration, line numbers, and a
 * queue health summary table.
 *
 * Usage:
 *   <GapsSection data={gapsData} />
 */

import { cn } from '@/lib/utils'
import type { GapsResponse, GapEntry, QueueHealthSummary } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GapsSectionProps {
  data: GapsResponse
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

// ---------------------------------------------------------------------------
// GapRow
// ---------------------------------------------------------------------------

function GapRow({ gap, index }: { gap: GapEntry; index: number }) {
  const severity = gap.duration_ms > 30_000 ? 'critical' : gap.duration_ms > 5_000 ? 'warning' : 'ok'

  return (
    <tr className={cn(
      'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
      severity === 'critical' && 'bg-[var(--color-error-light)]/20',
      severity === 'warning' && 'bg-[var(--color-warning-light)]/20',
    )}>
      <td className="px-4 py-2 font-mono text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">
        #{index + 1}
      </td>
      <td className="px-4 py-2 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
            severity === 'critical' && 'bg-[var(--color-error-light)] text-[var(--color-error)]',
            severity === 'warning' && 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
            severity === 'ok' && 'bg-[var(--color-success-light)] text-[var(--color-success)]',
          )}
        >
          {formatDuration(gap.duration_ms)}
        </span>
      </td>
      <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {new Date(gap.start_time).toLocaleTimeString()}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {new Date(gap.end_time).toLocaleTimeString()}
      </td>
      <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
        L{gap.before_line} → L{gap.after_line}
      </td>
      <td className="max-w-0 px-4 py-2 text-xs text-[var(--color-text-secondary)]">
        <span className="block truncate" title={gap.description}>
          {gap.description || '—'}
        </span>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// QueueHealthTable
// ---------------------------------------------------------------------------

function QueueHealthTable({ health }: { health: QueueHealthSummary[] }) {
  if (health.length === 0) return null

  return (
    <div className="border-t border-[var(--color-border)]">
      <div className="px-5 py-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Queue Health Summary
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Queue health summary">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)]">
              {['Queue', 'Requests', 'Errors', 'Avg Duration', 'Max Duration', 'Gaps'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {health.map((q) => (
              <tr
                key={q.queue}
                className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="px-4 py-2 font-mono font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                  {q.queue}
                </td>
                <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                  {q.total_requests.toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono whitespace-nowrap">
                  <span className={q.error_count > 0 ? 'text-[var(--color-error)] font-semibold' : 'text-[var(--color-text-secondary)]'}>
                    {q.error_count.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                  {formatDuration(q.avg_duration_ms)}
                </td>
                <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                  {formatDuration(q.max_duration_ms)}
                </td>
                <td className="px-4 py-2 font-mono whitespace-nowrap">
                  <span className={q.gap_count > 0 ? 'text-[var(--color-warning)] font-semibold' : 'text-[var(--color-text-secondary)]'}>
                    {q.gap_count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GapsSection
// ---------------------------------------------------------------------------

export function GapsSection({ data, className }: GapsSectionProps) {
  if ((!data.gaps || data.gaps.length === 0) && (!data.queue_health || data.queue_health.length === 0)) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[var(--color-success)]">
        No timing gaps detected — log coverage is continuous.
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-warning-light)]/40 px-5 py-3">
        <svg
          className="h-4 w-4 shrink-0 text-[var(--color-warning)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-xs font-semibold text-[var(--color-warning)]">
          {data.total_gaps ?? data.gaps?.length ?? 0} timing gap{(data.total_gaps ?? data.gaps?.length ?? 0) !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* Gap list */}
      {data.gaps && data.gaps.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Timing gaps">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]">
                {['#', 'Duration', 'Start', 'End', 'Lines', 'Description'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.gaps.map((gap, idx) => (
                <GapRow key={idx} gap={gap} index={idx} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Queue health */}
      <QueueHealthTable health={data.queue_health ?? []} />
    </div>
  )
}
