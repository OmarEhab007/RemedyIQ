'use client'

/**
 * CollapsibleSection — T057
 *
 * Expandable section wrapper with lazy-loaded content. Children are not
 * rendered until the section is first expanded. Shows a loading skeleton
 * while the `isLoading` prop is true.
 *
 * Usage:
 *   <CollapsibleSection
 *     title="Aggregates"
 *     isLoading={isLoading}
 *     onExpand={() => fetchData()}
 *   >
 *     <AggregatesSection data={data} />
 *   </CollapsibleSection>
 */

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/shared/error-boundary'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  isLoading?: boolean
  /** Called once when the section is first expanded. */
  onExpand?: () => void
  children: ReactNode
  className?: string
  /** Number of skeleton rows to show while loading. Defaults to 4. */
  skeletonRows?: number
  /** Optional badge/count displayed in the header. */
  badge?: ReactNode
}

// ---------------------------------------------------------------------------
// CollapsibleSection
// ---------------------------------------------------------------------------

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  isLoading = false,
  onExpand,
  children,
  className,
  skeletonRows = 4,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [hasExpanded, setHasExpanded] = useState(defaultOpen)
  const onExpandRef = useRef(onExpand)
  onExpandRef.current = onExpand

  // Fire onExpand once after the first expansion renders
  const justExpanded = useRef(false)
  useEffect(() => {
    if (justExpanded.current) {
      justExpanded.current = false
      onExpandRef.current?.()
    }
  })

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next && !hasExpanded) {
        setHasExpanded(true)
        justExpanded.current = true
      }
      return next
    })
  }, [hasExpanded])

  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, '-')}`
  const contentId = `${sectionId}-content`

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden',
        className
      )}
      aria-labelledby={sectionId}
    >
      {/* Header button */}
      <button
        id={sectionId}
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-5 py-4',
          'text-left transition-colors',
          'hover:bg-[var(--color-bg-secondary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]'
        )}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* Chevron */}
          <svg
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200',
              isOpen && 'rotate-90'
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

          <div className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {title}
            </span>
            {description && (
              <span className="block text-xs text-[var(--color-text-secondary)] truncate">
                {description}
              </span>
            )}
          </div>
        </div>

        {/* Badge */}
        {badge && (
          <div className="shrink-0" aria-hidden="true">
            {badge}
          </div>
        )}

        {/* Loading spinner */}
        {isOpen && isLoading && (
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-[var(--color-primary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        )}
      </button>

      {/* Content panel */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={sectionId}
        hidden={!isOpen}
      >
        {isOpen && (
          <div className="border-t border-[var(--color-border)]">
            {isLoading ? (
              <div className="px-5 py-4 space-y-3" aria-busy="true" aria-label="Loading section content">
                {Array.from({ length: skeletonRows }, (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-4"
                    style={{ width: `${70 + ((i * 13) % 25)}%`, animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>
            ) : (
              <div className="px-0 py-0">
                <ErrorBoundary
                  fallback={(error, reset) => (
                    <div role="alert" className="flex items-center gap-3 px-5 py-4 text-sm text-[var(--color-error)]">
                      <span>Failed to render section: {error.message}</span>
                      <button
                        type="button"
                        onClick={reset}
                        className="shrink-0 rounded-md border border-[var(--color-error)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-error-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                >
                  {hasExpanded ? children : null}
                </ErrorBoundary>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
