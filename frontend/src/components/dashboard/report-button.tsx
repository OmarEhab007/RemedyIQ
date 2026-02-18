'use client'

/**
 * ReportButton — T063
 *
 * "Generate Report" button. Calls useGenerateReport mutation and shows
 * loading state. On success, opens the report content in a new tab or
 * triggers a download for PDF format.
 *
 * Usage:
 *   <ReportButton jobId="job-123" />
 *   <ReportButton jobId="job-123" format="pdf" variant="outline" />
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useGenerateReport } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import type { ReportFormat } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportButtonProps {
  jobId: string
  format?: ReportFormat
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

// ---------------------------------------------------------------------------
// ReportButton
// ---------------------------------------------------------------------------

export function ReportButton({
  jobId,
  format = 'html',
  variant = 'outline',
  size = 'sm',
  className,
}: ReportButtonProps) {
  const mutation = useGenerateReport()
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    setError(null)
    mutation.mutate(
      { jobId, format },
      {
        onSuccess: (data) => {
          if (format === 'json') {
            // Download as JSON file
            const blob = new Blob([data.content], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `remedyiq-report-${jobId}.json`
            a.click()
            URL.revokeObjectURL(url)
          } else if (format === 'pdf') {
            // Treat content as base64 PDF or URL
            const a = document.createElement('a')
            a.href = `data:application/pdf;base64,${data.content}`
            a.download = `remedyiq-report-${jobId}.pdf`
            a.click()
          } else {
            // HTML — open in new tab
            const blob = new Blob([data.content], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank', 'noopener,noreferrer')
            // Release after a short delay
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
          }
        },
        onError: (err) => {
          setError(err.message ?? 'Failed to generate report')
        },
      }
    )
  }

  const isPending = mutation.isPending

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        variant={variant}
        size={size}
        onClick={handleGenerate}
        disabled={isPending}
        aria-busy={isPending}
        aria-label={isPending ? 'Generating report…' : `Generate ${format.toUpperCase()} report`}
      >
        {isPending ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5"
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
            Generate {format.toUpperCase()} Report
          </>
        )}
      </Button>

      {error && (
        <p
          role="alert"
          className="text-[10px] text-[var(--color-error)]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
