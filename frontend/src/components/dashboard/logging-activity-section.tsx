'use client'

/**
 * LoggingActivitySection — T036
 *
 * Renders logging activity per log type showing first/last timestamp and duration.
 * Helps admins verify that all expected log types were captured.
 */

import { cn } from '@/lib/utils'
import type { LoggingActivityEntry } from '@/lib/api-types'

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
  if (!data || data.length === 0) {
    return (
      <div className={cn('px-5 py-4 text-sm text-[var(--color-text-secondary)]', className)}>
        No logging activity data available.
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)} role="region" aria-label="Logging activity by type">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">First Entry</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Last Entry</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.log_type}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">
                {LOG_TYPE_LABELS[entry.log_type] ?? entry.log_type}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                {formatTimestamp(entry.first_timestamp)}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                {formatTimestamp(entry.last_timestamp)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--color-text-primary)]">
                {formatDuration(entry.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
