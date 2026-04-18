'use client'

/**
 * DashboardJumpNav — in-page navigation for long analysis dashboards.
 * Smooth-scrolls to overview regions and collapsible detail sections.
 */

import { useCallback, type MouseEvent } from 'react'
import { DASHBOARD_EXPAND_SECTION_EVENT, type DashboardExpandSectionDetail } from '@/lib/constants'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardJumpLink {
  href: string
  label: string
  /** Short label for compact / mobile rail */
  shortLabel?: string
}

interface DashboardJumpNavProps {
  links: DashboardJumpLink[]
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scrollToHash(hash: string) {
  const id = hash.startsWith('#') ? hash.slice(1) : hash
  if (!id) return
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Notifies collapsible sections so the target `section-*` block opens before scroll. */
export function requestDashboardSectionExpand(sectionId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<DashboardExpandSectionDetail>(DASHBOARD_EXPAND_SECTION_EVENT, {
      detail: { sectionId },
      bubbles: true,
    })
  )
}

function navigateToDashboardHash(href: string) {
  const id = href.startsWith('#') ? href.slice(1) : ''
  if (id.startsWith('section-')) {
    requestDashboardSectionExpand(id)
  }
  queueMicrotask(() => {
    scrollToHash(href)
    if (typeof window !== 'undefined' && href.startsWith('#')) {
      window.history.replaceState(null, '', href)
    }
  })
}

// ---------------------------------------------------------------------------
// DashboardJumpNav
// ---------------------------------------------------------------------------

export function DashboardJumpNav({ links, className }: DashboardJumpNavProps) {
  const onLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    navigateToDashboardHash(href)
  }, [])

  return (
    <nav
      aria-label="Jump to dashboard section"
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md shadow-sm',
        className
      )}
    >
      <p className="border-b border-[var(--color-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        On this page
      </p>
      <ul className="max-h-[min(70vh,32rem)] overflow-y-auto p-2 space-y-0.5">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              onClick={(e) => onLinkClick(e, link.href)}
              className={cn(
                'block rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]',
                'transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Horizontal strip for small viewports (complements sticky vertical nav on xl+).
 */
export function DashboardJumpNavMobile({ links, className }: DashboardJumpNavProps) {
  const onLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    navigateToDashboardHash(href)
  }, [])

  return (
    <nav
      aria-label="Jump to dashboard section"
      className={cn(
        'xl:hidden -mx-1 flex gap-1 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin]',
        className
      )}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onClick={(e) => onLinkClick(e, link.href)}
          className={cn(
            'shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]',
            'px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]',
            'whitespace-nowrap shadow-sm transition-colors',
            'hover:border-[var(--color-primary)] hover:text-[var(--color-text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
          )}
        >
          {link.shortLabel ?? link.label}
        </a>
      ))}
    </nav>
  )
}
