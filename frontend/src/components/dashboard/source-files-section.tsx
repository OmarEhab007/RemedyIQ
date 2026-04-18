'use client'

/**
 * SourceFilesSection — T044
 *
 * Renders per-file metadata showing file ordinals, names, time ranges,
 * and durations. Helps admins see time coverage per uploaded log file.
 */

import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import type { FileMetadataEntry } from '@/lib/api-types'

const SOURCE_FILES_RESIZE_SPEC: ResizableColumnConfig[] = [
  { id: 'ordinal', defaultWidth: 48, minWidth: 36, maxWidth: 80 },
  { id: 'file_name', defaultWidth: 220, minWidth: 120, maxWidth: 720 },
  { id: 'start_time', defaultWidth: 168, minWidth: 120, maxWidth: 280 },
  { id: 'end_time', defaultWidth: 168, minWidth: 120, maxWidth: 280 },
  { id: 'duration', defaultWidth: 100, minWidth: 72, maxWidth: 200 },
]

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
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(SOURCE_FILES_RESIZE_SPEC, {
    storageKey: 'remedyiq:source-files:v1',
  })

  if (!data || data.length === 0) {
    return (
      <div className={cn('px-5 py-4 text-sm text-[var(--color-text-secondary)]', className)}>
        No source file metadata available.
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)} role="region" aria-label="Source files">
      <table className="text-sm" style={tableLayoutStyle} role="table">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th style={thStyle(0)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">#</span>
              {renderResizeHandle(0)}
            </th>
            <th style={thStyle(1)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">File Name</span>
              {renderResizeHandle(1)}
            </th>
            <th style={thStyle(2)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">Start Time</span>
              {renderResizeHandle(2)}
            </th>
            <th style={thStyle(3)} className="relative box-border px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">End Time</span>
              {renderResizeHandle(3)}
            </th>
            <th style={thStyle(4)} className="relative box-border px-4 py-2.5 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <span className="pr-2">Duration</span>
              {renderResizeHandle(4)}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((file) => (
            <tr
              key={file.file_number || file.file_name}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td style={tdStyle(0)} className="box-border px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-tertiary)]">
                {file.file_number}
              </td>
              <td style={tdStyle(1)} className="box-border min-w-0 px-4 py-2.5 align-top font-medium text-[var(--color-text-primary)] break-words whitespace-normal" title={file.file_name}>
                {file.file_name}
              </td>
              <td style={tdStyle(2)} className="box-border px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                {formatTimestamp(file.start_time)}
              </td>
              <td style={tdStyle(3)} className="box-border px-4 py-2.5 align-top font-mono text-xs text-[var(--color-text-secondary)] break-words">
                {formatTimestamp(file.end_time)}
              </td>
              <td style={tdStyle(4)} className="box-border px-4 py-2.5 align-top text-right font-mono text-xs text-[var(--color-text-primary)]">
                {formatDuration(file.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
