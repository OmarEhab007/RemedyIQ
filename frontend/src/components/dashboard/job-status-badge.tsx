'use client'

/**
 * JobStatusBadge — T071
 *
 * Maps JobStatus → styled badge using JOB_STATUS_CONFIG from constants.ts.
 * Shows an animated spinner for in-progress states (parsing/analyzing/storing).
 *
 * Usage:
 *   <JobStatusBadge status="complete" />
 *   <JobStatusBadge status="parsing" showProgress progressPct={42} />
 */

import { cn } from '@/lib/utils'
import { JOB_STATUS_CONFIG } from '@/lib/constants'
import type { JobStatus } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobStatusBadgeProps {
  status: JobStatus
  showProgress?: boolean
  progressPct?: number
  className?: string
}

// ---------------------------------------------------------------------------
// In-progress states
// ---------------------------------------------------------------------------

const IN_PROGRESS: JobStatus[] = ['parsing', 'analyzing', 'storing']

// ---------------------------------------------------------------------------
// JobStatusBadge
// ---------------------------------------------------------------------------

export function JobStatusBadge({
  status,
  showProgress = false,
  progressPct,
  className,
}: JobStatusBadgeProps) {
  const config = JOB_STATUS_CONFIG[status]
  const isInProgress = IN_PROGRESS.includes(status)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
      role="status"
      aria-label={`Job status: ${config.label}${showProgress && progressPct != null ? ` (${progressPct}%)` : ''}`}
      title={config.description}
    >
      {/* Animated spinner for in-progress, static dot otherwise */}
      {isInProgress ? (
        <svg
          className="h-2.5 w-2.5 shrink-0 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: config.color }}
          aria-hidden="true"
        />
      )}

      {config.label}

      {/* Optional progress percentage */}
      {showProgress && isInProgress && progressPct != null && (
        <span className="font-mono tabular-nums opacity-80">
          {Math.round(progressPct)}%
        </span>
      )}
    </span>
  )
}
