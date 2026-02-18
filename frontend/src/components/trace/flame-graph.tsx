'use client'

/**
 * flame-graph.tsx — Flame graph visualization of trace span data.
 *
 * Renders stacked rectangles where width = duration, positioned by
 * start_offset_ms. Colored by log type using LOG_TYPE_COLORS.
 * Clickable spans invoke onSelectSpan.
 *
 * Usage:
 *   <FlameGraph
 *     data={waterfallResponse}
 *     selectedSpanId={selectedId}
 *     onSelectSpan={(span) => setSelected(span)}
 *   />
 */

import { useMemo, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { SpanNode, WaterfallResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlameGraphProps {
  data: WaterfallResponse
  selectedSpanId: string | null
  onSelectSpan: (span: SpanNode | null) => void
  className?: string
}

interface PositionedSpan {
  span: SpanNode
  x: number   // percentage 0-100
  w: number   // percentage 0-100
  y: number   // row index (depth)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 24
const ROW_GAP = 2
const MIN_WIDTH_PCT = 0.3

// ---------------------------------------------------------------------------
// Flatten tree into positioned spans
// ---------------------------------------------------------------------------

function positionSpans(spans: SpanNode[], totalDurationMs: number): PositionedSpan[] {
  const result: PositionedSpan[] = []

  function visit(span: SpanNode) {
    if (totalDurationMs <= 0) return

    const x = (span.start_offset_ms / totalDurationMs) * 100
    const w = Math.max((span.duration_ms / totalDurationMs) * 100, MIN_WIDTH_PCT)

    result.push({ span, x, w, y: span.depth })
    span.children.forEach(visit)
  }

  spans.forEach(visit)
  return result
}

// ---------------------------------------------------------------------------
// FlameGraph
// ---------------------------------------------------------------------------

export function FlameGraph({
  data,
  selectedSpanId,
  onSelectSpan,
  className,
}: FlameGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const posSpans = useMemo(
    () => positionSpans(data.spans, data.total_duration_ms),
    [data.spans, data.total_duration_ms],
  )

  const maxDepth = useMemo(
    () => posSpans.reduce((max, ps) => Math.max(max, ps.y), 0),
    [posSpans],
  )

  const totalHeightPx = (maxDepth + 1) * (ROW_HEIGHT + ROW_GAP)

  const handleClick = useCallback(
    (span: SpanNode) => {
      onSelectSpan(span.id === selectedSpanId ? null : span)
    },
    [selectedSpanId, onSelectSpan],
  )

  if (posSpans.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]', className)}>
        No span data available.
      </div>
    )
  }

  return (
    <div
      className={cn('overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3', className)}
      aria-label="Flame graph"
      role="img"
    >
      {/* Time axis labels */}
      <div className="mb-1 flex justify-between px-0 text-[10px] text-[var(--color-text-tertiary)]">
        <span>0 ms</span>
        <span>{(data.total_duration_ms / 2).toFixed(0)} ms</span>
        <span>{data.total_duration_ms.toFixed(0)} ms</span>
      </div>

      {/* Flame graph canvas */}
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: totalHeightPx }}
        role="group"
        aria-label={`Flame graph with ${posSpans.length} spans across ${maxDepth + 1} levels`}
      >
        {posSpans.map((ps) => {
          const config = LOG_TYPE_COLORS[ps.span.log_type]
          const isSelected = ps.span.id === selectedSpanId
          const topPx = ps.y * (ROW_HEIGHT + ROW_GAP)

          return (
            <button
              key={ps.span.id}
              type="button"
              onClick={() => handleClick(ps.span)}
              title={`${ps.span.operation || ps.span.id} — ${ps.span.duration_ms.toFixed(1)} ms`}
              aria-label={`${ps.span.operation || ps.span.id}, ${ps.span.log_type}, ${ps.span.duration_ms.toFixed(1)} ms`}
              aria-pressed={isSelected}
              className={cn(
                'absolute flex items-center overflow-hidden rounded-sm text-[10px] font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
                isSelected && 'ring-2 ring-[var(--color-primary)] ring-offset-1 z-10',
                'hover:brightness-110',
              )}
              style={{
                left: `${ps.x}%`,
                width: `${ps.w}%`,
                top: topPx,
                height: ROW_HEIGHT,
                backgroundColor: config.bg,
                color: config.text,
                minWidth: 2,
                paddingLeft: ps.w > 5 ? 4 : 0,
              }}
            >
              {ps.w > 3 && (
                <span className="truncate leading-none">
                  {ps.span.operation || ps.span.log_type}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-[var(--color-border-light)] pt-2">
        {Object.entries(LOG_TYPE_COLORS).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="h-3 w-6 rounded-sm"
              style={{ backgroundColor: cfg.bg }}
              aria-hidden="true"
            />
            <span className="text-[11px] text-[var(--color-text-secondary)]">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
