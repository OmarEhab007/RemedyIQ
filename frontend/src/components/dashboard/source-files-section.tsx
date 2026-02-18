'use client'

/**
 * SourceFilesSection — T044
 *
 * Renders per-file metadata showing file ordinals, names, time ranges,
 * and durations. Helps admins see time coverage per uploaded log file.
 */

import { cn } from '@/lib/utils'
import type { FileMetadataEntry } from '@/lib/api-types'

interface SourceFilesSectionProps {
  data: FileMetadataEntry[]
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

export function SourceFilesSection({ data, className }: SourceFilesSectionProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn('px-5 py-4 text-sm text-[var(--color-text-secondary)]', className)}>
        No source file metadata available.
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)} role="region" aria-label="Source files">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-12">#</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">File Name</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Start Time</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">End Time</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {data.map((file) => (
            <tr
              key={file.file_number || file.file_name}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-tertiary)]">
                {file.file_number}
              </td>
              <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)] truncate max-w-[300px]" title={file.file_name}>
                {file.file_name}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                {formatTimestamp(file.start_time)}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                {formatTimestamp(file.end_time)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--color-text-primary)]">
                {formatDuration(file.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
