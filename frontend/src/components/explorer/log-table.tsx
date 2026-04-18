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

import { useCallback, useState, useEffect, useRef, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import type { LogEntry, LogType, SearchLogsSortField } from '@/lib/api-types'
import { LOG_TYPE_COLORS, AR_API_CODES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PageState } from '@/components/ui/page-state'
import { ApiCodeBadge } from '@/components/shared/api-code-badge'

// ---------------------------------------------------------------------------
// react-window — use require() to avoid named-import TS issues with this
// CommonJS package under bundler moduleResolution
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-require-imports */
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

const LOG_TABLE_RESIZE_SPEC: ResizableColumnConfig[] = [
  { id: 'timestamp', defaultWidth: 172, minWidth: 128, maxWidth: 280 },
  { id: 'type', defaultWidth: 64, minWidth: 52, maxWidth: 100 },
  { id: 'identifier', defaultWidth: 360, minWidth: 160, maxWidth: 900 },
  { id: 'user', defaultWidth: 112, minWidth: 72, maxWidth: 240 },
  { id: 'duration', defaultWidth: 80, minWidth: 64, maxWidth: 140 },
  { id: 'status', defaultWidth: 44, minWidth: 36, maxWidth: 72 },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogTableProps {
  entries: LogEntry[]
  selectedEntryId: string | null
  onSelectEntry: (entryId: string | null) => void
  isLoading?: boolean
  total?: number
  hasMore?: boolean
  onLoadMore?: () => void
  isFetchingMore?: boolean
  sortBy?: SearchLogsSortField
  sortOrder?: 'asc' | 'desc'
  onSortColumn?: (field: SearchLogsSortField) => void
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
// TableHeader — resizable column headers (CSS grid, matches LogRow)
// ---------------------------------------------------------------------------

const TABLE_COLUMNS: Array<{
  id: string
  label: string
  sortField?: SearchLogsSortField
  headerClass?: string
}> = [
  { id: 'timestamp', label: 'Timestamp', sortField: 'timestamp' },
  { id: 'type', label: 'Type', sortField: 'log_type' },
  { id: 'identifier', label: 'Identifier' },
  { id: 'user', label: 'User', sortField: 'user' },
  { id: 'duration', label: 'Duration', sortField: 'duration_ms', headerClass: 'justify-end text-right' },
  { id: 'status', label: 'St.', headerClass: 'justify-center text-center' },
]

function TableHeader({
  gridTemplateColumns,
  totalWidth,
  renderResizeHandle,
  sortBy,
  sortOrder,
  onSortColumn,
}: {
  gridTemplateColumns: string
  totalWidth: number
  renderResizeHandle: (colIndex: number) => ReactNode
  sortBy?: SearchLogsSortField
  sortOrder?: 'asc' | 'desc'
  onSortColumn?: (field: SearchLogsSortField) => void
}) {
  return (
    <div
      role="row"
      aria-rowindex={1}
      className="grid shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]"
      style={{
        gridTemplateColumns,
        minWidth: totalWidth,
        width: '100%',
      }}
    >
      {TABLE_COLUMNS.map((col, i) => {
        const sortable = Boolean(col.sortField && onSortColumn)
        return (
          <div
            key={col.id}
            className={cn('relative flex min-w-0 items-center', col.headerClass)}
          >
            {sortable && col.sortField ? (
              <button
                type="button"
                onClick={() => {
                  const field = col.sortField
                  if (field) onSortColumn?.(field)
                }}
                className={cn(
                  'flex min-w-0 items-center gap-0.5 truncate pr-2 text-left font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]',
                  'hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 rounded-sm',
                  col.headerClass?.includes('justify-end') && 'w-full justify-end pr-3',
                  col.headerClass?.includes('justify-center') && 'w-full justify-center pr-3',
                )}
                title={
                  sortBy === col.sortField
                    ? `Sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'} — click to toggle`
                    : 'Click to sort'
                }
              >
                <span className="truncate">{col.label}</span>
                {sortBy === col.sortField && (
                  <span className="shrink-0 font-mono text-[10px]" aria-hidden="true">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ) : (
              <span
                className={cn(
                  'truncate pr-2',
                  (col.id === 'duration' || col.id === 'status') && 'pr-3',
                  col.headerClass?.includes('justify-end') && 'w-full text-right pr-3',
                  col.headerClass?.includes('justify-center') && 'w-full text-center pr-3',
                )}
              >
                {col.label}
              </span>
            )}
            {renderResizeHandle(i)}
          </div>
        )
      })}
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
  gridTemplateColumns: string
}

// ---------------------------------------------------------------------------
// LogRow — single virtualised row
// ---------------------------------------------------------------------------

function LogRow({ index, style, data }: RowChildProps) {
  const { entries, selectedEntryId, onSelectEntry, gridTemplateColumns } = data
  const entry = entries[index]
  if (!entry) return null

  const isSelected = entry.entry_id === selectedEntryId
  const identifier = getIdentifier(entry)

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns,
        columnGap: '12px',
        alignItems: 'center',
        boxSizing: 'border-box',
        paddingLeft: 12,
        paddingRight: 12,
      }}
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
        'cursor-pointer border-b border-[var(--color-border-light)] text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
        isSelected
          ? 'bg-[var(--color-primary-light)]'
          : 'hover:bg-[var(--color-bg-secondary)]',
        entry.success === false && !isSelected && 'bg-[var(--color-error-light)]/40',
      )}
    >
      {/* Timestamp */}
      <span
        className="min-w-0 font-mono text-xs text-[var(--color-text-secondary)]"
        aria-label={`Timestamp: ${entry.timestamp}`}
      >
        {formatTimestamp(entry.timestamp)}
      </span>

      {/* Log type badge */}
      <span className="min-w-0">
        <LogTypeBadge logType={entry.log_type} />
      </span>

      {/* Identifier */}
      <span
        className="min-w-0 truncate font-mono text-xs text-[var(--color-text-primary)]"
        title={identifier}
        aria-label={`Identifier: ${identifier}`}
      >
        {entry.log_type === 'API' && identifier && AR_API_CODES[identifier] ? (
          <ApiCodeBadge code={identifier} />
        ) : (
          identifier
        )}
      </span>

      {/* User */}
      <span
        className="min-w-0 truncate text-xs text-[var(--color-text-secondary)]"
        title={entry.user}
        aria-label={`User: ${entry.user}`}
      >
        {entry.user || '—'}
      </span>

      {/* Duration */}
      <span
        className={cn(
          'min-w-0 text-right font-mono text-xs',
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
        className="flex min-w-0 items-center justify-center"
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
  hasMore,
  onLoadMore,
  isFetchingMore,
  sortBy,
  sortOrder,
  onSortColumn,
  className,
}: LogTableProps) {
  const { columnWidths, totalWidth, renderResizeHandle } = useResizableTableColumns(LOG_TABLE_RESIZE_SPEC, {
    storageKey: 'remedyiq:explorer:log-table:v1',
  })

  const gridTemplateColumns = useMemo(
    () => columnWidths.map((w) => `${w}px`).join(' '),
    [columnWidths],
  )

  const handleSelect = useCallback(
    (entryId: string) => {
      onSelectEntry(entryId === selectedEntryId ? null : entryId)
    },
    [onSelectEntry, selectedEntryId],
  )

  const itemData: RowData = useMemo(
    () => ({
      entries,
      selectedEntryId,
      onSelectEntry: handleSelect,
      gridTemplateColumns,
    }),
    [entries, selectedEntryId, handleSelect, gridTemplateColumns],
  )

  if (isLoading) {
    return (
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]', className)}>
        <TableHeader
          gridTemplateColumns={gridTemplateColumns}
          totalWidth={totalWidth}
          renderResizeHandle={renderResizeHandle}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortColumn={onSortColumn}
        />
        <PageState variant="loading" rows={8} />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={cn('flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]', className)}>
        <TableHeader
          gridTemplateColumns={gridTemplateColumns}
          totalWidth={totalWidth}
          renderResizeHandle={renderResizeHandle}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortColumn={onSortColumn}
        />
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
      <div
        className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden"
        role="grid"
        aria-label="Log entries"
        aria-rowcount={entries.length + 1}
        aria-colcount={6}
      >
        <div style={{ minWidth: totalWidth }} className="flex h-full min-h-0 w-full flex-col">
          <TableHeader
            gridTemplateColumns={gridTemplateColumns}
            totalWidth={totalWidth}
            renderResizeHandle={renderResizeHandle}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortColumn={onSortColumn}
          />

          {total !== undefined && (
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-[11px] text-[var(--color-text-tertiary)]">
              <span>Showing {entries.length.toLocaleString()} of {total.toLocaleString()} entries</span>
              {hasMore && onLoadMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isFetchingMore}
                  className="rounded bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingMore ? 'Loading…' : 'Load next page'}
                </button>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1">
            <AutoSizerWrapper>
              {({ height, width }) => {
                const listWidth = Math.max(width, totalWidth)
                return (
                  <List
                    height={height}
                    width={listWidth}
                    itemCount={entries.length}
                    itemSize={ROW_HEIGHT}
                    itemData={itemData}
                    overscanCount={5}
                  >
                    {LogRow}
                  </List>
                )
              }}
            </AutoSizerWrapper>
          </div>
        </div>
      </div>
    </div>
  )
}
