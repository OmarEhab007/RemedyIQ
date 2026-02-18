'use client'

/**
 * SavedSearches — dropdown with saved search management.
 *
 * Features:
 *   - Lists saved searches, pinned first
 *   - Load a saved search → restores query + filters in the explorer store
 *   - "Save Current Search" dialog with a name input
 *   - Delete a saved search with confirmation
 *
 * Usage:
 *   <SavedSearches
 *     currentQuery={query}
 *     currentFilters={filters}
 *     onLoad={(query, filters) => { setQuery(query); replaceFilters(filters) }}
 *   />
 */

import { useRef, useState, useCallback } from 'react'
import { useSavedSearches, useDeleteSavedSearch, useSaveSearch } from '@/hooks/use-api'
import type { ExplorerFilter } from '@/stores/explorer-store'
import type { SavedSearch } from '@/lib/api-types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedSearchesProps {
  currentQuery: string
  currentFilters: ExplorerFilter[]
  onLoad: (query: string, filters: ExplorerFilter[]) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Helper: convert SavedSearch.filters Record<string,string> → ExplorerFilter[]
// ---------------------------------------------------------------------------

function recordToFilters(record: Record<string, string>): ExplorerFilter[] {
  return Object.entries(record).map(([field, value]) => ({
    field,
    value,
    operator: 'eq',
  }))
}

// ---------------------------------------------------------------------------
// Helper: convert ExplorerFilter[] → Record<string,string>
// ---------------------------------------------------------------------------

function filtersToRecord(filters: ExplorerFilter[]): Record<string, string> {
  return Object.fromEntries(filters.map((f) => [f.field, f.value]))
}

// ---------------------------------------------------------------------------
// SaveCurrentDialog — small modal to name a new saved search
// ---------------------------------------------------------------------------

interface SaveCurrentDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => void
  isSaving: boolean
}

function SaveCurrentDialog({ isOpen, onClose, onSave, isSaving }: SaveCurrentDialogProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) return
      onSave(trimmed)
      setName('')
    },
    [name, onSave],
  )

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save search"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          Save current search
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="saved-search-name"
              className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="saved-search-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Slow API calls"
              autoFocus
              required
              className={cn(
                'h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]',
                'focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20',
              )}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SavedSearchItem
// ---------------------------------------------------------------------------

interface SavedSearchItemProps {
  search: SavedSearch
  onLoad: () => void
  onDelete: () => void
  isDeleting: boolean
}

function SavedSearchItem({ search, onLoad, onDelete, isDeleting }: SavedSearchItemProps) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-tertiary)] transition-colors">
      <button
        type="button"
        onClick={onLoad}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)] rounded"
      >
        {search.is_pinned && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            className="shrink-0 text-[var(--color-warning)]"
            aria-label="Pinned"
          >
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        )}
        <span className="min-w-0 truncate text-sm text-[var(--color-text-primary)]">
          {search.name}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Delete saved search: ${search.name}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-error-light)] hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-error)] disabled:opacity-40 transition-colors"
      >
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
          aria-hidden="true"
        >
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// SavedSearches component
// ---------------------------------------------------------------------------

export function SavedSearches({
  currentQuery,
  currentFilters,
  onLoad,
  className,
}: SavedSearchesProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { data: savedData, isLoading } = useSavedSearches()
  const deleteMutation = useDeleteSavedSearch()
  const saveMutation = useSaveSearch()

  const savedSearches = savedData?.saved_searches ?? []
  // Sort: pinned first, then by created_at descending
  const sorted = [...savedSearches].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const handleLoad = useCallback(
    (search: SavedSearch) => {
      const filters = recordToFilters(search.filters ?? {})
      onLoad(search.kql_query, filters)
      setDropdownOpen(false)
    },
    [onLoad],
  )

  const handleDelete = useCallback(
    async (search: SavedSearch) => {
      setDeletingId(search.id)
      try {
        await deleteMutation.mutateAsync(search.id)
      } finally {
        setDeletingId(null)
      }
    },
    [deleteMutation],
  )

  const handleSave = useCallback(
    async (name: string) => {
      const filters = filtersToRecord(currentFilters)
      await saveMutation.mutateAsync({
        name,
        query: currentQuery,
        filters,
      })
      setDialogOpen(false)
    },
    [currentQuery, currentFilters, saveMutation],
  )

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Trigger button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-label="Saved searches"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors',
            dropdownOpen && 'bg-[var(--color-bg-secondary)]',
          )}
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
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>Saved</span>
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
            className={cn('transition-transform', dropdownOpen && 'rotate-180')}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            className={cn(
              'absolute left-0 top-full z-40 mt-1 w-72',
              'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg',
            )}
            role="menu"
          >
            {/* Save current search action */}
            <div className="border-b border-[var(--color-border)] p-2">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  setDialogOpen(true)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--color-primary)]',
                  'hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)] transition-colors',
                )}
                role="menuitem"
              >
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
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save current search
              </button>
            </div>

            {/* Saved searches list */}
            <div className="max-h-64 overflow-y-auto p-2">
              {isLoading && (
                <p className="py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                  Loading…
                </p>
              )}
              {!isLoading && sorted.length === 0 && (
                <p className="py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                  No saved searches yet.
                </p>
              )}
              {!isLoading && sorted.length > 0 && (
                <ul
                  role="list"
                  aria-label="Saved searches list"
                  className="space-y-0.5"
                >
                  {sorted.map((search) => (
                    <SavedSearchItem
                      key={search.id}
                      search={search}
                      onLoad={() => handleLoad(search)}
                      onDelete={() => void handleDelete(search)}
                      isDeleting={deletingId === search.id}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Backdrop to close dropdown */}
        {dropdownOpen && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => setDropdownOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Save dialog */}
      <SaveCurrentDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(name) => void handleSave(name)}
        isSaving={saveMutation.isPending}
      />
    </>
  )
}
