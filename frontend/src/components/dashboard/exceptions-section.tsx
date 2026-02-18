'use client'

/**
 * ExceptionsSection — T059
 *
 * Renders ExceptionsResponse: an error table with message, log type,
 * user, timestamp, and optional stack trace (expandable).
 *
 * Usage:
 *   <ExceptionsSection data={exceptionsData} />
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { ExceptionsResponse, ExceptionEntry } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExceptionsSectionProps {
  data: ExceptionsResponse
  className?: string
}

// ---------------------------------------------------------------------------
// ExceptionRow
// ---------------------------------------------------------------------------

function ExceptionRow({ entry }: { entry: ExceptionEntry }) {
  const [expanded, setExpanded] = useState(false)
  const typeConfig = LOG_TYPE_COLORS[entry.log_type]

  return (
    <>
      <tr className={cn(
        'border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg-secondary)] transition-colors',
        'bg-[var(--color-error-light)]/20'
      )}>
        <td className="px-4 py-2 font-mono text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">
          L{entry.line_number}
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: typeConfig.bg, color: typeConfig.text }}
          >
            {entry.log_type}
          </span>
        </td>
        <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </td>
        <td className="px-4 py-2 text-xs text-[var(--color-text-secondary)] whitespace-nowrap truncate max-w-[8rem]" title={entry.user}>
          {entry.user || '—'}
        </td>
        <td className="max-w-0 px-4 py-2">
          <span
            className="block truncate text-xs text-[var(--color-error)]"
            title={entry.message}
          >
            {entry.message}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          {entry.stack_trace && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                'hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]'
              )}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse stack trace' : 'Expand stack trace'}
            >
              {expanded ? 'Hide' : 'Trace'}
            </button>
          )}
        </td>
      </tr>
      {expanded && entry.stack_trace && (
        <tr>
          <td
            colSpan={6}
            className="bg-[var(--color-bg-tertiary)] px-4 py-3"
          >
            <pre className="max-h-48 overflow-y-auto rounded text-[10px] font-mono leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
              {entry.stack_trace}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// ExceptionsSection
// ---------------------------------------------------------------------------

export function ExceptionsSection({ data, className }: ExceptionsSectionProps) {
  if (!data.exceptions || data.exceptions.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[var(--color-success)]">
        No exceptions found — log looks clean.
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Summary bar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-error-light)]/30 px-5 py-3">
        <svg
          className="h-4 w-4 shrink-0 text-[var(--color-error)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-xs font-semibold text-[var(--color-error)]">
          {data.total ?? data.exceptions?.length ?? 0} exception{(data.total ?? data.exceptions?.length ?? 0) !== 1 ? 's' : ''} found
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Exceptions list">
          <thead>
            <tr className="bg-[var(--color-bg-secondary)]">
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                Line
              </th>
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                Type
              </th>
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                Time
              </th>
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                User
              </th>
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider min-w-[16rem]">
                Message
              </th>
              <th scope="col" className="border-b border-[var(--color-border)] px-4 py-2 text-right font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                Stack
              </th>
            </tr>
          </thead>
          <tbody>
            {data.exceptions.map((entry, idx) => (
              <ExceptionRow key={`${entry.trace_id}-${idx}`} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
