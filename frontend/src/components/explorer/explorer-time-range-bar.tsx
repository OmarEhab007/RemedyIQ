'use client'

/**
 * ExplorerTimeRangeBar — compact time window controls for Log Explorer searches.
 */

import { useCallback, useId, useRef } from 'react'

import type { ExplorerTimeRange } from '@/stores/explorer-store'
import { cn } from '@/lib/utils'

export interface ExplorerTimeRangeBarProps {
  timeRange: ExplorerTimeRange | null
  onChange: (range: ExplorerTimeRange | null) => void
  className?: string
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ExplorerTimeRangeBar({
  timeRange,
  onChange,
  className,
}: ExplorerTimeRangeBarProps) {
  const uid = useId().replace(/:/g, '')
  const startId = `explorer-time-start-${uid}`
  const endId = `explorer-time-end-${uid}`
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const formKey = timeRange ? `${timeRange.start}|${timeRange.end}` : 'all'

  const handleClear = useCallback(() => {
    onChange(null)
  }, [onChange])

  const handleApply = useCallback(() => {
    const startLocal = startRef.current?.value
    const endLocal = endRef.current?.value
    if (!startLocal || !endLocal) return
    const startMs = new Date(startLocal).getTime()
    const endMs = new Date(endLocal).getTime()
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return
    onChange({
      start: new Date(startLocal).toISOString(),
      end: new Date(endLocal).toISOString(),
    })
  }, [onChange])

  const defaultStart = timeRange ? toLocalInputValue(timeRange.start) : ''
  const defaultEnd = timeRange ? toLocalInputValue(timeRange.end) : ''

  return (
    <div
      key={formKey}
      className={cn(
        'flex flex-wrap items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2',
        className,
      )}
      role="group"
      aria-label="Time range filter"
    >
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={startId}
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
        >
          From
        </label>
        <input
          id={startId}
          ref={startRef}
          type="datetime-local"
          defaultValue={defaultStart}
          className={cn(
            'h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]',
            'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20',
          )}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={endId}
          className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]"
        >
          To
        </label>
        <input
          id={endId}
          ref={endRef}
          type="datetime-local"
          defaultValue={defaultEnd}
          className={cn(
            'h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]',
            'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20',
          )}
        />
      </div>
      <button
        type="button"
        onClick={handleApply}
        className={cn(
          'h-8 rounded-md bg-[var(--color-primary)] px-3 text-xs font-medium text-white',
          'hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        )}
      >
        Apply
      </button>
      <button
        type="button"
        onClick={handleClear}
        disabled={!timeRange}
        className={cn(
          'h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-xs text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30',
        )}
      >
        All time
      </button>
    </div>
  )
}
