'use client'

/**
 * view-switcher.tsx — Tab bar: Waterfall | Flame Graph | Span List.
 *
 * Preserves selected span across tab switches.
 *
 * Usage:
 *   <ViewSwitcher activeView={view} onChangeView={setView} spanCount={data.span_count} />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TraceView = 'waterfall' | 'flame-graph' | 'span-list'

interface ViewOption {
  id: TraceView
  label: string
  icon: React.ReactNode
}

interface ViewSwitcherProps {
  activeView: TraceView
  onChangeView: (view: TraceView) => void
  spanCount?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

const WaterfallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="10" x2="15" y2="10" />
    <line x1="3" y1="14" x2="18" y2="14" />
    <line x1="3" y1="18" x2="12" y2="18" />
  </svg>
)

const FlameIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
)

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

// ---------------------------------------------------------------------------
// View options
// ---------------------------------------------------------------------------

const VIEW_OPTIONS: ViewOption[] = [
  { id: 'waterfall', label: 'Waterfall', icon: <WaterfallIcon /> },
  { id: 'flame-graph', label: 'Flame Graph', icon: <FlameIcon /> },
  { id: 'span-list', label: 'Span List', icon: <ListIcon /> },
]

// ---------------------------------------------------------------------------
// ViewSwitcher
// ---------------------------------------------------------------------------

export function ViewSwitcher({
  activeView,
  onChangeView,
  spanCount,
  className,
}: ViewSwitcherProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIdx = VIEW_OPTIONS.findIndex((v) => v.id === activeView)
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const nextIdx = (currentIdx + dir + VIEW_OPTIONS.length) % VIEW_OPTIONS.length
        const next = VIEW_OPTIONS[nextIdx]
        if (next) onChangeView(next.id)
      }
    },
    [activeView, onChangeView],
  )

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="tablist"
      aria-label="Trace view"
      onKeyDown={handleKeyDown}
    >
      {VIEW_OPTIONS.map((opt) => {
        const isActive = opt.id === activeView
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            id={`trace-tab-${opt.id}`}
            aria-selected={isActive}
            aria-controls={`trace-panel-${opt.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChangeView(opt.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        )
      })}

      {spanCount !== undefined && (
        <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
          {spanCount} span{spanCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
