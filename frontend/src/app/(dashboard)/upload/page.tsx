'use client'

/**
 * Upload page — combines the DropZone and JobQueue in a two-section layout.
 *
 * Flow:
 *  1. User drops or selects a file in the DropZone.
 *  2. DropZone uploads the file and calls onUploadComplete with the LogFile.
 *  3. The page creates a new analysis job and shows UploadProgress.
 *  4. Job list below auto-refreshes via the analyses query cache invalidation.
 */

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DropZone } from '@/components/upload/drop-zone'
import { UploadProgress } from '@/components/upload/upload-progress'
import { JobQueue } from '@/components/upload/job-queue'
import { useCreateAnalysis } from '@/hooks/use-api'
import { queryKeys } from '@/hooks/use-api'
import type { LogFile } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Upload page
// ---------------------------------------------------------------------------

export default function UploadPage() {
  const queryClient = useQueryClient()
  const createAnalysis = useCreateAnalysis()

  // Track the most-recently created job so we can show UploadProgress.
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeFileName, setActiveFileName] = useState<string | null>(null)

  const handleUploadComplete = useCallback(
    (file: LogFile) => {
      setActiveFileName(file.filename)
      createAnalysis.mutate(
        { fileId: file.id },
        {
          onSuccess: (job) => {
            setActiveJobId(job.id)
            // Invalidate the list so JobQueue reflects the new entry immediately
            void queryClient.invalidateQueries({ queryKey: queryKeys.analyses() })
          },
        }
      )
    },
    [createAnalysis, queryClient]
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <PageHeader
        title="Upload Log File"
        description="Upload an AR Server log file to start a new analysis. Supported formats: .log, .txt, and all standard AR log outputs."
      />

      {/* Upload section */}
      <section aria-label="File upload">
        <DropZone
          onUploadComplete={handleUploadComplete}
          onUploadError={() => {
            // Reset active job on upload error so UploadProgress disappears
            setActiveJobId(null)
            setActiveFileName(null)
          }}
        />

        {/* Analysis progress — shown after a job is created */}
        {activeJobId && (
          <div className="mt-4">
            <UploadProgress
              jobId={activeJobId}
              fileName={activeFileName ?? undefined}
            />
          </div>
        )}

        {/* Create-analysis error */}
        {createAnalysis.isError && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-3 rounded-lg border border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error)]"
          >
            Failed to start analysis: {createAnalysis.error?.message ?? 'Unknown error'}
          </div>
        )}
      </section>

      {/* Job queue section */}
      <section aria-label="Job history">
        <JobQueue />
      </section>
    </div>
  )
}
