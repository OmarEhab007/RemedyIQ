'use client'

/**
 * DelayedEscalationsSection — T055
 *
 * Renders delayed escalation entries with delay metrics, highlighting
 * severe delays (>60s) with error colors. Shows summary metrics
 * (average delay, max delay, total count).
 */

import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import type { DelayedEscalationsResponse } from '@/lib/api-types'

const DELAYED_ESCL_RESIZE_SPEC: ResizableColumnConfig[] = [
  { id: 'escalation', defaultWidth: 200, minWidth: 120, maxWidth: 560 },
  { id: 'pool', defaultWidth: 120, minWidth: 72, maxWidth: 320 },
  { id: 'scheduled', defaultWidth: 168, minWidth: 120, maxWidth: 280 },
  { id: 'actual', defaultWidth: 168, minWidth: 120, maxWidth: 280 },
  { id: 'delay', defaultWidth: 88, minWidth: 64, maxWidth: 160 },
  { id: 'thread', defaultWidth: 120, minWidth: 72, maxWidth: 320 },
]

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
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(DELAYED_ESCL_RESIZE_SPEC, {
    storageKey: 'remedyiq:delayed-escalations:v1',
  })

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
        <table className="text-sm" style={tableLayoutStyle} role="table">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th style={thStyle(0)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Escalation</span>
                {renderResizeHandle(0)}
              </th>
              <th style={thStyle(1)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Pool</span>
                {renderResizeHandle(1)}
              </th>
              <th style={thStyle(2)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Scheduled</span>
                {renderResizeHandle(2)}
              </th>
              <th style={thStyle(3)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Actual</span>
                {renderResizeHandle(3)}
              </th>
              <th style={thStyle(4)} className="relative box-border px-4 py-2.5 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Delay</span>
                {renderResizeHandle(4)}
              </th>
              <th style={thStyle(5)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span className="pr-2">Thread</span>
                {renderResizeHandle(5)}
              </th>
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
                  <td style={tdStyle(0)} className="box-border min-w-0 px-4 py-2.5 align-top font-medium text-[var(--color-text-primary)] break-words whitespace-normal" title={entry.esc_name}>
                    {entry.esc_name}
                  </td>
                  <td style={tdStyle(1)} className="box-border min-w-0 px-4 py-2.5 align-top text-[var(--color-text-secondary)] break-words" title={entry.esc_pool ?? undefined}>
                    {entry.esc_pool || '—'}
                  </td>
                  <td style={tdStyle(2)} className="box-border min-w-0 px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                    {formatTimestamp(entry.scheduled_time)}
                  </td>
                  <td style={tdStyle(3)} className="box-border min-w-0 px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                    {formatTimestamp(entry.actual_time)}
                  </td>
                  <td style={tdStyle(4)} className="box-border px-4 py-2.5 align-top text-right whitespace-nowrap">
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
                  <td style={tdStyle(5)} className="box-border min-w-0 px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-tertiary)] break-all">
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
