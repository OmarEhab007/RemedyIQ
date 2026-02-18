'use client'

/**
 * timestamp-ruler.tsx — Time axis ruler for the waterfall/flame-graph.
 *
 * Renders tick marks at evenly-spaced intervals across the total duration.
 *
 * Usage:
 *   <TimestampRuler totalDurationMs={500} tickCount={5} className="mb-2" />
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimestampRulerProps {
  totalDurationMs: number
  tickCount?: number
  startOffsetMs?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Format a duration value for display
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms === 0) return '0'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms >= 100) return `${Math.round(ms)}ms`
  return `${ms.toFixed(1)}ms`
}

// ---------------------------------------------------------------------------
// TimestampRuler
// ---------------------------------------------------------------------------

export function TimestampRuler({
  totalDurationMs,
  tickCount = 5,
  startOffsetMs = 0,
  className,
}: TimestampRulerProps) {
  const ticks = useMemo(() => {
    if (totalDurationMs <= 0 || tickCount <= 0) return []
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const pct = (i / tickCount) * 100
      const ms = startOffsetMs + (totalDurationMs * i) / tickCount
      return { pct, ms }
    })
  }, [totalDurationMs, tickCount, startOffsetMs])

  if (ticks.length === 0) return null

  return (
    <div
      className={cn('relative h-5 select-none', className)}
      role="presentation"
      aria-hidden="true"
    >
      {/* Baseline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--color-border)]" />

      {ticks.map(({ pct, ms }) => (
        <div
          key={pct}
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        >
          {/* Tick mark */}
          <div className="mb-0.5 h-2 w-px bg-[var(--color-border)]" />
          {/* Label */}
          <span className="text-[10px] leading-none tabular-nums text-[var(--color-text-tertiary)]">
            {formatMs(ms)}
          </span>
        </div>
      ))}
    </div>
  )
}
