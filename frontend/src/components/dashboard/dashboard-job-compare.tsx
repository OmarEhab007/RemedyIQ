'use client'

/**
 * Compares two completed analysis jobs (baseline vs reference) for AR admin triage:
 * entry volumes, unique queues proxy (from totals), and error rate from distribution.
 */

import { useMemo, useState } from 'react'
import { useDashboard, useAnalyses } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import type { AnalysisJob, GeneralStatistics } from '@/lib/api-types'

export interface DashboardJobCompareProps {
  currentJobId: string
  className?: string
}

function errorRateFromDistribution(d: { distribution?: { error_rate?: number } } | undefined): number {
  return d?.distribution?.error_rate ?? 0
}

function StatRow({
  label,
  left,
  right,
}: {
  label: string
  left: string | number
  right: string | number
}) {
  return (
    <tr className="border-b border-[var(--color-border-light)]">
      <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </th>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--color-text-primary)]">{left}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-[var(--color-text-primary)]">{right}</td>
    </tr>
  )
}

function volumeStats(s: GeneralStatistics) {
  return s.api_count + s.sql_count + s.filter_count + s.esc_count
}

export function DashboardJobCompare({ currentJobId, className }: DashboardJobCompareProps) {
  const { data: analyses } = useAnalyses()
  const [refJobId, setRefJobId] = useState('')

  const jobs = useMemo(() => {
    const list = analyses?.jobs ?? []
    return list
      .filter((j) => j.status === 'complete' && j.id !== currentJobId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [analyses?.jobs, currentJobId])

  const { data: leftDash, isLoading: leftLoading } = useDashboard(currentJobId)
  const { data: rightDash, isLoading: rightLoading } = useDashboard(refJobId || null, {
    enabled: Boolean(refJobId),
  })

  const left = leftDash?.general_stats
  const right = rightDash?.general_stats

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm',
        className,
      )}
      aria-label="Compare to another analysis job"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Compare jobs</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Baseline is this analysis; pick a reference job.</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          <span className="font-medium">Reference job</span>
          <select
            value={refJobId}
            onChange={(e) => setRefJobId(e.target.value)}
            className="min-w-[14rem] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Select reference analysis job"
          >
            <option value="">— None —</option>
            {jobs.map((j: AnalysisJob) => (
              <option key={j.id} value={j.id}>
                {j.id.slice(0, 8)}… · {new Date(j.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!refJobId ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">Select a reference job to compare volumes and error rate.</p>
      ) : leftLoading || rightLoading ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Loading comparison…</p>
      ) : !left || !right ? (
        <p className="text-xs text-[var(--color-error)]">Could not load one or both dashboards.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <th scope="col" className="px-3 py-2">Metric</th>
                <th scope="col" className="px-3 py-2 text-right">This job</th>
                <th scope="col" className="px-3 py-2 text-right">Reference</th>
              </tr>
            </thead>
            <tbody>
              <StatRow label="Total entries" left={volumeStats(left).toLocaleString()} right={volumeStats(right).toLocaleString()} />
              <StatRow label="API" left={left.api_count.toLocaleString()} right={right.api_count.toLocaleString()} />
              <StatRow label="SQL" left={left.sql_count.toLocaleString()} right={right.sql_count.toLocaleString()} />
              <StatRow label="Filters" left={left.filter_count.toLocaleString()} right={right.filter_count.toLocaleString()} />
              <StatRow label="Escalations" left={left.esc_count.toLocaleString()} right={right.esc_count.toLocaleString()} />
              <StatRow
                label="Error rate"
                left={`${(errorRateFromDistribution(leftDash) * 100).toFixed(2)}%`}
                right={`${(errorRateFromDistribution(rightDash) * 100).toFixed(2)}%`}
              />
              <StatRow
                label="JAR error events (summary)"
                left={(leftDash?.error_summary?.jar_event_total ?? 0).toLocaleString()}
                right={(rightDash?.error_summary?.jar_event_total ?? 0).toLocaleString()}
              />
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
