'use client'

/**
 * span-detail.tsx — Right sidebar showing selected span details.
 *
 * Displays: log type, operation, duration, user, form, queue,
 * thread ID, trace ID, RPC ID, error message, raw fields.
 *
 * Usage:
 *   <SpanDetail span={selectedSpan} onClose={() => setSelected(null)} />
 */

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { SpanNode } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpanDetailProps {
  span: SpanNode | null
  onClose: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Field row component
// ---------------------------------------------------------------------------

function FieldRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-[var(--color-border-light)] last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className={cn(
        'text-sm text-[var(--color-text-primary)] break-all',
        mono && 'font-mono text-xs',
      )}>
        {value ?? <span className="text-[var(--color-text-tertiary)] italic">—</span>}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SpanDetail
// ---------------------------------------------------------------------------

export function SpanDetail({ span, onClose, className }: SpanDetailProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  if (!span) return null

  const config = LOG_TYPE_COLORS[span.log_type]
  const rawFields = Object.entries(span.fields).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-bg-primary)]',
        className,
      )}
      aria-label="Span details"
      role="complementary"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: config.bg, color: config.text }}
          >
            {config.label}
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate max-w-[180px]">
            {span.operation || 'Span'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close span details"
          className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Error banner */}
      {span.has_error && span.error_message && (
        <div
          role="alert"
          className="shrink-0 border-b border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-2 text-xs text-[var(--color-error)]"
        >
          <span className="font-semibold">Error: </span>
          {span.error_message}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-1">
        <dl>
          <FieldRow label="Duration" value={`${span.duration_ms.toFixed(2)} ms`} />
          <FieldRow label="Start Offset" value={`${span.start_offset_ms.toFixed(2)} ms`} />
          <FieldRow label="Timestamp" value={new Date(span.timestamp).toLocaleString()} />
          <FieldRow label="Operation" value={span.operation} mono />
          <FieldRow label="User" value={span.user} />
          <FieldRow label="Queue" value={span.queue} />
          {span.form && <FieldRow label="Form" value={span.form} />}
          <FieldRow label="Thread ID" value={span.thread_id} mono />
          <FieldRow label="Trace ID" value={span.trace_id} mono />
          <FieldRow
            label="Success"
            value={
              <span className={span.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
                {span.success ? 'Yes' : 'No'}
              </span>
            }
          />
          {span.on_critical_path && (
            <FieldRow
              label="Critical Path"
              value={<span className="text-amber-600 font-medium">Yes</span>}
            />
          )}
        </dl>

        {/* Raw fields section */}
        {rawFields.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Raw Fields
            </h3>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2">
              <dl className="space-y-1.5">
                {rawFields.map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <dt className="shrink-0 font-mono font-semibold text-[var(--color-text-secondary)] w-28 truncate" title={key}>
                      {key}:
                    </dt>
                    <dd className="font-mono text-[var(--color-text-primary)] break-all">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
