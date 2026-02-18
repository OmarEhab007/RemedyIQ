'use client'

/**
 * DetailPanel — right-side sliding panel for a selected log entry.
 *
 * Shows:
 *   - All structured fields as key-value pairs
 *   - Raw text in a monospace scrollable block
 *   - Context window: before/after entries
 *   - Copy raw_text button
 *   - Close button
 *
 * Usage:
 *   <DetailPanel
 *     jobId="job-123"
 *     entryId={selectedEntryId}
 *     onClose={() => selectEntry(null)}
 *   />
 */

import { useCallback, useState } from 'react'
import { useLogEntry, useEntryContext } from '@/hooks/use-api'
import type { LogEntry, LogType } from '@/lib/api-types'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PageState } from '@/components/ui/page-state'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetailPanelProps {
  jobId: string
  entryId: string
  onClose: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// LogTypeBadge
// ---------------------------------------------------------------------------

function LogTypeBadge({ logType }: { logType: LogType }) {
  const config = LOG_TYPE_COLORS[logType]
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// FieldRow — a label + value pair
// ---------------------------------------------------------------------------

function FieldRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number | null | boolean
  mono?: boolean
}) {
  if (value === null || value === undefined || value === '') return null

  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)

  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1 text-xs">
      <dt className="shrink-0 font-medium text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd
        className={cn(
          'break-words text-[var(--color-text-primary)]',
          mono && 'font-mono',
        )}
      >
        {display}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContextEntry — compact row for a before/after entry
// ---------------------------------------------------------------------------

function ContextEntry({
  entry,
  isSelected,
}: {
  entry: LogEntry
  isSelected?: boolean
}) {
  if (!entry) return null
  const timestamp = (entry.timestamp ?? '').replace('T', ' ').replace('Z', '').slice(0, 23)
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-xs',
        isSelected
          ? 'bg-[var(--color-primary-light)] font-medium'
          : 'text-[var(--color-text-secondary)]',
      )}
    >
      <span className="w-[136px] shrink-0 font-mono text-[10px]">{timestamp}</span>
      <LogTypeBadge logType={entry.log_type} />
      <span className="min-w-0 flex-1 truncate font-mono">
        {entry.form ?? entry.filter_name ?? entry.sql_table ?? entry.rpc_id ?? '—'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — silently fail
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy raw text to clipboard'}
      className="flex h-6 items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
    >
      {copied ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-success)]"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// EntryFields — renders all structured fields
// ---------------------------------------------------------------------------

function EntryFields({ entry }: { entry: LogEntry }) {
  return (
    <dl className="divide-y divide-[var(--color-border-light)]">
      <FieldRow label="Entry ID" value={entry.entry_id} mono />
      <FieldRow label="Line #" value={entry.line_number} />
      <FieldRow label="Timestamp" value={entry.timestamp} mono />
      <FieldRow label="Job ID" value={entry.job_id} mono />
      <FieldRow label="Trace ID" value={entry.trace_id} mono />
      <FieldRow label="RPC ID" value={entry.rpc_id} mono />
      <FieldRow label="Thread ID" value={entry.thread_id} mono />
      <FieldRow label="Queue" value={entry.queue} />
      <FieldRow label="User" value={entry.user} />
      <FieldRow label="Duration" value={entry.duration_ms !== null ? `${entry.duration_ms}ms` : null} mono />
      <FieldRow label="Success" value={entry.success} />
      <FieldRow label="Form" value={entry.form} />
      <FieldRow label="SQL Table" value={entry.sql_table} />
      <FieldRow label="Filter" value={entry.filter_name} />
      <FieldRow label="Escalation" value={entry.esc_name} />
      {entry.error_message && (
        <FieldRow label="Error" value={entry.error_message} />
      )}
    </dl>
  )
}

// ---------------------------------------------------------------------------
// DetailPanel component
// ---------------------------------------------------------------------------

export function DetailPanel({
  jobId,
  entryId,
  onClose,
  className,
}: DetailPanelProps) {
  const { data: entry, isLoading, isError, refetch } = useLogEntry(jobId, entryId)
  const { data: context } = useEntryContext(jobId, entryId)

  return (
    <aside
      aria-label="Log entry details"
      className={cn(
        'flex w-96 shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]',
        className,
      )}
    >
      {/* Panel header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          {entry && <LogTypeBadge logType={entry.log_type} />}
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Entry Details
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {isLoading && <PageState variant="loading" rows={6} />}

        {isError && (
          <PageState
            variant="error"
            message="Failed to load log entry details."
            onRetry={() => void refetch()}
          />
        )}

        {entry && (
          <>
            {/* Fields section */}
            <Section title="Fields">
              <EntryFields entry={entry} />
            </Section>

            {/* Raw text section */}
            <Section title="Raw Text">
              <div className="relative">
                <pre
                  className={cn(
                    'max-h-48 overflow-auto rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3',
                    'font-mono text-[11px] leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words',
                  )}
                >
                  {entry.raw_text}
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton text={entry.raw_text} />
                </div>
              </div>
            </Section>

            {/* Error message */}
            {entry.error_message && (
              <Section title="Error Message">
                <p className="rounded border border-[var(--color-error-light)] bg-[var(--color-error-light)] p-2.5 font-mono text-xs text-[var(--color-error)]">
                  {entry.error_message}
                </p>
              </Section>
            )}

            {/* Context */}
            {context && ((context.before ?? []).length > 0 || (context.after ?? []).length > 0) && (
              <Section title="Context">
                <div
                  className="flex flex-col gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-1"
                  role="list"
                  aria-label="Surrounding log entries"
                >
                  {(context.before ?? []).map((e) => (
                    <div key={e.entry_id} role="listitem">
                      <ContextEntry entry={e} />
                    </div>
                  ))}
                  <div role="listitem">
                    <ContextEntry entry={context.entry} isSelected />
                  </div>
                  {(context.after ?? []).map((e) => (
                    <div key={e.entry_id} role="listitem">
                      <ContextEntry entry={e} />
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
