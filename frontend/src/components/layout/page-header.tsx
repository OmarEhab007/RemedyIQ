import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  /** Optional classes for the `<h1>` (e.g. dashboard display sizing). */
  headingClassName?: string
  /** Optional classes for the description paragraph. */
  descriptionClassName?: string
}

// ---------------------------------------------------------------------------
// PageHeader
//
// Usage:
//   <PageHeader
//     title="Analyses"
//     description="View and manage your log analysis jobs."
//     actions={<Button>Upload New</Button>}
//   />
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  className,
  headingClassName,
  descriptionClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            'text-xl font-semibold leading-tight text-[var(--color-text-primary)] truncate',
            headingClassName
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'mt-0.5 text-sm text-[var(--color-text-secondary)]',
              descriptionClassName
            )}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
