'use client'

/**
 * Analysis List Page — T070 (Reworked)
 *
 * Route: /analysis
 *
 * Card-based job list with:
 *   - Status filter pills (All, Complete, Running, Failed)
 *   - Compact job cards with status accent, relative time, counts
 *   - Click card → navigate to /analysis/{id}
 *   - Empty/loading/error states
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAnalyses } from '@/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { PageState } from '@/components/ui/page-state'
import { JobStatusBadge } from '@/components/dashboard/job-status-badge'
import { ROUTES } from '@/lib/constants'
import type { AnalysisJob, JobStatus } from '@/lib/api-types'
import { cn, formatRelativeTime, formatCompactNumber, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'complete' | 'running' | 'failed'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IN_PROGRESS_STATUSES: JobStatus[] = ['queued', 'parsing', 'analyzing', 'storing']

function isInProgress(status: JobStatus): boolean {
  return IN_PROGRESS_STATUSES.includes(status)
}

function getStatusAccentColor(status: JobStatus): string {
  switch (status) {
    case 'complete':
      return 'var(--color-success)'
    case 'failed':
      return 'var(--color-error)'
    default:
      return 'var(--color-primary)'
  }
}

// ---------------------------------------------------------------------------
// StatusFilterBar
// ---------------------------------------------------------------------------

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Complete' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
]

interface StatusFilterBarProps {
  value: StatusFilter
  onChange: (v: StatusFilter) => void
  counts: Record<string, number>
}

function StatusFilterBar({ value, onChange, counts }: StatusFilterBarProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter analyses by status"
    >
      {STATUS_FILTER_OPTIONS.map(({ value: optValue, label }) => {
        const count =
          optValue === 'all'
            ? counts.all
            : optValue === 'running'
              ? (counts.queued ?? 0) + (counts.parsing ?? 0) + (counts.analyzing ?? 0) + (counts.storing ?? 0)
              : (counts[optValue] ?? 0)

        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
              value === optValue
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            )}
            aria-pressed={value === optValue}
          >
            {label}
            {count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  value === optValue
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CountPill — small inline count badge for log type
// ---------------------------------------------------------------------------

function CountPill({
  label,
  value,
  color,
}: {
  label: string
  value: number | undefined
  color: string
}) {
  if (value == null || value === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-[var(--color-text-tertiary)] hidden sm:inline">{label}</span>
      <span className="font-mono font-medium text-[var(--color-text-secondary)]">
        {formatCompactNumber(value)}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// JobCard
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: AnalysisJob
  isExpanded: boolean
  onToggle: () => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] shrink-0 w-28">{label}</span>
      <span className="text-xs text-[var(--color-text-primary)] min-w-0">{value}</span>
    </div>
  )
}

function JobCard({ job, isExpanded, onToggle }: JobCardProps) {
  const router = useRouter()
  const accentColor = getStatusAccentColor(job.status)
  const hasCounts = (job.api_count ?? 0) + (job.sql_count ?? 0) + (job.filter_count ?? 0) + (job.esc_count ?? 0) > 0

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all',
        isExpanded && 'shadow-md border-[var(--color-primary)]/40',
        job.status === 'failed' && 'border-[var(--color-error)]/30'
      )}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />

      {/* Clickable header */}
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-4 p-4 text-left transition-colors',
          'hover:bg-[var(--color-bg-secondary)]/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset',
          isExpanded && 'pb-2'
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Analysis job ${job.id.slice(0, 8)}, status: ${job.status}`}
      >
        {/* Main content */}
        <div className="min-w-0 flex-1 pl-2">
          {/* Row 1: ID + Status */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]" title={job.id}>
              {job.id.slice(0, 8)}
            </span>
            <JobStatusBadge
              status={job.status}
              showProgress={isInProgress(job.status)}
              progressPct={job.progress_pct}
            />
          </div>

          {/* Row 2: Time + Duration */}
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-tertiary)]">
            <span title={job.created_at}>
              {formatRelativeTime(job.created_at)}
            </span>
            {job.log_duration && (
              <>
                <span aria-hidden="true">·</span>
                <span>{job.log_duration}</span>
              </>
            )}
          </div>

          {/* Row 3: Counts (only when available) */}
          {hasCounts && (
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <CountPill label="API" value={job.api_count} color="var(--color-primary)" />
              <CountPill label="SQL" value={job.sql_count} color="var(--color-success)" />
              <CountPill label="FLTR" value={job.filter_count} color="var(--color-warning)" />
              <CountPill label="ESCL" value={job.esc_count} color="var(--color-escalation)" />
            </div>
          )}

          {/* Row 4: Error message */}
          {job.error_message && (
            <p
              className="mt-1.5 text-xs text-[var(--color-error)] truncate max-w-md"
              title={job.error_message}
            >
              {job.error_message}
            </p>
          )}
        </div>

        {/* Chevron — rotates on expand */}
        <svg
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200',
            isExpanded ? 'rotate-90' : 'group-hover:translate-x-0.5'
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Expanded detail panel */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="border-t border-[var(--color-border-light)] px-4 pb-4 pt-3 pl-6 space-y-2">
          <DetailRow label="Job ID" value={<span className="font-mono text-[11px]">{job.id}</span>} />
          {job.log_start && job.log_end && (
            <DetailRow
              label="Log Time Range"
              value={
                <span className="font-mono text-[11px]">
                  {formatDate(job.log_start)} — {formatDate(job.log_end)}
                  {job.log_duration && <span className="text-[var(--color-text-tertiary)] ml-1">({job.log_duration})</span>}
                </span>
              }
            />
          )}
          {job.processed_lines > 0 && (
            <DetailRow label="Processed Lines" value={formatCompactNumber(job.processed_lines)} />
          )}
          {hasCounts && (
            <DetailRow
              label="Type Breakdown"
              value={
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'API', value: job.api_count, bg: 'var(--color-primary)' },
                    { label: 'SQL', value: job.sql_count, bg: 'var(--color-success)' },
                    { label: 'FLTR', value: job.filter_count, bg: 'var(--color-warning)' },
                    { label: 'ESCL', value: job.esc_count, bg: 'var(--color-escalation)' },
                  ].filter((t) => (t.value ?? 0) > 0).map((t) => (
                    <span
                      key={t.label}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `color-mix(in srgb, ${t.bg} 15%, transparent)`, color: t.bg }}
                    >
                      {t.label} {formatCompactNumber(t.value)}
                    </span>
                  ))}
                </div>
              }
            />
          )}
          <DetailRow label="Created At" value={formatDate(job.created_at)} />
          {job.completed_at && <DetailRow label="Completed At" value={formatDate(job.completed_at)} />}
          {job.error_message && (
            <DetailRow
              label="Error"
              value={<span className="text-[var(--color-error)]">{job.error_message}</span>}
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                router.push(ROUTES.ANALYSIS_DETAIL(job.id))
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              View Dashboard
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                router.push(ROUTES.ANALYSIS_EXPLORER(job.id))
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              View Explorer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnalysisListPage
// ---------------------------------------------------------------------------

export default function AnalysisListPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const {
    data: analyses,
    isLoading,
    isError,
    refetch,
  } = useAnalyses()

  const jobs = analyses?.jobs ?? []

  // Count by status
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length }
    for (const job of jobs) {
      c[job.status] = (c[job.status] ?? 0) + 1
    }
    return c
  }, [jobs])

  // Filtered jobs
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return jobs
    if (statusFilter === 'running') {
      return jobs.filter((j) => IN_PROGRESS_STATUSES.includes(j.status))
    }
    return jobs.filter((j) => j.status === statusFilter)
  }, [jobs, statusFilter])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--color-border)]" />
        <PageState variant="loading" rows={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <PageState
        variant="error"
        message="Failed to load analyses. Please check your connection and try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analyses"
        description="View and manage your log analysis jobs."
        actions={
          <button
            type="button"
            onClick={() => router.push(ROUTES.UPLOAD)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload New Log
          </button>
        }
      />

      {/* Status filter */}
      <StatusFilterBar
        value={statusFilter}
        onChange={setStatusFilter}
        counts={counts}
      />

      {/* Empty state */}
      {jobs.length === 0 ? (
        <PageState
          variant="empty"
          title="No analyses yet"
          description="Upload an AR Server log file to start your first analysis."
          action={{
            label: 'Upload Log File',
            onClick: () => router.push(ROUTES.UPLOAD),
          }}
        />
      ) : filtered.length === 0 ? (
        <PageState
          variant="empty"
          title={`No ${statusFilter} analyses`}
          description="Try a different status filter."
          action={{
            label: 'Show All',
            onClick: () => setStatusFilter('all'),
          }}
        />
      ) : (
        <div className="space-y-2">
          {/* Job cards */}
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isExpanded={expandedJobId === job.id}
              onToggle={() => setExpandedJobId((prev) => prev === job.id ? null : job.id)}
            />
          ))}

          {/* Footer count */}
          <p className="pt-1 text-xs text-[var(--color-text-tertiary)]">
            Showing {filtered.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
