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

import { cn } from '@/lib/utils'
import type { FilterComplexityResponse } from '@/lib/api-types'

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

// ---------------------------------------------------------------------------
// FiltersSection
// ---------------------------------------------------------------------------

export function FiltersSection({ data, className }: FiltersSectionProps) {
  const hasExecuted = data.most_executed && data.most_executed.length > 0
  const hasPerTxn = data.filters_per_transaction && data.filters_per_transaction.length > 0

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
      {hasExecuted && (
        <div>
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Most Executed Filters
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Most executed filters">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)]">
                  {['Filter Name', 'Executions', 'Avg Duration', 'Max Duration', 'Errors', 'Form'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.most_executed.map((f, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
                      f.error_count > 0 && 'bg-[var(--color-error-light)]/10'
                    )}
                  >
                    <td className="max-w-[16rem] px-4 py-2">
                      <span
                        className="block truncate font-mono font-medium text-[var(--color-text-primary)]"
                        title={f.filter_name}
                      >
                        {f.filter_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                      {f.execution_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatDuration(f.avg_duration_ms)}
                    </td>
                    <td className="px-4 py-2 font-mono whitespace-nowrap">
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
                    <td className="px-4 py-2 font-mono whitespace-nowrap">
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
                    <td className="px-4 py-2 font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
                      {f.form || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-transaction counts */}
      {hasPerTxn && (
        <div>
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Filters Per Transaction (Top {Math.min(data.filters_per_transaction.length, 20)})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Filters per transaction">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)]">
                  {['Trace ID', 'Filter Count', 'Total Duration', 'User', 'Queue'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.filters_per_transaction.slice(0, 20).map((txn, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <td className="max-w-[12rem] px-4 py-2">
                      <span
                        className="block truncate font-mono text-[var(--color-text-primary)]"
                        title={txn.trace_id}
                      >
                        {txn.trace_id}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                      {txn.filter_count}
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatDuration(txn.total_filter_duration_ms)}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)] whitespace-nowrap truncate max-w-[6rem]" title={txn.user}>
                      {txn.user || '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--color-text-tertiary)] whitespace-nowrap">
                      {txn.queue || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
