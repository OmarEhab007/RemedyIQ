'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

import { cn } from '@/lib/utils'
import { truncate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Segment label map
// ---------------------------------------------------------------------------

const SEGMENT_LABELS: Record<string, string> = {
  analysis: 'Analyses',
  explorer: 'Explorer',
  trace: 'Traces',
  ai: 'AI Assistant',
  upload: 'Upload',
  settings: 'Settings',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadcrumbSegment {
  label: string
  href: string
  isCurrent: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSegments(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split('/').filter(Boolean)
  const segments: BreadcrumbSegment[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const href = '/' + parts.slice(0, i + 1).join('/')
    const isCurrent = i === parts.length - 1

    const knownLabel = SEGMENT_LABELS[part]
    let label: string

    if (knownLabel) {
      label = knownLabel
    } else if (part.startsWith('[') && part.endsWith(']')) {
      // Template segment — not expected in real pathnames but guard anyway
      label = part.slice(1, -1)
    } else {
      // Dynamic ID segment — truncate if very long
      label = truncate(part, 12)
    }

    segments.push({ label, href, isCurrent })
  }

  return segments
}

// ---------------------------------------------------------------------------
// Breadcrumb component
// ---------------------------------------------------------------------------

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = buildSegments(pathname)

  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center">
        <span
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]"
          aria-current="page"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Home</span>
        </span>
      </nav>
    )
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol
        role="list"
        className="flex items-center gap-1 text-sm"
      >
        {/* Home crumb — always present */}
        <li className="flex items-center">
          <Link
            href="/"
            aria-label="Home"
            className={cn(
              'flex items-center text-[var(--color-text-secondary)] transition-colors',
              'hover:text-[var(--color-text-primary)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm'
            )}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </li>

        {segments.map((segment) => (
          <li key={segment.href} className="flex items-center gap-1">
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            />

            {segment.isCurrent ? (
              <span
                aria-current="page"
                className={cn(
                  'font-medium text-[var(--color-text-primary)]',
                  // On mobile: only show the last (current) segment
                  'block'
                )}
              >
                {segment.label}
              </span>
            ) : (
              <Link
                href={segment.href}
                className={cn(
                  'text-[var(--color-text-secondary)] transition-colors',
                  'hover:text-[var(--color-text-primary)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm',
                  // On mobile: hide ancestor breadcrumbs to save space
                  'hidden sm:inline'
                )}
              >
                {segment.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
