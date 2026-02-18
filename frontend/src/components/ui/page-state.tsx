import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadingStateProps {
  variant: 'loading'
  /** Number of skeleton rows to render. Defaults to 4. */
  rows?: number
  className?: string
}

interface EmptyStateProps {
  variant: 'empty'
  title: string
  description?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

interface ErrorStateProps {
  variant: 'error'
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export type PageStateProps = LoadingStateProps | EmptyStateProps | ErrorStateProps

// ---------------------------------------------------------------------------
// Loading state — animated skeleton bars
// ---------------------------------------------------------------------------

function LoadingState({ rows = 4, className }: Omit<LoadingStateProps, 'variant'>) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      className={cn('w-full space-y-3 p-6', className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          {/* Narrow prefix bar — mimics row numbering or icon */}
          <div
            className="h-4 w-8 animate-pulse rounded-md bg-[var(--color-border)]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
          {/* Main bar — varying widths to look natural */}
          <div
            className="h-4 animate-pulse rounded-md bg-[var(--color-border)]"
            style={{
              width: `${65 + ((i * 17) % 30)}%`,
              animationDelay: `${i * 60 + 30}ms`,
            }}
          />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default empty icon (inbox / document)
// ---------------------------------------------------------------------------

function DefaultEmptyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-text-tertiary)]"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: Omit<EmptyStateProps, 'variant'>) {
  return (
    <div
      role="status"
      aria-label={title}
      className={cn(
        'flex min-h-[240px] flex-col items-center justify-center gap-4 p-8 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
        {icon ?? <DefaultEmptyIcon />}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: Omit<ErrorStateProps, 'variant'>) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-lg border border-[var(--color-error-light)] bg-[var(--color-error-light)] p-8 text-center',
        className
      )}
    >
      {/* Icon */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-white/60 dark:bg-black/20"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-error)]"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--color-error)]">
          {title}
        </h3>
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
          {message}
        </p>
      </div>

      {/* Retry */}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-error)] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)] focus-visible:ring-offset-2"
        >
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
          Try Again
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unified PageState component
//
// Usage:
//   <PageState variant="loading" rows={3} />
//   <PageState variant="empty" title="No logs found" description="Upload a log file to get started." action={{ label: 'Upload', onClick: () => router.push('/upload') }} />
//   <PageState variant="error" message="Failed to fetch data." onRetry={refetch} />
// ---------------------------------------------------------------------------

export function PageState(props: PageStateProps) {
  switch (props.variant) {
    case 'loading':
      return <LoadingState rows={props.rows} className={props.className} />

    case 'empty':
      return (
        <EmptyState
          title={props.title}
          description={props.description}
          icon={props.icon}
          action={props.action}
          className={props.className}
        />
      )

    case 'error':
      return (
        <ErrorState
          title={props.title}
          message={props.message}
          onRetry={props.onRetry}
          className={props.className}
        />
      )
  }
}
