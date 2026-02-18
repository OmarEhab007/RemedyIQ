'use client'

/**
 * trace-comparison.tsx — Side-by-side dual waterfall comparison.
 *
 * Two trace selectors, aligned timelines, side-by-side waterfall panels.
 *
 * Usage:
 *   <TraceComparison jobId={jobId} />
 */

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useWaterfall } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import { Waterfall } from './waterfall'
import type { SpanNode } from '@/lib/api-types'
import type { WaterfallFilters } from './waterfall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceComparisonProps {
  jobId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Default filters
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: WaterfallFilters = {
  logTypes: new Set(),
  minDurationMs: 0,
  errorsOnly: false,
}

// ---------------------------------------------------------------------------
// Single trace panel
// ---------------------------------------------------------------------------

interface TracePanelProps {
  label: 'A' | 'B'
  jobId: string
  traceId: string
  onTraceIdChange: (id: string) => void
}

function TracePanel({ label, jobId, traceId, onTraceIdChange }: TracePanelProps) {
  const [selectedSpan, setSelectedSpan] = useState<SpanNode | null>(null)
  const { data, isLoading, isError, refetch } = useWaterfall(
    traceId ? jobId : null,
    traceId || null,
  )

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      {/* Trace ID input */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white"
          aria-hidden="true"
        >
          {label}
        </span>
        <label htmlFor={`tc-trace-${label}`} className="sr-only">
          Trace {label} ID
        </label>
        <input
          id={`tc-trace-${label}`}
          type="text"
          placeholder="Enter trace ID…"
          value={traceId}
          onChange={(e) => onTraceIdChange(e.target.value)}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          autoComplete="off"
          spellCheck={false}
          aria-label={`Trace ${label} ID`}
        />
      </div>

      {/* Content */}
      {!traceId && (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-tertiary)]">
          Enter a trace ID to compare
        </div>
      )}

      {traceId && isLoading && <PageState variant="loading" rows={5} />}

      {traceId && isError && (
        <PageState
          variant="error"
          message="Failed to load trace data."
          onRetry={() => void refetch()}
        />
      )}

      {traceId && data && (
        <div className="space-y-2">
          {/* Stats row */}
          <div className="flex gap-4 text-xs text-[var(--color-text-secondary)]">
            <span>
              <strong className="text-[var(--color-text-primary)]">{data.total_duration_ms.toFixed(1)}</strong> ms
            </span>
            <span>
              <strong className="text-[var(--color-text-primary)]">{data.span_count}</strong> spans
            </span>
            {data.error_count > 0 && (
              <span className="text-[var(--color-error)]">
                <strong>{data.error_count}</strong> error{data.error_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <Waterfall
            data={data}
            selectedSpanId={selectedSpan?.id ?? null}
            onSelectSpan={setSelectedSpan}
            showCriticalPath={false}
            filters={DEFAULT_FILTERS}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TraceComparison
// ---------------------------------------------------------------------------

export function TraceComparison({ jobId, className }: TraceComparisonProps) {
  const [traceIdA, setTraceIdA] = useState('')
  const [traceIdB, setTraceIdB] = useState('')

  const handleSwap = useCallback(() => {
    setTraceIdA(traceIdB)
    setTraceIdB(traceIdA)
  }, [traceIdA, traceIdB])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Trace Comparison
        </h2>
        <button
          type="button"
          onClick={handleSwap}
          disabled={!traceIdA && !traceIdB}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Swap trace A and B"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Swap
        </button>
      </div>

      {/* Panels */}
      <div className="flex gap-4 overflow-x-auto">
        <TracePanel
          label="A"
          jobId={jobId}
          traceId={traceIdA}
          onTraceIdChange={setTraceIdA}
        />

        {/* Divider */}
        <div className="hidden w-px shrink-0 bg-[var(--color-border)] lg:block" aria-hidden="true" />

        <TracePanel
          label="B"
          jobId={jobId}
          traceId={traceIdB}
          onTraceIdChange={setTraceIdB}
        />
      </div>
    </div>
  )
}
