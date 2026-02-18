'use client'

/**
 * follow-up-suggestions.tsx — Clickable suggestion chips from follow_ups array.
 *
 * Renders clickable suggestion chips from Message.follow_ups.
 * Clicking a suggestion pre-fills or submits it as the next message.
 *
 * Usage:
 *   <FollowUpSuggestions
 *     suggestions={message.follow_ups}
 *     onSelect={(suggestion) => handleSend(suggestion)}
 *   />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FollowUpSuggestionsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  disabled?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// FollowUpSuggestions
// ---------------------------------------------------------------------------

export function FollowUpSuggestions({
  suggestions,
  onSelect,
  disabled = false,
  className,
}: FollowUpSuggestionsProps) {
  const handleSelect = useCallback(
    (suggestion: string) => {
      if (!disabled) onSelect(suggestion)
    },
    [disabled, onSelect],
  )

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div
      className={cn('flex flex-wrap gap-2 px-4 pb-2', className)}
      role="group"
      aria-label="Follow-up suggestions"
    >
      <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Suggested follow-ups
      </span>
      {suggestions.map((s, i) => (
        <button
          key={`${s}-${i}`}
          type="button"
          onClick={() => handleSelect(s)}
          disabled={disabled}
          aria-label={`Suggest: ${s}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-secondary)]',
            'transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {s}
        </button>
      ))}
    </div>
  )
}
