'use client'

/**
 * DropZone — drag-and-drop (and click-to-browse) file upload area.
 *
 * Accepts AR Server log files. Shows visual feedback on drag enter/over/leave,
 * displays selected file name + size, and reports upload progress via an
 * internal progress bar while the HTTP transfer is in-flight.
 *
 * Usage:
 *   <DropZone onUploadComplete={(file) => createAnalysis({ fileId: file.id })} />
 */

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useUploadFile } from '@/hooks/use-api'
import { useUploadStore } from '@/stores/upload-store'
import type { LogFile } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DropZoneProps {
  /** Called when the file has been successfully uploaded to storage. */
  onUploadComplete?: (file: LogFile) => void
  /** Called when the upload fails. */
  onUploadError?: (error: Error) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

// ---------------------------------------------------------------------------
// DropZone component
// ---------------------------------------------------------------------------

export function DropZone({ onUploadComplete, onUploadError, className }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadMutation = useUploadFile()
  const { addUpload, updateProgress, markUploaded, removeUpload } = useUploadStore()

  const isUploading = uploadMutation.isPending

  // ---------------------------------------------------------------------------
  // Upload trigger
  // ---------------------------------------------------------------------------

  const startUpload = useCallback(
    (file: File) => {
      const fileId = `${file.name}-${Date.now()}`
      setSelectedFile(file)
      setUploadError(null)
      setUploadProgress(0)
      addUpload(fileId, file.name)

      uploadMutation.mutate(
        {
          file,
          onProgress: (pct) => {
            setUploadProgress(pct)
            updateProgress(fileId, pct)
          },
        },
        {
          onSuccess: ({ file: logFile }) => {
            markUploaded(fileId)
            setUploadProgress(100)
            // Small delay so the 100% bar is visible before clearing
            setTimeout(() => {
              removeUpload(fileId)
              onUploadComplete?.(logFile)
            }, 600)
          },
          onError: (err) => {
            removeUpload(fileId)
            setUploadError(err.message ?? 'Upload failed')
            onUploadError?.(err)
          },
        }
      )
    },
    [uploadMutation, addUpload, updateProgress, markUploaded, removeUpload, onUploadComplete, onUploadError]
  )

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear drag state when leaving the drop zone itself, not a child element
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (isUploading) return
      const file = e.dataTransfer.files?.[0]
      if (file) startUpload(file)
    },
    [isUploading, startUpload]
  )

  // ---------------------------------------------------------------------------
  // Click-to-browse handler
  // ---------------------------------------------------------------------------

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) startUpload(file)
      // Reset so the same file can be selected again
      e.target.value = ''
    },
    [startUpload]
  )

  const handleBrowseClick = useCallback(() => {
    if (!isUploading) inputRef.current?.click()
  }, [isUploading])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleBrowseClick()
      }
    },
    [handleBrowseClick]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('w-full', className)}>
      {/* Drop target */}
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Drop log file here or click to browse"
        aria-disabled={isUploading}
        data-testid="drop-zone"
        data-drag-over={isDragOver}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-4',
          'rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          // Default state
          'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
          'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]',
          // Drag-over state
          isDragOver && 'border-[var(--color-primary)] bg-[var(--color-primary-light)] scale-[1.01]',
          // Uploading state
          isUploading && 'cursor-not-allowed opacity-75'
        )}
      >
        {/* Upload icon */}
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200',
            isDragOver
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
          )}
          aria-hidden="true"
        >
          {isUploading ? (
            /* Spinner while uploading */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            /* Upload arrow */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>

        {/* Label text */}
        <div className="space-y-1">
          {isUploading && selectedFile ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Uploading {selectedFile.name}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {formatBytes(selectedFile.size)} — {uploadProgress}%
              </p>
            </>
          ) : selectedFile && !isUploading ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {formatBytes(selectedFile.size)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {isDragOver ? 'Release to upload' : 'Drop your AR Server log file here'}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                or{' '}
                <span className="font-medium text-[var(--color-primary)]">
                  click to browse
                </span>
                {' '}— .log, .txt, or any AR log format
              </p>
            </>
          )}
        </div>

        {/* Progress bar (visible during upload) */}
        {isUploading && (
          <div
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Upload progress: ${uploadProgress}%`}
            className="w-full max-w-xs"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          accept=".log,.txt,*"
          onChange={handleInputChange}
          data-testid="file-input"
        />
      </div>

      {/* Error message */}
      {uploadError && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-3"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-[var(--color-error)]"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--color-error)]">Upload failed</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{uploadError}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation()
              setUploadError(null)
            }}
            aria-label="Dismiss error"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      )}
    </div>
  )
}
