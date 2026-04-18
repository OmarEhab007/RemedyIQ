'use client'

/**
 * LoggingActivitySection — T036
 *
 * Renders logging activity per log type showing first/last timestamp and duration.
 * Helps admins verify that all expected log types were captured.
 */

import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import type { LoggingActivityEntry } from '@/lib/api-types'

const LOGGING_ACTIVITY_RESIZE_SPEC: ResizableColumnConfig[] = [
  { id: 'type', defaultWidth: 140, minWidth: 96, maxWidth: 280 },
  { id: 'first', defaultWidth: 180, minWidth: 120, maxWidth: 320 },
  { id: 'last', defaultWidth: 180, minWidth: 120, maxWidth: 320 },
  { id: 'duration', defaultWidth: 100, minWidth: 72, maxWidth: 200 },
]

interface LoggingActivitySectionProps {
  data: LoggingActivityEntry[]
  className?: string
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1_000)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

function formatTimestamp(ts: string): string {
  if (!ts || ts === '0001-01-01T00:00:00Z') return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

const LOG_TYPE_LABELS: Record<string, string> = {
  'API': 'API Calls',
  'SQL': 'SQL Operations',
  'FLTR': 'Filter Executions',
  'ESCL': 'Escalations',
}

export function LoggingActivitySection({ data, className }: LoggingActivitySectionProps) {
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(LOGGING_ACTIVITY_RESIZE_SPEC, {
    storageKey: 'remedyiq:logging-activity:v1',
  })

  if (!data || data.length === 0) {
    return (
      <div className={cn('px-5 py-4 text-sm text-[var(--color-text-secondary)]', className)}>
        No logging activity data available.
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)} role="region" aria-label="Logging activity by type">
      <table className="text-sm" style={tableLayoutStyle} role="table">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th style={thStyle(0)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">Type</span>
              {renderResizeHandle(0)}
            </th>
            <th style={thStyle(1)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">First Entry</span>
              {renderResizeHandle(1)}
            </th>
            <th style={thStyle(2)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">Last Entry</span>
              {renderResizeHandle(2)}
            </th>
            <th style={thStyle(3)} className="relative box-border px-4 py-2.5 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">Duration</span>
              {renderResizeHandle(3)}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.log_type}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td style={tdStyle(0)} className="box-border min-w-0 px-4 py-2.5 align-top font-medium text-[var(--color-text-primary)] break-words">
                {LOG_TYPE_LABELS[entry.log_type] ?? entry.log_type}
              </td>
              <td style={tdStyle(1)} className="box-border min-w-0 px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                {formatTimestamp(entry.first_timestamp)}
              </td>
              <td style={tdStyle(2)} className="box-border min-w-0 px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                {formatTimestamp(entry.last_timestamp)}
              </td>
              <td style={tdStyle(3)} className="box-border px-4 py-2.5 align-top text-right font-mono text-xs text-[var(--color-text-primary)]">
                {formatDuration(entry.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
