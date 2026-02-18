'use client'

/**
 * ExportButton — dropdown to export log search results as CSV or JSON.
 *
 * Calls api.exportSearchResults() which returns a Blob; triggers a browser
 * download via a temporary <a> element. Shows a toast on success/failure via
 * the sonner toast library.
 *
 * Usage:
 *   <ExportButton jobId="job-123" searchParams={{ q: 'error', log_type: 'API' }} />
 */

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { exportSearchResults } from '@/lib/api'
import type { SearchLogsParams } from '@/lib/api-types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportButtonProps {
  jobId: string
  searchParams: SearchLogsParams
  className?: string
  disabled?: boolean
}

type ExportFormat = 'csv' | 'json'

// ---------------------------------------------------------------------------
// ExportButton component
// ---------------------------------------------------------------------------

export function ExportButton({
  jobId,
  searchParams,
  className,
  disabled = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setOpen(false)
      setIsExporting(format)

      const toastId = toast.loading(`Preparing ${format.toUpperCase()} export…`)

      try {
        const blob = await exportSearchResults(jobId, searchParams, format)

        // Generate filename
        const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const filename = `remedyiq-logs-${now}.${format}`

        // Trigger download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(`Exported as ${filename}`, { id: toastId })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Export failed. Please try again.'
        toast.error(message, { id: toastId })
      } finally {
        setIsExporting(null)
      }
    },
    [jobId, searchParams],
  )

  const isLoading = isExporting !== null

  return (
    <div className={cn('relative', className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled || isLoading}
        aria-label="Export log entries"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors',
          (disabled || isLoading) && 'pointer-events-none opacity-50',
          open && 'bg-[var(--color-bg-secondary)]',
        )}
      >
        {isLoading ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>Exporting…</span>
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn('transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1 shadow-lg"
            role="menu"
            aria-label="Export format options"
          >
            <ExportMenuItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
              label="Export as CSV"
              description="Comma-separated values"
              onClick={() => void handleExport('csv')}
            />
            <ExportMenuItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M10 12a2 2 0 0 0-2 2v2a2 2 0 0 0 4 0v-2a2 2 0 0 0-2-2z" />
                  <path d="M16 12h-2" />
                  <path d="M16 15h-2" />
                </svg>
              }
              label="Export as JSON"
              description="Structured JSON array"
              onClick={() => void handleExport('json')}
            />
          </div>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportMenuItem
// ---------------------------------------------------------------------------

interface ExportMenuItemProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function ExportMenuItem({ icon, label, description, onClick }: ExportMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors',
        'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]',
      )}
    >
      <span className="shrink-0 text-[var(--color-text-secondary)]">{icon}</span>
      <span>
        <span className="block text-sm text-[var(--color-text-primary)]">{label}</span>
        <span className="block text-[11px] text-[var(--color-text-tertiary)]">
          {description}
        </span>
      </span>
    </button>
  )
}
