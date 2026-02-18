'use client'

/**
 * LogTable — Virtualized log entry table using react-window FixedSizeList.
 *
 * Row height: 44px
 * Columns: timestamp (monospace), log type (color badge), identifier (mono, truncated),
 *          user, duration, status icon
 * Click row → selectEntry callback
 * Keyboard: Arrow up/down to navigate, Enter to select
 *
 * Usage:
 *   <LogTable
 *     entries={searchResults.entries}
 *     selectedEntryId={selectedEntryId}
 *     onSelectEntry={selectEntry}
 *     isLoading={isLoading}
 *     total={searchResults.total}
 *   />
 */

import { useCallback, useState, useEffect, useRef, type CSSProperties } from 'react'
import type { LogEntry, LogType } from '@/lib/api-types'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PageState } from '@/components/ui/page-state'

// ---------------------------------------------------------------------------
// react-window — use require() to avoid named-import TS issues with this
// CommonJS package under bundler moduleResolution
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-require-imports */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { FixedSizeList: List } = require('react-window') as {
  FixedSizeList: React.ComponentType<FixedSizeListProps>
}
/* eslint-enable @typescript-eslint/no-require-imports */

interface FixedSizeListProps {
  height: number
  width: number
  itemCount: number
  itemSize: number
  itemData: RowData
  overscanCount?: number
  children: React.ComponentType<RowChildProps>
}

interface RowChildProps {
  index: number
  style: CSSProperties
  data: RowData
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 44

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogTableProps {
  entries: LogEntry[]
  selectedEntryId: string | null
  onSelectEntry: (entryId: string | null) => void
  isLoading?: boolean
  total?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Helper: format timestamp to compact display
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23)
  } catch {
    return ts
  }
}

// ---------------------------------------------------------------------------
// Helper: format duration
// ---------------------------------------------------------------------------

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

// ---------------------------------------------------------------------------
// Helper: get identifier from log entry
// ---------------------------------------------------------------------------

function getIdentifier(entry: LogEntry): string {
  return (
    entry.form ??
    entry.filter_name ??
    entry.sql_table ??
    entry.esc_name ??
    entry.rpc_id ??
    entry.trace_id ??
    '—'
  )
}

// ---------------------------------------------------------------------------
// LogTypeBadge
// ---------------------------------------------------------------------------

function LogTypeBadge({ logType }: { logType: LogType }) {
  const config = LOG_TYPE_COLORS[logType]
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: config.bg, color: config.text }}
      aria-label={`Log type: ${config.label}`}
    >
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StatusIcon
// ---------------------------------------------------------------------------

function StatusIcon({ success }: { success: boolean | null }) {
  if (success === null) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--color-text-tertiary)]"
        aria-label="Status unknown"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  if (success) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--color-success)]"
        aria-label="Success"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-error)]"
      aria-label="Error"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// TableHeader — static column headers
// ---------------------------------------------------------------------------

function TableHeader() {
  return (
    <div
      role="row"
      aria-rowindex={1}
      className="flex h-9 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]"
    >
      <span className="w-[172px] shrink-0">Timestamp</span>
      <span className="w-16 shrink-0">Type</span>
      <span className="min-w-0 flex-1">Identifier</span>
      <span className="w-28 shrink-0 truncate">User</span>
      <span className="w-20 shrink-0 text-right">Duration</span>
      <span className="w-8 shrink-0 text-center">St.</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RowData — data passed to each virtualised row
// ---------------------------------------------------------------------------

interface RowData {
  entries: LogEntry[]
  selectedEntryId: string | null
  onSelectEntry: (id: string) => void
}

// ---------------------------------------------------------------------------
// LogRow — single virtualised row
// ---------------------------------------------------------------------------

function LogRow({ index, style, data }: RowChildProps) {
  const { entries, selectedEntryId, onSelectEntry } = data
  const entry = entries[index]
  if (!entry) return null

  const isSelected = entry.entry_id === selectedEntryId
  const identifier = getIdentifier(entry)

  return (
    <div
      style={style}
      role="row"
      aria-rowindex={index + 2} // +2 because header is row 1
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => onSelectEntry(entry.entry_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectEntry(entry.entry_id)
        }
      }}
      className={cn(
        'flex cursor-pointer items-center border-b border-[var(--color-border-light)] px-3 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
        isSelected
          ? 'bg-[var(--color-primary-light)]'
          : 'hover:bg-[var(--color-bg-secondary)]',
        entry.success === false && !isSelected && 'bg-[var(--color-error-light)]/40',
      )}
    >
      {/* Timestamp */}
      <span
        className="w-[172px] shrink-0 font-mono text-xs text-[var(--color-text-secondary)]"
        aria-label={`Timestamp: ${entry.timestamp}`}
      >
        {formatTimestamp(entry.timestamp)}
      </span>

      {/* Log type badge */}
      <span className="w-16 shrink-0">
        <LogTypeBadge logType={entry.log_type} />
      </span>

      {/* Identifier */}
      <span
        className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--color-text-primary)]"
        title={identifier}
        aria-label={`Identifier: ${identifier}`}
      >
        {identifier}
      </span>

      {/* User */}
      <span
        className="w-28 shrink-0 truncate text-xs text-[var(--color-text-secondary)]"
        title={entry.user}
        aria-label={`User: ${entry.user}`}
      >
        {entry.user || '—'}
      </span>

      {/* Duration */}
      <span
        className={cn(
          'w-20 shrink-0 text-right font-mono text-xs',
          entry.duration_ms !== null && entry.duration_ms >= 5000
            ? 'text-[var(--color-error)]'
            : entry.duration_ms !== null && entry.duration_ms >= 1000
              ? 'text-[var(--color-warning)]'
              : 'text-[var(--color-text-secondary)]',
        )}
        aria-label={`Duration: ${formatDuration(entry.duration_ms)}`}
      >
        {formatDuration(entry.duration_ms)}
      </span>

      {/* Status */}
      <span
        className="flex w-8 shrink-0 items-center justify-center"
        aria-label={`Status: ${entry.success === null ? 'unknown' : entry.success ? 'success' : 'error'}`}
      >
        <StatusIcon success={entry.success} />
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AutoSizerWrapper — fills parent div with dynamic height/width
//
// Implements a simple ResizeObserver-based auto-sizer so we don't need
// the react-virtualized-auto-sizer package.
// ---------------------------------------------------------------------------

interface AutoSizerChildProps {
  height: number
  width: number
}

interface AutoSizerWrapperProps {
  children: (props: AutoSizerChildProps) => React.ReactNode
}

function AutoSizerWrapper({ children }: AutoSizerWrapperProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<AutoSizerChildProps>({ height: 0, width: 0 })

  useEffect(() => {
    const el = divRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setSize({ height: rect.height, width: rect.width })
      }
    })

    observer.observe(el)
    setSize({ height: el.clientHeight, width: el.clientWidth })

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={divRef} className="h-full w-full">
      {size.height > 0 && size.width > 0 && children(size)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LogTable component
// ---------------------------------------------------------------------------

export function LogTable({
  entries,
  selectedEntryId,
  onSelectEntry,
  isLoading,
  total,
  className,
}: LogTableProps) {
  const handleSelect = useCallback(
    (entryId: string) => {
      onSelectEntry(entryId === selectedEntryId ? null : entryId)
    },
    [onSelectEntry, selectedEntryId],
  )

  // Build item data (stable reference avoids re-renders)
  const itemData: RowData = {
    entries,
    selectedEntryId,
    onSelectEntry: handleSelect,
  }

  if (isLoading) {
    return (
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]', className)}>
        <TableHeader />
        <PageState variant="loading" rows={8} />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]', className)}>
        <TableHeader />
        <PageState
          variant="empty"
          title="No log entries found"
          description="Try adjusting your search query or filters."
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]',
        className,
      )}
    >
      {/* Column header */}
      <TableHeader />

      {/* Footer count */}
      {total !== undefined && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-[11px] text-[var(--color-text-tertiary)]">
          Showing {entries.length.toLocaleString()} of {total.toLocaleString()} entries
        </div>
      )}

      {/* Virtualized list — fills remaining height */}
      <div
        className="flex-1"
        role="grid"
        aria-label="Log entries"
        aria-rowcount={entries.length + 1}
        aria-colcount={6}
      >
        <AutoSizerWrapper>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={entries.length}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              overscanCount={5}
            >
              {LogRow}
            </List>
          )}
        </AutoSizerWrapper>
      </div>
    </div>
  )
}
