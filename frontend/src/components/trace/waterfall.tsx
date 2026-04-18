'use client'

/**
 * waterfall.tsx — Hierarchical waterfall diagram for trace spans.
 *
 * Renders SpanNode[] tree with indentation by depth.
 * Duration bars are proportional to total trace time, colored by log type.
 * Virtual scrolling via react-window for 500+ spans.
 * Clickable spans invoke onSelectSpan callback.
 *
 * Usage:
 *   <Waterfall
 *     data={waterfallResponse}
 *     selectedSpanId={selectedId}
 *     onSelectSpan={(span) => setSelected(span)}
 *     showCriticalPath={true}
 *     filters={activeFilters}
 *   />
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { SpanNode, WaterfallResponse, LogType } from '@/lib/api-types'

interface FlatRow {
  span: SpanNode
  hasChildren: boolean
}

/** Passed to react-window List itemData (virtual rows) */
interface WaterfallItemData {
  rows: FlatRow[]
  totalDurationMs: number
  showCriticalPath: boolean
  selectedSpanId: string | null
  onSelectSpan: (span: SpanNode | null) => void
  gridTemplateColumns: string
}

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
  ref?: React.Ref<ListInstance>
  height: number
  width: number | string
  itemCount: number
  itemSize: number
  itemData?: WaterfallItemData
  overscanCount?: number
  children: React.ComponentType<{
    index: number
    style: React.CSSProperties
    data: WaterfallItemData
  }>
}

interface ListInstance {
  scrollToItem: (index: number, align?: string) => void
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaterfallFilters {
  logTypes: Set<LogType>
  minDurationMs: number
  errorsOnly: boolean
}

interface WaterfallProps {
  data: WaterfallResponse
  selectedSpanId: string | null
  onSelectSpan: (span: SpanNode | null) => void
  showCriticalPath: boolean
  filters: WaterfallFilters
  className?: string
}

// ---------------------------------------------------------------------------
// Row height constant
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 36

const WATERFALL_RESIZE_SPEC: ResizableColumnConfig[] = [
  { id: 'span', defaultWidth: 280, minWidth: 160, maxWidth: 560 },
  { id: 'timeline', defaultWidth: 360, minWidth: 160, maxWidth: 960 },
  { id: 'duration', defaultWidth: 88, minWidth: 72, maxWidth: 160 },
  { id: 'icons', defaultWidth: 52, minWidth: 40, maxWidth: 100 },
]

// ---------------------------------------------------------------------------
// Helper — flatten tree into ordered rows, respecting filters
// ---------------------------------------------------------------------------

function flattenSpans(
  spans: SpanNode[],
  filters: WaterfallFilters,
): FlatRow[] {
  const rows: FlatRow[] = []

  function visit(span: SpanNode) {
    // Apply filters
    if (filters.logTypes.size > 0 && !filters.logTypes.has(span.log_type)) {
      // Still recurse children — they might pass filters
      span.children.forEach(visit)
      return
    }
    if (span.duration_ms < filters.minDurationMs) {
      span.children.forEach(visit)
      return
    }
    if (filters.errorsOnly && !span.has_error) {
      span.children.forEach(visit)
      return
    }

    rows.push({ span, hasChildren: span.children.length > 0 })
    span.children.forEach(visit)
  }

  spans.forEach(visit)
  return rows
}

// ---------------------------------------------------------------------------
// SpanBar — the colored duration bar
// ---------------------------------------------------------------------------

interface SpanBarProps {
  span: SpanNode
  totalDurationMs: number
  showCriticalPath: boolean
  isSelected: boolean
}

function SpanBar({ span, totalDurationMs, showCriticalPath, isSelected }: SpanBarProps) {
  const config = LOG_TYPE_COLORS[span.log_type]
  const leftPct = totalDurationMs > 0
    ? (span.start_offset_ms / totalDurationMs) * 100
    : 0
  const widthPct = totalDurationMs > 0
    ? Math.max((span.duration_ms / totalDurationMs) * 100, 0.5) // min 0.5% for visibility
    : 0.5

  return (
    <div className="relative h-5 w-full min-w-0">
      <div
        className={cn(
          'absolute top-0 h-full rounded-sm transition-opacity',
          showCriticalPath && !span.on_critical_path && 'opacity-30',
          isSelected && 'ring-2 ring-offset-1 ring-[var(--color-primary)]',
        )}
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          backgroundColor: config.bg,
          minWidth: 2,
        }}
        aria-hidden="true"
      />
      {span.has_error && (
        <div
          className="absolute top-0 right-0 h-full w-1 rounded-r-sm bg-[var(--color-error)]"
          aria-hidden="true"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WaterfallRow — single row rendered inside the virtual list
// ---------------------------------------------------------------------------

interface WaterfallRowProps {
  row: FlatRow
  totalDurationMs: number
  showCriticalPath: boolean
  selectedSpanId: string | null
  onSelectSpan: (span: SpanNode | null) => void
  gridTemplateColumns: string
  style: React.CSSProperties
}

function WaterfallRow({
  row,
  totalDurationMs,
  showCriticalPath,
  selectedSpanId,
  onSelectSpan,
  gridTemplateColumns,
  style,
}: WaterfallRowProps) {
  const { span } = row
  const isSelected = span.id === selectedSpanId
  const config = LOG_TYPE_COLORS[span.log_type]
  const indentPx = span.depth * 16

  const handleClick = useCallback(() => {
    onSelectSpan(isSelected ? null : span)
  }, [span, isSelected, onSelectSpan])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns,
        columnGap: '8px',
        alignItems: 'center',
        boxSizing: 'border-box',
        paddingLeft: 12,
        paddingRight: 12,
      }}
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'cursor-pointer border-b border-[var(--color-border-light)] transition-colors',
        'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
        isSelected && 'bg-[var(--color-primary-light)]',
        showCriticalPath && span.on_critical_path && 'bg-amber-50/60',
      )}
    >
      {/* Span tree: indent + badge + operation */}
      <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: indentPx }}>
        {span.depth > 0 && (
          <span className="shrink-0 text-[var(--color-border)]" aria-hidden="true">
            {'└'}
          </span>
        )}
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          style={{ backgroundColor: config.bg, color: config.text }}
        >
          {config.label}
        </span>
        <span
          className="min-w-0 truncate text-xs text-[var(--color-text-primary)]"
          title={span.operation ?? undefined}
        >
          {span.operation || span.id.slice(0, 8)}
        </span>
      </div>

      <div className="min-w-0">
        <SpanBar
          span={span}
          totalDurationMs={totalDurationMs}
          showCriticalPath={showCriticalPath}
          isSelected={isSelected}
        />
      </div>

      <span className="min-w-0 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">
        {span.duration_ms.toFixed(1)} ms
      </span>

      <div className="flex min-w-0 items-center justify-end gap-1">
        {showCriticalPath && span.on_critical_path && (
          <span className="shrink-0 text-amber-600" aria-label="On critical path" title="On critical path">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
              <circle cx="5" cy="5" r="4" />
            </svg>
          </span>
        )}
        {span.has_error && (
          <span
            className="shrink-0 text-[var(--color-error)]"
            aria-label="Has error"
            title={span.error_message ?? 'Error'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
              <path d="M6 1L11.196 10H.804L6 1Z" />
              <rect x="5.5" y="5" width="1" height="3" fill="white" />
              <rect x="5.5" y="9" width="1" height="1" fill="white" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}

function WaterfallVirtualRow({
  index,
  style,
  data,
}: {
  index: number
  style: React.CSSProperties
  data: WaterfallItemData
}) {
  const row = data.rows[index]
  if (!row) return null
  return (
    <WaterfallRow
      row={row}
      totalDurationMs={data.totalDurationMs}
      showCriticalPath={data.showCriticalPath}
      selectedSpanId={data.selectedSpanId}
      onSelectSpan={data.onSelectSpan}
      gridTemplateColumns={data.gridTemplateColumns}
      style={style}
    />
  )
}

// ---------------------------------------------------------------------------
// Waterfall
// ---------------------------------------------------------------------------

export function Waterfall({
  data,
  selectedSpanId,
  onSelectSpan,
  showCriticalPath,
  filters,
  className,
}: WaterfallProps) {
  const listRef = useRef<ListInstance>(null)
  const listAreaRef = useRef<HTMLDivElement>(null)
  const [listAreaWidth, setListAreaWidth] = useState(0)

  const { columnWidths, totalWidth, renderResizeHandle } = useResizableTableColumns(WATERFALL_RESIZE_SPEC, {
    storageKey: 'remedyiq:trace:waterfall:v1',
  })

  const gridTemplateColumns = useMemo(
    () => columnWidths.map((w) => `${w}px`).join(' '),
    [columnWidths],
  )

  const rows = useMemo(
    () => flattenSpans(data.spans, filters),
    [data.spans, filters],
  )

  const itemData: WaterfallItemData = useMemo(
    () => ({
      rows,
      totalDurationMs: data.total_duration_ms,
      showCriticalPath,
      selectedSpanId,
      onSelectSpan,
      gridTemplateColumns,
    }),
    [rows, data.total_duration_ms, showCriticalPath, selectedSpanId, onSelectSpan, gridTemplateColumns],
  )

  useEffect(() => {
    const el = listAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setListAreaWidth(el.clientWidth)
    })
    ro.observe(el)
    setListAreaWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Scroll selected span into view
  useEffect(() => {
    if (selectedSpanId && listRef.current) {
      const idx = rows.findIndex((r) => r.span.id === selectedSpanId)
      if (idx >= 0) {
        listRef.current.scrollToItem(idx, 'smart')
      }
    }
  }, [selectedSpanId, rows])

  if (rows.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]', className)}>
        No spans match the current filters.
      </div>
    )
  }

  const listHeight = Math.min(rows.length * ROW_HEIGHT, 600)
  const listWidth = Math.max(listAreaWidth || 400, totalWidth)

  return (
    <div
      className={cn('flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]', className)}
    >
      <div className="overflow-x-auto border-b border-[var(--color-border)]">
        <div
          role="rowgroup"
          className="grid items-center gap-x-2 bg-[var(--color-bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]"
          style={{
            gridTemplateColumns,
            minWidth: totalWidth,
            width: '100%',
          }}
        >
          <div className="relative flex min-w-0 items-center">
            <span className="truncate pr-2">Span</span>
            {renderResizeHandle(0)}
          </div>
          <div className="relative flex min-w-0 items-center">
            <span className="truncate pr-2">Timeline ({data.total_duration_ms.toFixed(1)} ms total)</span>
            {renderResizeHandle(1)}
          </div>
          <div className="relative flex min-w-0 items-center justify-end text-right">
            <span className="truncate pr-2">Duration</span>
            {renderResizeHandle(2)}
          </div>
          <div className="relative flex min-w-0 items-center justify-end" aria-hidden="true">
            <span className="sr-only">Indicators</span>
            {renderResizeHandle(3)}
          </div>
        </div>
      </div>

      <div
        ref={listAreaRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height: listHeight }}
        role="table"
        aria-label="Trace waterfall"
        aria-rowcount={rows.length}
      >
        <List
          ref={listRef}
          height={listHeight}
          itemCount={rows.length}
          itemSize={ROW_HEIGHT}
          width={listWidth}
          itemData={itemData}
          overscanCount={5}
        >
          {WaterfallVirtualRow}
        </List>
      </div>
    </div>
  )
}
