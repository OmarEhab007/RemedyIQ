'use client'

/**
 * trace-search.tsx — Search form for finding traces.
 *
 * Fields: trace ID, user, thread ID, min/max duration, has_errors toggle.
 * Results list renders TransactionSummary rows.
 * Navigates to /analysis/{jobId}/trace/{traceId} on row click.
 *
 * Usage:
 *   <TraceSearch jobId={jobId} />
 */

import { useState, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS, ROUTES } from '@/lib/constants'
import { useSearchTransactions } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import type { TransactionSearchParams, TransactionSummary, LogType } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceSearchProps {
  jobId: string
  className?: string
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

interface ResultRowProps {
  txn: TransactionSummary
  onNavigate: (traceId: string) => void
}

function ResultRow({ txn, onNavigate }: ResultRowProps) {
  return (
    <tr
      role="row"
      className="cursor-pointer border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      onClick={() => onNavigate(txn.trace_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onNavigate(txn.trace_id)
        }
      }}
      tabIndex={0}
      aria-label={`Trace ${txn.trace_id}, ${txn.duration_ms.toFixed(1)} ms, user ${txn.user}`}
    >
      {/* Trace ID */}
      <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-primary)]">
        <span className="truncate block max-w-[120px]" title={txn.trace_id}>
          {txn.trace_id.slice(0, 12)}…
        </span>
      </td>

      {/* User */}
      <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
        {txn.user || '—'}
      </td>

      {/* Queue */}
      <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        {txn.queue || '—'}
      </td>

      {/* Duration */}
      <td className="px-3 py-2 text-right tabular-nums text-sm font-medium text-[var(--color-text-primary)]">
        {txn.duration_ms.toFixed(1)} ms
      </td>

      {/* Spans */}
      <td className="px-3 py-2 text-right text-xs text-[var(--color-text-secondary)]">
        {txn.span_count}
      </td>

      {/* Log types */}
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {(txn.log_types ?? []).map((t) => {
            const cfg = LOG_TYPE_COLORS[t as LogType]
            return (
              <span
                key={t}
                className="rounded px-1 py-0.5 text-[10px] font-semibold leading-none"
                style={{ backgroundColor: cfg?.bg ?? '#ccc', color: cfg?.text ?? '#000' }}
              >
                {cfg?.label ?? t}
              </span>
            )
          })}
        </div>
      </td>

      {/* Error indicator */}
      <td className="px-3 py-2 text-center">
        {txn.has_errors ? (
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-error)]" aria-label="Has errors" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" aria-label="No errors" />
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// TraceSearch
// ---------------------------------------------------------------------------

export function TraceSearch({ jobId, className }: TraceSearchProps) {
  const router = useRouter()
  const [params, setParams] = useState<TransactionSearchParams>({})
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [traceId, setTraceId] = useState('')
  const [user, setUser] = useState('')
  const [threadId, setThreadId] = useState('')
  const [hasErrors, setHasErrors] = useState<boolean | undefined>(undefined)

  const { data, isLoading, isError, refetch } = useSearchTransactions(
    submitted ? jobId : null,
    params,
  )

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const p: TransactionSearchParams = {}
      if (traceId.trim()) p.trace_id = traceId.trim()
      if (user.trim()) p.user = user.trim()
      if (threadId.trim()) p.thread_id = threadId.trim()
      if (hasErrors !== undefined) p.has_errors = hasErrors
      setParams(p)
      setSubmitted(true)
    },
    [traceId, user, threadId, hasErrors],
  )

  const handleNavigate = useCallback(
    (tId: string) => {
      router.push(ROUTES.ANALYSIS_TRACE(jobId, tId))
    },
    [router, jobId],
  )

  const inputClass =
    'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

  const labelClass = 'text-xs font-semibold text-[var(--color-text-secondary)] mb-1 block'

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
        aria-label="Search traces"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Trace ID */}
          <div>
            <label htmlFor="ts-trace-id" className={labelClass}>
              Trace ID
            </label>
            <input
              id="ts-trace-id"
              type="text"
              placeholder="e.g. abc-123"
              value={traceId}
              onChange={(e) => setTraceId(e.target.value)}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* User */}
          <div>
            <label htmlFor="ts-user" className={labelClass}>
              User
            </label>
            <input
              id="ts-user"
              type="text"
              placeholder="AR Server user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Thread ID */}
          <div>
            <label htmlFor="ts-thread-id" className={labelClass}>
              Thread ID
            </label>
            <input
              id="ts-thread-id"
              type="text"
              placeholder="e.g. thr-001"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Errors filter */}
          <div className="flex flex-col justify-end">
            <span className={labelClass}>Errors</span>
            <div className="flex items-center gap-2">
              {(
                [
                  { label: 'Any', value: undefined },
                  { label: 'Yes', value: true },
                  { label: 'No', value: false },
                ] as const
              ).map(({ label, value }) => (
                <label key={label} className="flex cursor-pointer items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ts-has-errors"
                    checked={hasErrors === value}
                    onChange={() => setHasErrors(value)}
                    className="accent-[var(--color-primary)]"
                    aria-label={`Has errors: ${label}`}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                Searching…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search
              </>
            )}
          </button>

          {submitted && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {data?.total ?? 0} result{data?.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </form>

      {/* Results */}
      {submitted && (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          {isLoading && <PageState variant="loading" rows={4} />}

          {isError && (
            <PageState
              variant="error"
              message="Failed to search transactions. Please try again."
              onRetry={() => void refetch()}
            />
          )}

          {!isLoading && !isError && data && (
            <>
              {data.transactions.length === 0 ? (
                <PageState
                  variant="empty"
                  title="No transactions found"
                  description="Try adjusting your search criteria."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm" role="table">
                    <thead>
                      <tr className="bg-[var(--color-bg-secondary)]">
                        {['Trace ID', 'User', 'Queue', 'Duration', 'Spans', 'Types', 'Status'].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="border-b border-[var(--color-border)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((txn) => (
                        <ResultRow key={txn.trace_id} txn={txn} onNavigate={handleNavigate} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
