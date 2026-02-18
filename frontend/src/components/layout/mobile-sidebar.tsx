'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/sidebar'

// ---------------------------------------------------------------------------
// MobileSidebar
//
// Renders a hamburger trigger button below the `lg` breakpoint. When
// triggered, opens a Sheet overlay that contains the full Sidebar. Closing
// is handled automatically by the Sheet component (onOpenChange) or by any
// nav link click forwarded through the Sidebar `onClose` prop.
//
// Usage (inside the dashboard layout):
//   <MobileSidebar />
// ---------------------------------------------------------------------------

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="mobile-sidebar-content"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>

        <SheetContent
          id="mobile-sidebar-content"
          side="left"
          showCloseButton={false}
          className="w-64 p-0"
          aria-label="Navigation menu"
        >
          <Sidebar onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
