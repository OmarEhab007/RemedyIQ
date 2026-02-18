'use client'

/**
 * upload-store.ts — Zustand v5 store for file upload UI state.
 *
 * Tracks active upload progress for files in-flight. Each upload is keyed
 * by a client-generated fileId (typically the File object name + timestamp)
 * so multiple concurrent uploads are supported.
 *
 * Usage:
 *   const activeUploads = useUploadStore((s) => s.activeUploads)
 *   useUploadStore.getState().addUpload('file-abc', 'report.log')
 *   useUploadStore.getState().updateProgress('file-abc', 50)
 *   useUploadStore.getState().removeUpload('file-abc')
 */

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadEntry {
  /** Client-side unique key for this upload. */
  fileId: string
  /** Original file name shown in the UI. */
  fileName: string
  /** Upload progress 0–100. */
  progress: number
  /** True once the HTTP upload phase is done (before analysis starts). */
  uploaded: boolean
}

export interface UploadState {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Map of fileId → UploadEntry for all active (in-flight) uploads.
   * Completed / removed entries are not kept here; use the job list instead.
   */
  activeUploads: Map<string, UploadEntry>

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Register a new upload. Initial progress is 0. */
  addUpload: (fileId: string, fileName: string) => void

  /** Update the upload progress percentage for an in-flight upload. */
  updateProgress: (fileId: string, progress: number) => void

  /** Mark the upload HTTP phase as complete (100%) for a file. */
  markUploaded: (fileId: string) => void

  /**
   * Remove an upload entry once the analysis job has been created or
   * the upload was cancelled / failed.
   */
  removeUpload: (fileId: string) => void

  /** Remove all active upload entries. */
  clearUploads: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUploadStore = create<UploadState>()((set) => ({
  activeUploads: new Map(),

  addUpload: (fileId, fileName) =>
    set((state) => {
      const next = new Map(state.activeUploads)
      next.set(fileId, { fileId, fileName, progress: 0, uploaded: false })
      return { activeUploads: next }
    }),

  updateProgress: (fileId, progress) =>
    set((state) => {
      const entry = state.activeUploads.get(fileId)
      if (!entry) return state
      const next = new Map(state.activeUploads)
      next.set(fileId, { ...entry, progress: Math.min(100, Math.max(0, progress)) })
      return { activeUploads: next }
    }),

  markUploaded: (fileId) =>
    set((state) => {
      const entry = state.activeUploads.get(fileId)
      if (!entry) return state
      const next = new Map(state.activeUploads)
      next.set(fileId, { ...entry, progress: 100, uploaded: true })
      return { activeUploads: next }
    }),

  removeUpload: (fileId) =>
    set((state) => {
      const next = new Map(state.activeUploads)
      next.delete(fileId)
      return { activeUploads: next }
    }),

  clearUploads: () => set({ activeUploads: new Map() }),
}))
