'use client'

/**
 * waterfall-row.tsx — Standalone WaterfallRow for external use.
 *
 * Exports a single span row that can be used outside the virtualized list,
 * for example in previews or trace comparison diffs.
 *
 * Usage:
 *   <WaterfallRowStandalone
 *     span={span}
 *     totalDurationMs={totalDurationMs}
 *     showCriticalPath={true}
 *     isSelected={false}
 *     onClick={() => setSelected(span)}
 *   />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { SpanNode } from '@/lib/api-types'
import { ApiCodeBadge } from '@/components/shared/api-code-badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WaterfallRowStandaloneProps {
  span: SpanNode
  totalDurationMs: number
  showCriticalPath?: boolean
  isSelected?: boolean
  onClick?: (span: SpanNode) => void
  className?: string
}

// ---------------------------------------------------------------------------
// WaterfallRowStandalone
// ---------------------------------------------------------------------------

export function WaterfallRowStandalone({
  span,
  totalDurationMs,
  showCriticalPath = false,
  isSelected = false,
  onClick,
  className,
}: WaterfallRowStandaloneProps) {
  const config = LOG_TYPE_COLORS[span.log_type]
  const indentPx = span.depth * 16
  const leftPct = totalDurationMs > 0 ? (span.start_offset_ms / totalDurationMs) * 100 : 0
  const widthPct = totalDurationMs > 0 ? Math.max((span.duration_ms / totalDurationMs) * 100, 0.5) : 0.5

  const handleClick = useCallback(() => {
    onClick?.(span)
  }, [span, onClick])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick?.(span)
      }
    },
    [span, onClick],
  )

  return (
    <div
      role="row"
      aria-selected={isSelected}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={cn(
        'flex h-9 items-center gap-2 border-b border-[var(--color-border-light)] px-3',
        onClick && 'cursor-pointer hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:bg-[var(--color-primary-light)]',
        isSelected && 'bg-[var(--color-primary-light)]',
        showCriticalPath && span.on_critical_path && 'bg-amber-50/60',
        className,
      )}
    >
      {/* Indentation + label */}
      <div
        className="flex shrink-0 items-center gap-1.5"
        style={{ paddingLeft: indentPx, width: `${180 + indentPx}px` }}
      >
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
        {span.log_type === 'API' && span.operation ? (
          <ApiCodeBadge
            code={span.operation}
            className="truncate text-xs text-[var(--color-text-primary)]"
          />
        ) : (
          <span className="truncate text-xs text-[var(--color-text-primary)]" title={span.operation}>
            {span.operation || span.id.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="relative h-5 flex-1">
        <div
          className={cn(
            'absolute top-0 h-full rounded-sm',
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
      </div>

      {/* Duration */}
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">
        {span.duration_ms.toFixed(1)} ms
      </span>

      {span.has_error && (
        <span className="shrink-0 text-[var(--color-error)]" aria-label="Error" title={span.error_message ?? 'Error'}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
            <path d="M6 1L11.196 10H.804L6 1Z" />
            <rect x="5.5" y="5" width="1" height="3" fill="white" />
            <rect x="5.5" y="9" width="1" height="1" fill="white" />
          </svg>
        </span>
      )}
    </div>
  )
}
