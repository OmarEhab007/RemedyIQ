'use client'

/**
 * critical-path.tsx — Toggle button + overlay for critical path highlighting.
 *
 * When active, dimming non-critical-path spans in the waterfall/flame-graph
 * is handled by passing showCriticalPath prop to those components.
 * This component renders the toggle button and a summary of critical spans.
 *
 * Usage:
 *   <CriticalPathToggle
 *     enabled={showCriticalPath}
 *     onChange={setShowCriticalPath}
 *     criticalSpanCount={data.critical_path.length}
 *     totalSpanCount={data.span_count}
 *   />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CriticalPathToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  criticalSpanCount: number
  totalSpanCount: number
  criticalDurationMs?: number
  totalDurationMs?: number
  className?: string
}

// ---------------------------------------------------------------------------
// CriticalPathToggle
// ---------------------------------------------------------------------------

export function CriticalPathToggle({
  enabled,
  onChange,
  criticalSpanCount,
  totalSpanCount,
  criticalDurationMs,
  totalDurationMs,
  className,
}: CriticalPathToggleProps) {
  const handleToggle = useCallback(() => {
    onChange(!enabled)
  }, [enabled, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleToggle()
      }
    },
    [handleToggle],
  )

  const pct =
    totalDurationMs && criticalDurationMs
      ? ((criticalDurationMs / totalDurationMs) * 100).toFixed(0)
      : null

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Toggle button */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Highlight critical path"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          enabled
            ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
        )}
      >
        {/* Track */}
        <span
          className={cn(
            'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
            enabled ? 'bg-amber-500' : 'bg-[var(--color-border)]',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-3.5' : 'translate-x-0.5',
            )}
          />
        </span>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h18M12 3l9 9-9 9" />
        </svg>

        Critical Path
      </button>

      {/* Stats (shown when enabled) */}
      {enabled && criticalSpanCount > 0 && (
        <div
          className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]"
          aria-live="polite"
          aria-label={`Critical path: ${criticalSpanCount} of ${totalSpanCount} spans`}
        >
          <span>
            <strong className="text-amber-600">{criticalSpanCount}</strong>
            {' '}/ {totalSpanCount} spans
          </span>
          {pct && (
            <span>
              <strong className="text-amber-600">{pct}%</strong> of total time
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      {enabled && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"
            aria-hidden="true"
          />
          On critical path
          <span
            className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-border)]"
            aria-hidden="true"
          />
          Other spans
        </div>
      )}
    </div>
  )
}
