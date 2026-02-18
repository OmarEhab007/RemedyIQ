'use client'

import type { ReactNode } from 'react'

import { Sidebar } from '@/components/layout/sidebar'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardLayoutProps {
  children: ReactNode
}

// ---------------------------------------------------------------------------
// DashboardLayout
//
// Desktop (lg+): persistent w-64 sidebar on the left, scrollable content area
// on the right.
//
// Mobile (< lg): sidebar hidden, hamburger button in the top-left header
// triggers MobileSidebar (Sheet overlay).
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
        {/* Desktop sidebar — hidden below lg */}
        <div className="hidden lg:flex lg:shrink-0">
          <Sidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar — mobile only */}
          <header className="flex lg:hidden h-12 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
            <MobileSidebar />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              RemedyIQ
            </span>
          </header>

          {/* Breadcrumb bar */}
          <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-2.5">
            <Breadcrumb />
          </div>

          {/* Scrollable page content */}
          <main
            id="main-content"
            className="flex-1 overflow-y-auto p-6"
            tabIndex={-1}
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
