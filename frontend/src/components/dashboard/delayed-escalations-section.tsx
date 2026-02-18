'use client'

/**
 * DelayedEscalationsSection — T055
 *
 * Renders delayed escalation entries with delay metrics, highlighting
 * severe delays (>60s) with error colors. Shows summary metrics
 * (average delay, max delay, total count).
 */

import { cn } from '@/lib/utils'
import type { DelayedEscalationsResponse } from '@/lib/api-types'

interface DelayedEscalationsSectionProps {
  data: DelayedEscalationsResponse
  className?: string
}

function formatDelay(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`
  return `${ms}ms`
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts || ts === '0001-01-01T00:00:00Z') return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function delaySeverity(ms: number): 'critical' | 'warning' | 'ok' {
  if (ms >= 60_000) return 'critical'
  if (ms >= 10_000) return 'warning'
  return 'ok'
}

export function DelayedEscalationsSection({ data, className }: DelayedEscalationsSectionProps) {
  if (!data || !data.entries || data.entries.length === 0) {
    return (
      <div className={cn('px-5 py-4 text-sm text-[var(--color-text-secondary)]', className)}>
        No delayed escalations found.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)} role="region" aria-label="Delayed escalations">
      {/* Summary metrics */}
      <div className="flex gap-4 px-5 pt-4">
        <div className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-center">
          <div className="text-xs text-[var(--color-text-secondary)]">Total</div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">{data.total}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-center">
          <div className="text-xs text-[var(--color-text-secondary)]">Avg Delay</div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">{formatDelay(Math.round(data.avg_delay_ms))}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-center">
          <div className="text-xs text-[var(--color-text-secondary)]">Max Delay</div>
          <div className="text-lg font-semibold text-[var(--color-error)]">{formatDelay(data.max_delay_ms)}</div>
        </div>
      </div>

      {/* Entries table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Escalation</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Pool</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Scheduled</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Actual</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Delay</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Thread</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry, idx) => {
              const severity = delaySeverity(entry.delay_ms)
              return (
                <tr
                  key={`${entry.trace_id}-${entry.line_number}-${idx}`}
                  className={cn(
                    'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                    severity === 'critical' && 'bg-[var(--color-error-light)]/20',
                    severity === 'warning' && 'bg-[var(--color-warning-light)]/20',
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)] truncate max-w-[200px]" title={entry.esc_name}>
                    {entry.esc_name}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                    {entry.esc_pool || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                    {formatTimestamp(entry.scheduled_time)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                    {formatTimestamp(entry.actual_time)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        severity === 'critical' && 'bg-[var(--color-error-light)] text-[var(--color-error)]',
                        severity === 'warning' && 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
                        severity === 'ok' && 'bg-[var(--color-success-light)] text-[var(--color-success)]',
                      )}
                    >
                      {formatDelay(entry.delay_ms)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-tertiary)]">
                    {entry.thread_id || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
