'use client'

/**
 * FiltersSection — T062
 *
 * Renders FilterComplexityResponse:
 *   - Summary stats: avg/max filters per transaction
 *   - Most executed filters table (name, count, avg/max duration, errors)
 *   - Per-transaction filter counts table (trace ID, count, duration, user)
 *
 * Usage:
 *   <FiltersSection data={filtersData} />
 */

import { useMemo } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import type {
  FilterComplexityResponse,
  JARFilterLevelEntry,
  MostExecutedFilter,
  FilterPerTransaction,
} from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiltersSectionProps {
  data: FilterComplexityResponse
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

const MOST_EXECUTED_RESIZE: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 120, maxWidth: 560 },
  { id: 'exec', defaultWidth: 96, minWidth: 72, maxWidth: 160 },
  { id: 'avg', defaultWidth: 100, minWidth: 72, maxWidth: 180 },
  { id: 'max', defaultWidth: 100, minWidth: 72, maxWidth: 180 },
  { id: 'errors', defaultWidth: 72, minWidth: 56, maxWidth: 120 },
  { id: 'form', defaultWidth: 160, minWidth: 96, maxWidth: 400 },
]

const FILTER_LEVELS_RESIZE: ResizableColumnConfig[] = [
  { id: 'line', defaultWidth: 64, minWidth: 48, maxWidth: 100 },
  { id: 'level', defaultWidth: 72, minWidth: 56, maxWidth: 120 },
  { id: 'operation', defaultWidth: 200, minWidth: 120, maxWidth: 480 },
  { id: 'form', defaultWidth: 160, minWidth: 96, maxWidth: 400 },
]

function MostExecutedFiltersTable({ rows }: { rows: MostExecutedFilter[] }) {
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(MOST_EXECUTED_RESIZE, {
    storageKey: 'remedyiq:filters:most-executed:v1',
  })
  const headers = ['Filter Name', 'Executions', 'Avg Duration', 'Max Duration', 'Errors', 'Form'] as const

  return (
    <div className="overflow-x-auto">
      <table className="text-xs" style={tableLayoutStyle} aria-label="Most executed filters">
        <thead>
          <tr className="bg-[var(--color-bg-secondary)]">
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                style={thStyle(i)}
                className="relative box-border border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
              >
                <span className="pr-2">{h}</span>
                {renderResizeHandle(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((f, idx) => (
            <tr
              key={idx}
              className={cn(
                'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                f.error_count > 0 && 'bg-[var(--color-error-light)]/10'
              )}
            >
              <td style={tdStyle(0)} className="box-border min-w-0 px-4 py-2 align-top font-mono font-medium text-[var(--color-text-primary)] break-words whitespace-normal" title={f.filter_name}>
                {f.filter_name}
              </td>
              <td style={tdStyle(1)} className="box-border px-4 py-2 align-top font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                {f.execution_count.toLocaleString()}
              </td>
              <td style={tdStyle(2)} className="box-border px-4 py-2 align-top font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                {formatDuration(f.avg_duration_ms)}
              </td>
              <td style={tdStyle(3)} className="box-border px-4 py-2 align-top font-mono whitespace-nowrap">
                <span
                  className={
                    f.max_duration_ms > 5000
                      ? 'font-semibold text-[var(--color-error)]'
                      : f.max_duration_ms > 1000
                        ? 'text-[var(--color-warning)]'
                        : 'text-[var(--color-text-secondary)]'
                  }
                >
                  {formatDuration(f.max_duration_ms)}
                </span>
              </td>
              <td style={tdStyle(4)} className="box-border px-4 py-2 align-top font-mono whitespace-nowrap">
                <span
                  className={
                    f.error_count > 0
                      ? 'font-semibold text-[var(--color-error)]'
                      : 'text-[var(--color-text-secondary)]'
                  }
                >
                  {f.error_count}
                </span>
              </td>
              <td style={tdStyle(5)} className="box-border min-w-0 px-4 py-2 align-top font-mono text-[var(--color-text-tertiary)] break-words whitespace-normal" title={f.form ?? undefined}>
                {f.form || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilterLevelsTable({ rows }: { rows: JARFilterLevelEntry[] }) {
  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(FILTER_LEVELS_RESIZE, {
    storageKey: 'remedyiq:filters:levels:v1',
  })
  const headers = ['Line', 'Level', 'Operation', 'Form'] as const

  return (
    <div className="overflow-x-auto">
      <table className="text-xs" style={tableLayoutStyle} aria-label="Filter nesting levels">
        <thead>
          <tr className="bg-[var(--color-bg-secondary)]">
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                style={thStyle(i)}
                className="relative box-border border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
              >
                <span className="pr-2">{h}</span>
                {renderResizeHandle(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fl, idx) => (
            <tr
              key={idx}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td style={tdStyle(0)} className="box-border px-4 py-2 align-top font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                {fl.line_number}
              </td>
              <td style={tdStyle(1)} className="box-border px-4 py-2 align-top font-mono whitespace-nowrap">
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                    fl.filter_level > 5
                      ? 'bg-[var(--color-warning-light,rgba(234,179,8,0.15))] text-[var(--color-warning)] font-bold'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                  )}
                >
                  {fl.filter_level}
                </span>
              </td>
              <td style={tdStyle(2)} className="box-border min-w-0 px-4 py-2 align-top font-mono text-[var(--color-text-primary)] break-words whitespace-normal" title={fl.operation ?? undefined}>
                {fl.operation || '—'}
              </td>
              <td style={tdStyle(3)} className="box-border min-w-0 px-4 py-2 align-top text-[var(--color-text-secondary)] break-words whitespace-normal" title={fl.form ?? undefined}>
                {fl.form || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PerTransactionFiltersTable({
  rows,
  hasFps,
}: {
  rows: FilterPerTransaction[]
  hasFps: boolean
}) {
  const resizeSpec = useMemo((): ResizableColumnConfig[] => {
    const spec: ResizableColumnConfig[] = [
      { id: 'trace', defaultWidth: 168, minWidth: 96, maxWidth: 420 },
      { id: 'count', defaultWidth: 92, minWidth: 64, maxWidth: 140 },
    ]
    if (hasFps) spec.push({ id: 'fps', defaultWidth: 96, minWidth: 72, maxWidth: 160 })
    spec.push(
      { id: 'duration', defaultWidth: 112, minWidth: 80, maxWidth: 200 },
      { id: 'user', defaultWidth: 100, minWidth: 72, maxWidth: 220 },
      { id: 'queue', defaultWidth: 128, minWidth: 72, maxWidth: 360 },
    )
    return spec
  }, [hasFps])

  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(resizeSpec, {
    storageKey: `remedyiq:filters:per-txn:v1:${hasFps ? 'fps' : 'nofps'}`,
  })

  const iDuration = hasFps ? 3 : 2
  const iUser = hasFps ? 4 : 3
  const iQueue = hasFps ? 5 : 4

  const headerLabels = ['Trace ID', 'Filter Count', ...(hasFps ? ['Filters/sec'] : []), 'Total Duration', 'User', 'Queue'] as const

  return (
    <div className="overflow-x-auto">
      <table className="text-xs" style={tableLayoutStyle} aria-label="Filters per transaction">
        <thead>
          <tr className="bg-[var(--color-bg-secondary)]">
            {headerLabels.map((h, i) => (
              <th
                key={h}
                scope="col"
                style={thStyle(i)}
                className="relative box-border border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
              >
                <span className="pr-2">{h}</span>
                {renderResizeHandle(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((txn, idx) => (
            <tr
              key={idx}
              className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td style={tdStyle(0)} className="box-border min-w-0 px-4 py-2 align-top font-mono text-[var(--color-text-primary)] break-all whitespace-normal" title={txn.trace_id}>
                {txn.trace_id}
              </td>
              <td style={tdStyle(1)} className="box-border px-4 py-2 align-top font-mono font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                {txn.filter_count}
              </td>
              {hasFps && (
                <td style={tdStyle(2)} className="box-border px-4 py-2 align-top font-mono whitespace-nowrap">
                  {txn.filters_per_sec != null ? (
                    <span
                      className={cn(
                        'tabular-nums',
                        txn.filters_per_sec > 100
                          ? 'font-semibold text-[var(--color-warning)]'
                          : 'text-[var(--color-text-secondary)]'
                      )}
                    >
                      {txn.filters_per_sec.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)]">—</span>
                  )}
                </td>
              )}
              <td style={tdStyle(iDuration)} className="box-border px-4 py-2 align-top font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                {formatDuration(txn.total_filter_duration_ms)}
              </td>
              <td style={tdStyle(iUser)} className="box-border min-w-0 px-4 py-2 align-top text-[var(--color-text-secondary)] break-words whitespace-normal" title={txn.user ?? undefined}>
                {txn.user || '—'}
              </td>
              <td style={tdStyle(iQueue)} className="box-border min-w-0 px-4 py-2 align-top font-mono text-[var(--color-text-tertiary)] break-words whitespace-normal" title={txn.queue ?? undefined}>
                {txn.queue || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FiltersSection
// ---------------------------------------------------------------------------

export function FiltersSection({ data, className }: FiltersSectionProps) {
  const hasExecuted = data.most_executed && data.most_executed.length > 0
  const hasPerTxn = data.filters_per_transaction && data.filters_per_transaction.length > 0
  const hasFilterLevels = data.filter_levels && data.filter_levels.length > 0
  const hasFps = Boolean(hasPerTxn && data.filters_per_transaction.some((t) => t.filters_per_sec != null))

  if (!hasExecuted && !hasPerTxn) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
        No filter complexity data available for this job.
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-[var(--color-border-light)]', className)}>
      {/* Summary stats */}
      <div className="flex flex-wrap gap-6 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--color-text-secondary)]">Avg Filters/Transaction</span>
          <span className="text-lg font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
            {(data.avg_filters_per_transaction ?? 0).toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--color-text-secondary)]">Max Filters/Transaction</span>
          <span
            className={cn(
              'text-lg font-bold font-mono tabular-nums',
              (data.max_filters_per_transaction ?? 0) > 50
                ? 'text-[var(--color-error)]'
                : (data.max_filters_per_transaction ?? 0) > 20
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-primary)]'
            )}
          >
            {data.max_filters_per_transaction ?? 0}
          </span>
        </div>
      </div>

      {/* Most executed filters */}
      {hasExecuted && data.most_executed && (
        <div>
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Most Executed Filters
            </h4>
          </div>
          <MostExecutedFiltersTable rows={data.most_executed} />
        </div>
      )}

      {/* Filter Levels — nesting depth per transaction */}
      {hasFilterLevels && data.filter_levels && (
        <div>
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Filter Levels (Nesting Depth)
            </h4>
          </div>
          <FilterLevelsTable rows={data.filter_levels as JARFilterLevelEntry[]} />
        </div>
      )}

      {/* Per-transaction counts */}
      {hasPerTxn && data.filters_per_transaction && (
        <div>
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Filters Per Transaction (Top {Math.min(data.filters_per_transaction.length, 20)})
            </h4>
          </div>
          <PerTransactionFiltersTable rows={data.filters_per_transaction.slice(0, 20)} hasFps={hasFps} />
        </div>
      )}
    </div>
  )
}
