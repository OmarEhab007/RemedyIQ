'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Layers,
  Upload,
  GitBranch,
  Bot,
  HelpCircle,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { SidebarAccount } from '@/components/layout/sidebar-account'
import { trackEvent, type WorkflowType } from '@/lib/telemetry'

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
  priority: 'core' | 'secondary'
  workflowType?: WorkflowType
  toSurface?: string
}

// ---------------------------------------------------------------------------
// Nav configuration
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.OVERVIEW, label: 'Overview', icon: LayoutDashboard, priority: 'core', toSurface: 'overview' },
  { href: ROUTES.INVESTIGATE, label: 'Investigate', icon: Search, priority: 'core', toSurface: 'investigate' },
  { href: `${ROUTES.EXPLORER}?workflow=api`, label: 'API workflow', icon: Layers, priority: 'core', workflowType: 'api', toSurface: 'investigate' },
  { href: `${ROUTES.EXPLORER}?workflow=sql`, label: 'SQL workflow', icon: Layers, priority: 'core', workflowType: 'sql', toSurface: 'investigate' },
  { href: `${ROUTES.EXPLORER}?workflow=escalation`, label: 'Escalation workflow', icon: Layers, priority: 'core', workflowType: 'escalation', toSurface: 'investigate' },
  { href: `${ROUTES.EXPLORER}?workflow=filter`, label: 'Filter workflow', icon: Layers, priority: 'core', workflowType: 'filter', toSurface: 'investigate' },
  { href: ROUTES.UPLOAD, label: 'Upload', icon: Upload, priority: 'secondary', toSurface: 'upload' },
  { href: ROUTES.TRACE, label: 'Traces', icon: GitBranch, priority: 'secondary', toSurface: 'trace' },
  { href: ROUTES.AI, label: 'AI Assistant', icon: Bot, priority: 'secondary', toSurface: 'ai' },
]

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  function isNavItemActive(href: string): boolean {
    const pathOnlyHref = href.split('?')[0]
    if (pathOnlyHref === ROUTES.HOME) return pathname === ROUTES.HOME
    return pathname === pathOnlyHref || pathname.startsWith(`${pathOnlyHref}/`)
  }

  function handleNavClick(item?: NavItem) {
    if (item) {
      trackEvent('nav_click', {
        from_surface: pathname,
        to_surface: item.toSurface ?? item.href,
        workflow_type: item.workflowType ?? null,
      })
      if (item.workflowType) {
        trackEvent('core_workflow_entered', {
          workflow_type: item.workflowType,
          entry_surface: 'sidebar',
        })
      }
    }
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
          onClick={() => handleNavClick()}
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
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Core workflows
        </p>
        <ul role="list" className="space-y-0.5">
          {NAV_ITEMS.filter((item) => item.priority === 'core').map((item) => {
            const active = isNavItemActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => handleNavClick(item)}
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

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          Secondary
        </p>
        <ul role="list" className="space-y-0.5">
          {NAV_ITEMS.filter((item) => item.priority === 'secondary').map((item) => {
            const active = isNavItemActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => handleNavClick(item)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    active
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] dark:bg-[var(--color-primary-light)] dark:text-[var(--color-primary)]'
                      : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]'
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

      {/* Bottom section: account (Clerk or dev) + theme + help */}
      <div className="border-t border-[var(--color-border)] px-2 py-3 space-y-0.5">
        <SidebarAccount />
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
