'use client'

/**
 * UploadProgress — real-time job progress indicator.
 *
 * Shows a two-phase display:
 *  1. Upload percentage bar (driven by the DropZone's HTTP upload)
 *  2. Analysis phase indicator (queued → parsing → analyzing → storing → complete/failed)
 *     driven by the useJobProgress(jobId) WebSocket hook.
 *
 * Usage:
 *   <UploadProgress jobId={job.id} uploadProgress={uploadPct} />
 */

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useJobProgress } from '@/hooks/use-websocket'
import { JOB_STATUS_CONFIG, ROUTES } from '@/lib/constants'
import type { JobStatus } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadProgressProps {
  /** Analysis job ID — used to subscribe to WebSocket progress. */
  jobId: string
  /** File name displayed in the header. */
  fileName?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Phase ordering for the step indicator
// ---------------------------------------------------------------------------

const PHASES: JobStatus[] = ['queued', 'parsing', 'analyzing', 'storing', 'complete']

// ---------------------------------------------------------------------------
// PhaseStep — renders a single step circle + label
// ---------------------------------------------------------------------------

interface PhaseStepProps {
  phase: JobStatus
  currentStatus: string
}

function PhaseStep({ phase, currentStatus }: PhaseStepProps) {
  const config = JOB_STATUS_CONFIG[phase]
  const phaseIndex = PHASES.indexOf(phase)
  const currentIndex = PHASES.indexOf(currentStatus as JobStatus)

  const isComplete = currentIndex > phaseIndex
  const isActive = currentStatus === phase

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      data-testid={`phase-step-${phase}`}
      aria-current={isActive ? 'step' : undefined}
    >
      {/* Step circle */}
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300',
          isComplete && 'border-[var(--color-success)] bg-[var(--color-success)] text-white',
          isActive && !isComplete && 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white',
          !isActive && !isComplete && 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]'
        )}
        aria-hidden="true"
      >
        {isComplete ? (
          /* Checkmark */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isActive ? (
          /* Pulsing dot */
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
        ) : (
          /* Inactive dot */
          <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-xs font-medium text-center leading-tight',
          isActive && 'text-[var(--color-primary)]',
          isComplete && 'text-[var(--color-success)]',
          !isActive && !isComplete && 'text-[var(--color-text-tertiary)]'
        )}
        aria-label={`Phase: ${config.label}`}
      >
        {config.label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UploadProgress component
// ---------------------------------------------------------------------------

export function UploadProgress({ jobId, fileName, className }: UploadProgressProps) {
  const router = useRouter()
  const { progress, status, isComplete, error } = useJobProgress(jobId)

  const isFailed = status === 'failed' || Boolean(error)
  const statusConfig = JOB_STATUS_CONFIG[status as JobStatus] ?? JOB_STATUS_CONFIG.queued

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5',
        className
      )}
      role="region"
      aria-label={`Job progress: ${fileName ?? jobId}`}
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {fileName && (
            <p
              className="truncate text-sm font-medium text-[var(--color-text-primary)]"
              title={fileName}
            >
              {fileName}
            </p>
          )}
          <p
            className={cn(
              'text-xs font-medium',
              isFailed ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'
            )}
          >
            {isFailed
              ? (error ?? 'Analysis failed')
              : isComplete
              ? 'Analysis complete'
              : statusConfig.description}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
            isFailed && 'bg-[var(--color-error-light)] text-[var(--color-error)]',
            isComplete && !isFailed && 'bg-[var(--color-success-light)] text-[var(--color-success)]',
            !isFailed && !isComplete && 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
          )}
          aria-label={`Status: ${isFailed ? 'Failed' : isComplete ? 'Complete' : statusConfig.label}`}
          data-testid="progress-status-badge"
        >
          {isFailed ? 'Failed' : isComplete ? 'Complete' : statusConfig.label}
        </span>
      </div>

      {/* Overall progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Analysis progress: ${progress}%`}
        className="mb-5"
      >
        <div className="mb-1.5 flex justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">Progress</span>
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {progress}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isFailed ? 'bg-[var(--color-error)]' : 'bg-[var(--color-primary)]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase steps — not shown for failed state */}
      {!isFailed && (
        <div
          className="flex items-start gap-0"
          role="list"
          aria-label="Analysis phases"
        >
          {PHASES.map((phase, index) => (
            <div key={phase} className="flex flex-1 items-center" role="listitem">
              <div className="flex flex-1 justify-center">
                <PhaseStep phase={phase} currentStatus={status} />
              </div>
              {/* Connector line between steps */}
              {index < PHASES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-full -mt-5 transition-colors duration-300',
                    PHASES.indexOf(status as JobStatus) > index
                      ? 'bg-[var(--color-success)]'
                      : 'bg-[var(--color-border)]'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons — shown when job is complete */}
      {isComplete && !isFailed && (
        <div className="mt-4 flex items-center gap-3" data-testid="progress-actions">
          <button
            type="button"
            onClick={() => router.push(ROUTES.ANALYSIS_DETAIL(jobId))}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
            aria-label="View Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            View Dashboard
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.ANALYSIS_EXPLORER(jobId))}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            aria-label="View Explorer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            View Explorer
          </button>
        </div>
      )}

      {/* Failed error display */}
      {isFailed && error && (
        <div
          role="alert"
          data-testid="progress-error-alert"
          className="rounded-lg bg-[var(--color-error-light)] px-3 py-2"
        >
          <p className="text-xs text-[var(--color-error)]" data-testid="progress-error-text">
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
