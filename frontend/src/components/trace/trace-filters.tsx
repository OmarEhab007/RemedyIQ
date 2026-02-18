'use client'

/**
 * trace-filters.tsx — Filter controls for trace views.
 *
 * Controls:
 *   - Log type checkboxes (API, SQL, FLTR, ESCL)
 *   - Min duration slider (0–5000 ms)
 *   - Errors-only toggle
 *
 * Usage:
 *   <TraceFilters filters={filters} onChange={setFilters} totalSpans={data.span_count} />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { LogType } from '@/lib/api-types'
import type { WaterfallFilters } from './waterfall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceFiltersProps {
  filters: WaterfallFilters
  onChange: (filters: WaterfallFilters) => void
  totalSpans?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Log type options
// ---------------------------------------------------------------------------

const LOG_TYPES: LogType[] = ['API', 'SQL', 'FLTR', 'ESCL']

// ---------------------------------------------------------------------------
// TraceFilters
// ---------------------------------------------------------------------------

export function TraceFilters({
  filters,
  onChange,
  totalSpans,
  className,
}: TraceFiltersProps) {
  const toggleLogType = useCallback(
    (type: LogType) => {
      const next = new Set(filters.logTypes)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      onChange({ ...filters, logTypes: next })
    },
    [filters, onChange],
  )

  const handleMinDuration = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...filters, minDurationMs: Number(e.target.value) })
    },
    [filters, onChange],
  )

  const handleErrorsOnly = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...filters, errorsOnly: e.target.checked })
    },
    [filters, onChange],
  )

  const handleReset = useCallback(() => {
    onChange({ logTypes: new Set(), minDurationMs: 0, errorsOnly: false })
  }, [onChange])

  const hasActiveFilters =
    filters.logTypes.size > 0 || filters.minDurationMs > 0 || filters.errorsOnly

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3',
        className,
      )}
      role="group"
      aria-label="Trace filters"
    >
      {/* Log type checkboxes */}
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">Log types</legend>
        <span className="shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
          Log types:
        </span>
        {LOG_TYPES.map((type) => {
          const config = LOG_TYPE_COLORS[type]
          const checked = filters.logTypes.has(type)
          const id = `trace-filter-type-${type}`
          return (
            <label
              key={type}
              htmlFor={id}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                checked
                  ? 'border-transparent text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]',
              )}
              style={checked ? { backgroundColor: config.bg } : undefined}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => toggleLogType(type)}
                className="sr-only"
                aria-label={`Filter ${config.label} spans`}
              />
              {config.label}
            </label>
          )
        })}
      </fieldset>

      {/* Separator */}
      <div className="hidden h-5 w-px bg-[var(--color-border)] sm:block" aria-hidden="true" />

      {/* Min duration slider */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="trace-min-duration"
          className="shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]"
        >
          Min dur.:
        </label>
        <input
          id="trace-min-duration"
          type="range"
          min={0}
          max={5000}
          step={10}
          value={filters.minDurationMs}
          onChange={handleMinDuration}
          className="h-1.5 w-28 cursor-pointer accent-[var(--color-primary)]"
          aria-label={`Minimum duration: ${filters.minDurationMs} ms`}
          aria-valuemin={0}
          aria-valuemax={5000}
          aria-valuenow={filters.minDurationMs}
        />
        <span className="w-16 text-right text-xs tabular-nums text-[var(--color-text-primary)]">
          {filters.minDurationMs} ms
        </span>
      </div>

      {/* Separator */}
      <div className="hidden h-5 w-px bg-[var(--color-border)] sm:block" aria-hidden="true" />

      {/* Errors only toggle */}
      <label htmlFor="trace-errors-only" className="flex cursor-pointer items-center gap-2">
        <input
          id="trace-errors-only"
          type="checkbox"
          checked={filters.errorsOnly}
          onChange={handleErrorsOnly}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-error)]"
        />
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          Errors only
        </span>
      </label>

      {/* Span count */}
      {totalSpans !== undefined && (
        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
          {totalSpans} span{totalSpans !== 1 ? 's' : ''}
        </span>
      )}

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
        >
          Reset
        </button>
      )}
    </div>
  )
}
