'use client'

/**
 * span-list.tsx — Flat table view of all spans.
 *
 * Sortable by duration, start time, log type.
 * Clickable rows invoke onSelectSpan callback.
 *
 * Usage:
 *   <SpanList
 *     spans={waterfallData.flat_spans}
 *     selectedSpanId={selectedId}
 *     onSelectSpan={(span) => setSelected(span)}
 *   />
 */

import { useState, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { SpanNode, LogType } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = 'start_offset_ms' | 'duration_ms' | 'log_type' | 'operation'
type SortDir = 'asc' | 'desc'

interface SpanListProps {
  spans: SpanNode[]
  selectedSpanId: string | null
  onSelectSpan: (span: SpanNode | null) => void
  className?: string
}

const SPAN_LIST_RESIZE: ResizableColumnConfig[] = [
  { id: 'log_type', defaultWidth: 88, minWidth: 72, maxWidth: 140 },
  { id: 'operation', defaultWidth: 220, minWidth: 120, maxWidth: 560 },
  { id: 'start', defaultWidth: 100, minWidth: 80, maxWidth: 160 },
  { id: 'duration', defaultWidth: 112, minWidth: 88, maxWidth: 180 },
  { id: 'status', defaultWidth: 72, minWidth: 56, maxWidth: 100 },
  { id: 'user_queue', defaultWidth: 200, minWidth: 120, maxWidth: 400 },
  { id: 'path', defaultWidth: 48, minWidth: 40, maxWidth: 72 },
]

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={cn('transition-opacity', active ? 'opacity-100' : 'opacity-30')}
    >
      {dir === 'asc' || !active ? (
        <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
      ) : (
        <path d="M6 10L2 4H10L6 10Z" fill="currentColor" />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------

interface ColHeaderProps {
  label: string
  field: SortField
  sortField: SortField
  sortDir: SortDir
  onSort: (f: SortField) => void
  colIndex: number
  thStyle: (i: number) => CSSProperties
  renderResizeHandle: (i: number) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

function ColHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  colIndex,
  thStyle,
  renderResizeHandle,
  className,
  align = 'left',
}: ColHeaderProps) {
  return (
    <th
      scope="col"
      style={thStyle(colIndex)}
      className={cn(
        'relative box-border cursor-pointer select-none border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      onClick={() => onSort(field)}
      aria-sort={sortField === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-1 pr-2">
        {label}
        <SortIcon active={sortField === field} dir={sortField === field ? sortDir : 'asc'} />
      </span>
      {renderResizeHandle(colIndex)}
    </th>
  )
}

// ---------------------------------------------------------------------------
// SpanList
// ---------------------------------------------------------------------------

export function SpanList({ spans, selectedSpanId, onSelectSpan, className }: SpanListProps) {
  const [sortField, setSortField] = useState<SortField>('start_offset_ms')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(SPAN_LIST_RESIZE, {
    storageKey: 'remedyiq:trace:span-list:v1',
  })

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return field
    })
  }, [])

  const sorted = useMemo(() => {
    return [...spans].sort((a, b) => {
      let cmp = 0
      if (sortField === 'duration_ms') {
        cmp = a.duration_ms - b.duration_ms
      } else if (sortField === 'start_offset_ms') {
        cmp = a.start_offset_ms - b.start_offset_ms
      } else if (sortField === 'log_type') {
        cmp = a.log_type.localeCompare(b.log_type)
      } else if (sortField === 'operation') {
        cmp = (a.operation ?? '').localeCompare(b.operation ?? '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [spans, sortField, sortDir])

  if (sorted.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]', className)}>
        No spans available.
      </div>
    )
  }

  return (
    <div className={cn('overflow-auto rounded-lg border border-[var(--color-border)]', className)}>
      <table className="border-collapse text-sm" style={tableLayoutStyle} role="table">
        <thead>
          <tr role="row">
            <ColHeader
              label="Log Type"
              field="log_type"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              colIndex={0}
              thStyle={thStyle}
              renderResizeHandle={renderResizeHandle}
            />
            <ColHeader
              label="Operation"
              field="operation"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              colIndex={1}
              thStyle={thStyle}
              renderResizeHandle={renderResizeHandle}
            />
            <ColHeader
              label="Start (ms)"
              field="start_offset_ms"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              colIndex={2}
              thStyle={thStyle}
              renderResizeHandle={renderResizeHandle}
              align="right"
            />
            <ColHeader
              label="Duration (ms)"
              field="duration_ms"
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              colIndex={3}
              thStyle={thStyle}
              renderResizeHandle={renderResizeHandle}
              align="right"
            />
            <th
              scope="col"
              style={thStyle(4)}
              className="relative box-border border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              <span className="pr-2">Status</span>
              {renderResizeHandle(4)}
            </th>
            <th
              scope="col"
              style={thStyle(5)}
              className="relative box-border border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              <span className="pr-2">User / Queue</span>
              {renderResizeHandle(5)}
            </th>
            <th
              scope="col"
              style={thStyle(6)}
              className="relative box-border border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]"
              aria-label="Critical path"
            >
              <span className="sr-only">Critical path</span>
              {renderResizeHandle(6)}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((span) => {
            const config = LOG_TYPE_COLORS[span.log_type as LogType]
            const isSelected = span.id === selectedSpanId
            return (
              <tr
                key={span.id}
                role="row"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => onSelectSpan(isSelected ? null : span)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectSpan(isSelected ? null : span)
                  }
                }}
                className={cn(
                  'cursor-pointer border-b border-[var(--color-border-light)] transition-colors',
                  'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:bg-[var(--color-primary-light)]',
                  isSelected && 'bg-[var(--color-primary-light)]',
                )}
              >
                <td style={tdStyle(0)} className="box-border px-3 py-2 align-top" role="cell">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
                    style={{ backgroundColor: config.bg, color: config.text }}
                  >
                    {config.label}
                  </span>
                </td>

                <td style={tdStyle(1)} className="box-border min-w-0 px-3 py-2 align-top font-mono text-xs text-[var(--color-text-primary)] break-words whitespace-normal" role="cell" title={span.operation ?? undefined}>
                  {span.operation || '—'}
                </td>

                <td style={tdStyle(2)} className="box-border px-3 py-2 align-top text-right tabular-nums text-xs text-[var(--color-text-secondary)]" role="cell">
                  {span.start_offset_ms.toFixed(1)}
                </td>

                <td style={tdStyle(3)} className="box-border px-3 py-2 align-top text-right tabular-nums text-xs font-medium text-[var(--color-text-primary)]" role="cell">
                  {span.duration_ms.toFixed(2)}
                </td>

                <td style={tdStyle(4)} className="box-border px-3 py-2 align-top text-center" role="cell">
                  {span.has_error ? (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-[var(--color-error)]"
                      aria-label="Error"
                      title={span.error_message ?? 'Error'}
                    />
                  ) : (
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]"
                      aria-label="Success"
                    />
                  )}
                </td>

                <td style={tdStyle(5)} className="box-border min-w-0 px-3 py-2 align-top text-xs text-[var(--color-text-secondary)] break-words whitespace-normal" role="cell" title={[span.user, span.queue].filter(Boolean).join(' / ')}>
                  {span.user && <span className="text-[var(--color-text-primary)]">{span.user}</span>}
                  {span.user && span.queue && <span className="mx-1 text-[var(--color-border)]">/</span>}
                  {span.queue}
                </td>

                <td style={tdStyle(6)} className="box-border px-3 py-2 align-top text-center" role="cell">
                  {span.on_critical_path && (
                    <span className="text-amber-500" title="On critical path" aria-label="On critical path">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                        <circle cx="6" cy="6" r="5" />
                      </svg>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
