'use client'

/**
 * JobQueue — lists all analysis jobs ordered by most-recent-first.
 *
 * Each row shows: file name, status badge, progress %, creation date,
 * and entry counts (API / SQL / FLTR / ESCL). Completed jobs navigate to
 * the analysis dashboard on click. Failed jobs expose an error message
 * and a retry button.
 *
 * Usage:
 *   <JobQueue />
 */

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageState } from '@/components/ui/page-state'
import { useAnalyses, useCreateAnalysis } from '@/hooks/use-api'
import { JOB_STATUS_CONFIG, ROUTES, LOG_TYPE_COLORS } from '@/lib/constants'
import type { AnalysisJob, JobStatus } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobQueueProps {
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: JobStatus
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = JOB_STATUS_CONFIG[status]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
      aria-label={`Status: ${config.label}`}
      data-testid={`status-badge-${status}`}
    >
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CountPill — small coloured count for a log type
// ---------------------------------------------------------------------------

interface CountPillProps {
  type: 'API' | 'SQL' | 'FLTR' | 'ESCL'
  count: number
}

function CountPill({ type, count }: CountPillProps) {
  const cfg = LOG_TYPE_COLORS[type]
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      title={`${cfg.label}: ${count.toLocaleString()}`}
      aria-label={`${cfg.label} count: ${count}`}
    >
      <span className="hidden sm:inline">{cfg.label}</span>
      {formatCount(count)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// JobRow
// ---------------------------------------------------------------------------

interface JobRowProps {
  job: AnalysisJob
  onRetry: (fileId: string) => void
  isRetrying: boolean
}

function JobRow({ job, onRetry, isRetrying }: JobRowProps) {
  const router = useRouter()
  const isComplete = job.status === 'complete'
  const isFailed = job.status === 'failed'
  const isActive = !isComplete && !isFailed

  const handleRowClick = useCallback(() => {
    if (isComplete) {
      router.push(ROUTES.ANALYSIS_DETAIL(job.id))
    }
  }, [isComplete, job.id, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isComplete && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleRowClick()
      }
    },
    [isComplete, handleRowClick]
  )

  return (
    <tr
      role={isComplete ? 'row' : undefined}
      tabIndex={isComplete ? 0 : undefined}
      onClick={isComplete ? handleRowClick : undefined}
      onKeyDown={isComplete ? handleKeyDown : undefined}
      aria-label={isComplete ? `View analysis for job ${job.id}` : undefined}
      data-testid="job-row"
      className={cn(
        'border-b border-[var(--color-border)] transition-colors',
        isComplete && 'cursor-pointer hover:bg-[var(--color-bg-tertiary)] focus-visible:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
        !isComplete && 'cursor-default'
      )}
    >
      {/* File name / job ID */}
      <td className="py-3 pl-4 pr-3">
        <p
          className="max-w-[180px] truncate text-sm font-medium text-[var(--color-text-primary)] sm:max-w-xs"
          title={job.id}
        >
          {job.id}
        </p>
        {isFailed && job.error_message && (
          <p
            className="mt-0.5 max-w-xs truncate text-xs text-[var(--color-error)]"
            title={job.error_message}
          >
            {job.error_message}
          </p>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3 whitespace-nowrap">
        <StatusBadge status={job.status} />
      </td>

      {/* Progress */}
      <td className="px-3 py-3 whitespace-nowrap">
        {isActive ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                style={{ width: `${job.progress_pct}%` }}
                role="progressbar"
                aria-valuenow={job.progress_pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress: ${job.progress_pct}%`}
              />
            </div>
            <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
              {job.progress_pct}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">
            {isComplete ? '100%' : '—'}
          </span>
        )}
      </td>

      {/* Entry counts */}
      <td className="px-3 py-3">
        {(job.api_count != null || job.sql_count != null) ? (
          <div className="flex flex-wrap gap-1">
            <CountPill type="API" count={job.api_count ?? 0} />
            <CountPill type="SQL" count={job.sql_count ?? 0} />
            <CountPill type="FLTR" count={job.filter_count ?? 0} />
            <CountPill type="ESCL" count={job.esc_count ?? 0} />
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {job.processed_lines > 0
              ? `${formatCount(job.processed_lines)} lines`
              : '—'}
          </span>
        )}
      </td>

      {/* Created at */}
      <td className="px-3 py-3 whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
        {formatDate(job.created_at)}
      </td>

      {/* Actions */}
      <td className="py-3 pl-3 pr-4 text-right">
        {isFailed && (
          <Button
            variant="outline"
            size="sm"
            disabled={isRetrying}
            onClick={(e) => {
              e.stopPropagation()
              onRetry(job.file_id)
            }}
            aria-label={`Retry analysis for job ${job.id}`}
            data-testid="retry-button"
          >
            {isRetrying ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
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
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
            Retry
          </Button>
        )}
        {isComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              router.push(ROUTES.ANALYSIS_DETAIL(job.id))
            }}
            aria-label={`Open analysis dashboard for job ${job.id}`}
          >
            View
            <svg
              xmlns="http://www.w3.org/2000/svg"
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Button>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// JobQueue component
// ---------------------------------------------------------------------------

export function JobQueue({ className }: JobQueueProps) {
  const { data, isLoading, isError, refetch } = useAnalyses()
  const createAnalysis = useCreateAnalysis()

  const handleRetry = useCallback(
    (fileId: string) => {
      createAnalysis.mutate({ fileId })
    },
    [createAnalysis]
  )

  // Sort jobs: most-recent first
  const jobs = data?.jobs
    ? [...data.jobs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : []

  return (
    <section
      className={cn('rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]', className)}
      aria-label="Job queue"
    >
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Recent Jobs
        </h2>
        {jobs.length > 0 && (
          <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {jobs.length}
          </span>
        )}
      </div>

      {/* State: loading */}
      {isLoading && (
        <PageState variant="loading" rows={3} />
      )}

      {/* State: error */}
      {isError && (
        <PageState
          variant="error"
          message="Failed to load jobs."
          onRetry={() => void refetch()}
        />
      )}

      {/* State: empty */}
      {!isLoading && !isError && jobs.length === 0 && (
        <PageState
          variant="empty"
          title="No jobs yet"
          description="Upload a log file above to start your first analysis."
        />
      )}

      {/* State: table */}
      {!isLoading && !isError && jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="w-full text-left"
            aria-label="Analysis jobs"
          >
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th
                  scope="col"
                  className="py-2.5 pl-4 pr-3 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Job ID
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Progress
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Entries
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]"
                >
                  Created
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onRetry={handleRetry}
                  isRetrying={
                    createAnalysis.isPending &&
                    createAnalysis.variables?.fileId === job.file_id
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
