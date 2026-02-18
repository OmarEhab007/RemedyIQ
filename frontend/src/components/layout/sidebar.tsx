'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Upload,
  BarChart3,
  Search,
  GitBranch,
  Bot,
  HelpCircle,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { ThemeToggle } from '@/components/layout/theme-toggle'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
  onClose?: () => void
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

// ---------------------------------------------------------------------------
// Nav configuration
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.UPLOAD, label: 'Upload', icon: Upload },
  { href: ROUTES.ANALYSIS, label: 'Analyses', icon: BarChart3 },
  { href: ROUTES.EXPLORER, label: 'Explorer', icon: Search },
  { href: ROUTES.TRACE, label: 'Traces', icon: GitBranch },
  { href: ROUTES.AI, label: 'AI Assistant', icon: Bot },
]

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  function isNavItemActive(href: string): boolean {
    if (href === ROUTES.HOME) return pathname === ROUTES.HOME
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function handleNavClick() {
    onClose?.()
  }

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'flex h-full w-64 flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]',
        'dark:bg-[var(--color-bg-secondary)]'
      )}
    >
      {/* Brand header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-sm"
          onClick={handleNavClick}
          aria-label="RemedyIQ home"
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-white text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            R
          </div>
          <span className="text-base font-semibold text-[var(--color-text-primary)]">
            RemedyIQ
          </span>
        </Link>

        {/* Mobile close button — only shown when controlled by parent */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <ul role="list" className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    active
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] dark:bg-[var(--color-primary-light)] dark:text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      active
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text-tertiary)]'
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bottom section: theme toggle + help */}
      <div className="border-t border-[var(--color-border)] px-2 py-3 space-y-0.5">
        <ThemeToggle />

        <Link
          href="https://docs.remedyiq.io"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true" />
          Help
        </Link>
      </div>
    </nav>
  )
}
