'use client'

/**
 * TopNTable — Rebuilt
 *
 * Type-specific sortable table for top API/SQL/Filter/Escalation entries.
 * Features:
 *   - Per-type column layouts (only shows relevant fields)
 *   - Duration bar visualization (proportional + color-coded)
 *   - Click-to-expand inline detail panel
 *   - Parsed `details` JSON for type-specific metadata
 *   - `maxRows` — limits visible rows with "Show all N" expansion
 *   - `compact` — removes Card wrapper for embedding
 */

import React, { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS, AR_API_CODES } from '@/lib/constants'
import type { TopNEntry, LogType } from '@/lib/api-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopNTableProps {
  entries: TopNEntry[]
  title: string
  logType: LogType
  className?: string
  /** Maximum rows to show before "Show all" button. 0 = unlimited. */
  maxRows?: number
  /** If true, renders without Card wrapper (for embedding). */
  compact?: boolean
}

type SortKey = string
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Column configuration per log type
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string
  label: string
  align: 'left' | 'right' | 'center'
  width?: string
  sortable: boolean
  /** How to extract the value from a TopNEntry */
  getValue: (entry: TopNEntry, parsed: ParsedDetails) => string | number | null
  /** How to render the cell */
  render: (entry: TopNEntry, parsed: ParsedDetails, maxDuration: number) => React.ReactNode
}

interface ParsedDetails {
  sql_statement?: string
  sql_table?: string
  filter_name?: string
  filter_level?: number
  esc_name?: string
  esc_pool?: string
  delay_ms?: number
  error_encountered?: boolean
  thread_id?: string
  raw_text?: string
}

function parseDetails(details: string | undefined | null): ParsedDetails {
  if (!details) return {}
  try {
    return JSON.parse(details) as ParsedDetails
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Duration bar + formatting
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

function formatTimestamp(ts: string): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function durationColor(ms: number): string {
  if (ms >= 5000) return 'var(--color-error)'
  if (ms >= 1000) return 'var(--color-warning)'
  if (ms >= 200) return 'var(--color-primary)'
  return 'var(--color-success)'
}

function DurationCell({ ms, maxMs }: { ms: number; maxMs: number }) {
  const pct = maxMs > 0 ? Math.min((ms / maxMs) * 100, 100) : 0
  const color = durationColor(ms)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden min-w-[40px]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-mono text-[11px] tabular-nums whitespace-nowrap shrink-0"
        style={{ color }}
      >
        {formatDuration(ms)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status cell
// ---------------------------------------------------------------------------

function StatusCell({ success }: { success: boolean }) {
  return success ? (
    <span
      className="inline-flex h-5 items-center rounded px-1.5 bg-[var(--color-success-light)] text-[var(--color-success)] text-[10px] font-semibold"
      aria-label="Success"
    >
      OK
    </span>
  ) : (
    <span
      className="inline-flex h-5 items-center rounded px-1.5 bg-[var(--color-error-light)] text-[var(--color-error)] text-[10px] font-semibold"
      aria-label="Error"
    >
      ERR
    </span>
  )
}

// ---------------------------------------------------------------------------
// Column definitions by log type
// ---------------------------------------------------------------------------

const RANK_COL: ColumnDef = {
  key: 'rank',
  label: '#',
  align: 'right',
  width: 'w-10',
  sortable: true,
  getValue: (e) => e.rank,
  render: (e) => (
    <span className="font-mono text-[var(--color-text-tertiary)]">{e.rank}</span>
  ),
}

const IDENTIFIER_COL = (label: string): ColumnDef => ({
  key: 'identifier',
  label,
  align: 'left',
  sortable: true,
  getValue: (e) => e.identifier,
  render: (e) => (
    <span className="block truncate font-mono text-[var(--color-text-primary)]" title={e.identifier}>
      {e.identifier || '—'}
    </span>
  ),
})

const FORM_COL: ColumnDef = {
  key: 'form',
  label: 'Form',
  align: 'left',
  width: 'max-w-[10rem]',
  sortable: true,
  getValue: (e) => e.form ?? '',
  render: (e) => (
    <span className="block truncate text-[var(--color-text-secondary)]" title={e.form ?? ''}>
      {e.form || '—'}
    </span>
  ),
}

const QUEUE_COL: ColumnDef = {
  key: 'queue',
  label: 'Queue',
  align: 'left',
  width: 'max-w-[8rem]',
  sortable: true,
  getValue: (e) => e.queue,
  render: (e) => (
    <span className="block truncate font-mono text-xs text-[var(--color-text-secondary)]" title={e.queue}>
      {e.queue || '—'}
    </span>
  ),
}

const DURATION_COL: ColumnDef = {
  key: 'duration_ms',
  label: 'Duration',
  align: 'right',
  width: 'w-40',
  sortable: true,
  getValue: (e) => e.duration_ms,
  render: (e, _p, maxDur) => <DurationCell ms={e.duration_ms} maxMs={maxDur} />,
}

const TIMESTAMP_COL: ColumnDef = {
  key: 'timestamp',
  label: 'Time',
  align: 'left',
  width: 'w-24',
  sortable: true,
  getValue: (e) => e.timestamp,
  render: (e) => (
    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] whitespace-nowrap">
      {formatTimestamp(e.timestamp)}
    </span>
  ),
}

const USER_COL: ColumnDef = {
  key: 'user',
  label: 'User',
  align: 'left',
  width: 'max-w-[7rem]',
  sortable: true,
  getValue: (e) => e.user,
  render: (e) => (
    <span className="block truncate text-[var(--color-text-secondary)]" title={e.user}>
      {e.user || '—'}
    </span>
  ),
}

const STATUS_COL: ColumnDef = {
  key: 'success',
  label: 'Status',
  align: 'center',
  width: 'w-16',
  sortable: true,
  getValue: (e) => (e.success ? 1 : 0),
  render: (e) => <StatusCell success={e.success} />,
}

const QUEUE_TIME_COL: ColumnDef = {
  key: 'queue_time_ms',
  label: 'Q-Time',
  align: 'right',
  width: 'w-20',
  sortable: true,
  getValue: (e) => e.queue_time_ms ?? 0,
  render: (e) => {
    const qms = e.queue_time_ms ?? 0
    return (
      <span className={cn(
        'font-mono text-[11px] tabular-nums',
        qms > 1000 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-tertiary)]'
      )}>
        {qms > 0 ? formatDuration(qms) : '—'}
      </span>
    )
  },
}

// Escalation-specific columns
const ESC_POOL_COL: ColumnDef = {
  key: 'esc_pool',
  label: 'Pool',
  align: 'left',
  width: 'max-w-[8rem]',
  sortable: false,
  getValue: (_e, p) => p.esc_pool ?? '',
  render: (_e, p) => (
    <span className="block truncate font-mono text-xs text-[var(--color-text-secondary)]" title={p.esc_pool ?? ''}>
      {p.esc_pool || '—'}
    </span>
  ),
}

const ESC_DELAY_COL: ColumnDef = {
  key: 'delay_ms',
  label: 'Delay',
  align: 'right',
  width: 'w-20',
  sortable: false,
  getValue: (_e, p) => p.delay_ms ?? 0,
  render: (_e, p) => {
    const ms = p.delay_ms ?? 0
    return (
      <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-secondary)]">
        {ms > 0 ? formatDuration(ms) : '—'}
      </span>
    )
  },
}

// Filter-specific column
const FILTER_LEVEL_COL: ColumnDef = {
  key: 'filter_level',
  label: 'Level',
  align: 'center',
  width: 'w-14',
  sortable: false,
  getValue: (_e, p) => p.filter_level ?? 0,
  render: (_e, p) => {
    const lv = p.filter_level
    return lv != null ? (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[10px] font-semibold text-[var(--color-text-secondary)]">
        {lv}
      </span>
    ) : <span className="text-[var(--color-text-tertiary)]">—</span>
  },
}

// ---------------------------------------------------------------------------
// API call column — decode cryptic codes to human-readable names
// ---------------------------------------------------------------------------

const API_CALL_COL: ColumnDef = {
  key: 'identifier',
  label: 'API Call',
  align: 'left',
  sortable: true,
  getValue: (e) => e.identifier,
  render: (e) => {
    const code = e.identifier?.replace(/^.*:/, '') ?? e.identifier ?? ''
    const decoded = AR_API_CODES[code]
    if (!decoded) {
      return (
        <span className="block truncate font-mono text-[var(--color-text-primary)]" title={e.identifier}>
          {e.identifier || '—'}
        </span>
      )
    }
    return (
      <div className="flex items-center gap-1.5 min-w-0" title={decoded.description}>
        <span className="truncate text-[var(--color-text-primary)]">{decoded.name}</span>
        <span className="shrink-0 rounded bg-[var(--color-bg-tertiary)] px-1 py-0.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">
          {code}
        </span>
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// SQL table + statement columns — show actual SQL when available
// ---------------------------------------------------------------------------

const SQL_TABLE_COL: ColumnDef = {
  key: 'identifier',
  label: 'Table',
  align: 'left',
  width: 'max-w-[8rem]',
  sortable: true,
  getValue: (e) => e.identifier,
  render: (e) => (
    <span className="block truncate font-mono text-[var(--color-text-primary)]" title={e.identifier}>
      {e.identifier || '—'}
    </span>
  ),
}

const SQL_STATEMENT_COL: ColumnDef = {
  key: 'sql_statement',
  label: 'SQL Statement',
  align: 'left',
  sortable: false,
  getValue: (_e, p) => p.sql_statement ?? '',
  render: (_e, p) => {
    const sql = p.sql_statement
    if (!sql) return <span className="text-[var(--color-text-tertiary)]">—</span>
    const truncated = sql.length > 80 ? `${sql.slice(0, 80)}...` : sql
    return (
      <span
        className="block truncate font-mono text-[11px] text-[var(--color-text-secondary)]"
        title={sql}
      >
        {truncated}
      </span>
    )
  },
}

function getColumnsForType(logType: LogType): ColumnDef[] {
  switch (logType) {
    case 'API':
      return [RANK_COL, API_CALL_COL, FORM_COL, QUEUE_COL, DURATION_COL, QUEUE_TIME_COL, USER_COL, STATUS_COL]
    case 'SQL':
      return [RANK_COL, SQL_TABLE_COL, SQL_STATEMENT_COL, FORM_COL, DURATION_COL, TIMESTAMP_COL, STATUS_COL]
    case 'FLTR':
      return [RANK_COL, IDENTIFIER_COL('Filter Name'), FORM_COL, FILTER_LEVEL_COL, DURATION_COL, QUEUE_COL, STATUS_COL]
    case 'ESCL':
      return [RANK_COL, IDENTIFIER_COL('Escalation'), ESC_POOL_COL, ESC_DELAY_COL, DURATION_COL, TIMESTAMP_COL, STATUS_COL]
    default:
      return [RANK_COL, IDENTIFIER_COL('Identifier'), FORM_COL, QUEUE_COL, DURATION_COL, USER_COL, STATUS_COL]
  }
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ dir, active }: { dir: SortDir; active: boolean }) {
  if (!active) {
    return (
      <svg className="h-3 w-3 text-[var(--color-text-tertiary)] opacity-0 group-hover/th:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
      </svg>
    )
  }
  return (
    <svg className="h-3 w-3 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {dir === 'asc' ? <path d="M7 14l5-5 5 5" /> : <path d="M7 10l5 5 5-5" />}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Detail panel — shown inline when a row is clicked
// ---------------------------------------------------------------------------

function DetailField({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value == null || value === '') return null
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className={cn('mt-0.5 text-xs text-[var(--color-text-primary)] break-all', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function EntryDetailPanel({ entry, parsed, logType }: { entry: TopNEntry; parsed: ParsedDetails; logType: LogType }) {
  const ts = entry.timestamp ? new Date(entry.timestamp) : null
  const formattedTs = ts && !isNaN(ts.getTime()) ? ts.toLocaleString() : entry.timestamp || '—'

  return (
    <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
        <DetailField label="Identifier" value={entry.identifier} mono />
        <DetailField label="Trace ID" value={entry.trace_id} mono />
        <DetailField label="RPC ID" value={entry.rpc_id} mono />
        <DetailField label="Timestamp" value={formattedTs} mono />
        <DetailField label="Duration" value={formatDuration(entry.duration_ms)} mono />
        {entry.queue_time_ms != null && entry.queue_time_ms > 0 && (
          <DetailField label="Queue Time" value={formatDuration(entry.queue_time_ms)} mono />
        )}
        <DetailField label="Form" value={entry.form} />
        <DetailField label="Queue" value={entry.queue} mono />
        <DetailField label="User" value={entry.user} />
        <DetailField label="Line #" value={entry.line_number} mono />
        {entry.file_number != null && <DetailField label="File #" value={entry.file_number} mono />}
        <DetailField label="Status" value={entry.success ? 'Success' : 'Error'} />

        {/* Type-specific parsed details */}
        {logType === 'SQL' && parsed.sql_statement && (
          <div className="col-span-full min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">SQL Statement</dt>
            <dd className="mt-0.5 text-xs font-mono text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded px-2 py-1.5 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
              {parsed.sql_statement}
            </dd>
          </div>
        )}
        {logType === 'SQL' && <DetailField label="Table" value={parsed.sql_table} mono />}
        {logType === 'FLTR' && <DetailField label="Filter Name" value={parsed.filter_name} />}
        {logType === 'FLTR' && parsed.filter_level != null && <DetailField label="Level" value={parsed.filter_level} />}
        {logType === 'ESCL' && <DetailField label="Escalation" value={parsed.esc_name} />}
        {logType === 'ESCL' && <DetailField label="Pool" value={parsed.esc_pool} />}
        {logType === 'ESCL' && parsed.delay_ms != null && parsed.delay_ms > 0 && (
          <DetailField label="Delay" value={formatDuration(parsed.delay_ms)} mono />
        )}
        {parsed.thread_id && <DetailField label="Thread ID" value={parsed.thread_id} mono />}
        {parsed.error_encountered != null && <DetailField label="Error Encountered" value={parsed.error_encountered ? 'Yes' : 'No'} />}

        {/* Raw text if present */}
        {parsed.raw_text && (
          <div className="col-span-full min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Raw Log</dt>
            <dd className="mt-0.5 text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] rounded px-2 py-1.5 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
              {parsed.raw_text}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table content (shared between compact and Card modes)
// ---------------------------------------------------------------------------

function TopNTableContent({
  entries,
  title,
  logType,
  maxRows = 0,
}: {
  entries: TopNEntry[]
  title: string
  logType: LogType
  maxRows: number
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expanded, setExpanded] = useState(false)
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null)

  const columns = useMemo(() => getColumnsForType(logType), [logType])

  // Parse details for all entries (memoized)
  const parsedDetailsMap = useMemo(() => {
    return entries.map((e) => parseDetails(e.details))
  }, [entries])

  // Max duration for bar scaling
  const maxDuration = useMemo(() => {
    if (entries.length === 0) return 0
    return Math.max(...entries.map((e) => e.duration_ms))
  }, [entries])

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'duration_ms' || key === 'queue_time_ms' || key === 'delay_ms' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return entries.map((e, i) => ({ entry: e, parsed: parsedDetailsMap[i] }))

    const indexed = entries.map((e, i) => ({ entry: e, parsed: parsedDetailsMap[i] }))
    return indexed.sort((a, b) => {
      const va = col.getValue(a.entry, a.parsed)
      const vb = col.getValue(b.entry, b.parsed)
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [entries, parsedDetailsMap, sortKey, sortDir, columns])

  const isLimited = maxRows > 0 && sorted.length > maxRows && !expanded
  const visible = isLimited ? sorted.slice(0, maxRows) : sorted
  const hiddenCount = sorted.length - maxRows

  const getRowKey = useCallback((entry: TopNEntry, idx: number) => {
    return entry.trace_id ? `${entry.trace_id}-${entry.rank}` : `row-${idx}`
  }, [])

  const handleRowClick = useCallback((entry: TopNEntry, idx: number) => {
    const key = getRowKey(entry, idx)
    setExpandedRowKey((prev) => (prev === key ? null : key))
  }, [getRowKey])

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-[var(--color-text-tertiary)]">
        <svg className="h-8 w-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="16" x2="13" y2="16" />
        </svg>
        <span className="text-xs">No {title.toLowerCase()} found</span>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label={title}>
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  tabIndex={col.sortable ? 0 : undefined}
                  className={cn(
                    'group/th px-3 py-2 font-semibold text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap',
                    col.sortable && 'cursor-pointer select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.width
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  onKeyDown={col.sortable ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSort(col.key)
                    }
                  } : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc' ? 'ascending' : 'descending'
                      : col.sortable ? 'none' : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ entry, parsed }, idx) => {
              const rowKey = getRowKey(entry, idx)
              const isExpanded = expandedRowKey === rowKey
              return (
                <React.Fragment key={rowKey}>
                  <tr
                    onClick={() => handleRowClick(entry, idx)}
                    className={cn(
                      'border-b border-[var(--color-border-light)] transition-colors cursor-pointer',
                      'hover:bg-[var(--color-bg-secondary)]',
                      !entry.success && 'bg-[var(--color-error-light)]/20',
                      isExpanded && 'bg-[var(--color-primary)]/5 border-b-0',
                      idx % 2 === 1 && entry.success && !isExpanded && 'bg-[var(--color-bg-secondary)]/30'
                    )}
                    title="Click to view details"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2',
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                          col.width,
                          col.key === 'identifier' && 'max-w-0'
                        )}
                      >
                        {col.render(entry, parsed, maxDuration)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="p-0">
                        <EntryDetailPanel entry={entry} parsed={parsed} logType={logType} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show more / Show less */}
      {maxRows > 0 && sorted.length > maxRows && (
        <div className="border-t border-[var(--color-border-light)] px-4 py-2 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {expanded
              ? 'Show less'
              : `Show all ${sorted.length} entries (+${hiddenCount} more)`}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopNTable (exported)
// ---------------------------------------------------------------------------

export function TopNTable({ entries, title, logType, className, maxRows = 0, compact = false }: TopNTableProps) {
  const typeConfig = LOG_TYPE_COLORS[logType]

  if (compact) {
    return (
      <div className={className}>
        <TopNTableContent
          entries={entries}
          title={title}
          logType={logType}
          maxRows={maxRows}
        />
      </div>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: typeConfig.bg, color: typeConfig.text }}
            aria-label={`Log type: ${logType}`}
          >
            {logType}
          </span>
          {title}
          {entries.length > 0 && (
            <span className="text-xs font-normal text-[var(--color-text-tertiary)]">
              ({entries.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0 pt-0">
        <TopNTableContent
          entries={entries}
          title={title}
          logType={logType}
          maxRows={maxRows}
        />
      </CardContent>
    </Card>
  )
}
