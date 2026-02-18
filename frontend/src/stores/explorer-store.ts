'use client'

/**
 * explorer-store.ts — Zustand v5 store for Log Explorer UI state.
 *
 * Holds the active search query, applied filters, selected log entry,
 * time range, and exposes granular setters so components only subscribe
 * to the slices they use (avoiding unnecessary re-renders).
 *
 * Usage:
 *   const query = useExplorerStore((s) => s.query)
 *   const setQuery = useExplorerStore((s) => s.setQuery)
 *
 *   // Add a filter
 *   useExplorerStore.getState().addFilter({ field: 'level', value: 'ERROR', operator: 'eq' })
 *
 *   // Reset everything when navigating away
 *   useExplorerStore.getState().reset()
 */

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExplorerFilter {
  /** The log field to match against, e.g. 'level', 'schema', 'operation'. */
  field: string
  /** The value to compare. */
  value: string
  /**
   * Comparison operator.
   * Common values: 'eq' | 'neq' | 'contains' | 'not_contains' | 'gt' | 'lt'
   */
  operator: string
}

export interface ExplorerTimeRange {
  /** ISO 8601 datetime string for the start of the range. */
  start: string
  /** ISO 8601 datetime string for the end of the range. */
  end: string
}

export interface ExplorerState {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Free-text search query (Bleve/lucene-style syntax). */
  query: string

  /** List of structured filters applied to the search. */
  filters: ExplorerFilter[]

  /** The currently selected log entry ID (drives the detail panel). */
  selectedEntryId: string | null

  /** Optional time window to restrict results. Null means "all time". */
  timeRange: ExplorerTimeRange | null

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Replace the free-text query. */
  setQuery: (query: string) => void

  /** Append a filter. Does not deduplicate — callers should check first. */
  addFilter: (filter: ExplorerFilter) => void

  /** Remove the filter at position `index`. */
  removeFilter: (index: number) => void

  /** Remove all active filters. */
  clearFilters: () => void

  /** Set or clear the selected entry (null to close the detail panel). */
  selectEntry: (entryId: string | null) => void

  /** Set or clear the active time range. */
  setTimeRange: (range: ExplorerTimeRange | null) => void

  /**
   * Reset all state to initial values.
   * Call when navigating away from the explorer or switching jobs.
   */
  reset: () => void
}

// ---------------------------------------------------------------------------
// Initial state snapshot (used by reset())
// ---------------------------------------------------------------------------

const initialState: Pick<
  ExplorerState,
  'query' | 'filters' | 'selectedEntryId' | 'timeRange'
> = {
  query: '',
  filters: [],
  selectedEntryId: null,
  timeRange: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExplorerStore = create<ExplorerState>()((set) => ({
  ...initialState,

  setQuery: (query) => set({ query }),

  addFilter: (filter) =>
    set((state) => ({ filters: [...state.filters, filter] })),

  removeFilter: (index) =>
    set((state) => ({
      filters: state.filters.filter((_, i) => i !== index),
    })),

  clearFilters: () => set({ filters: [] }),

  selectEntry: (entryId) => set({ selectedEntryId: entryId }),

  setTimeRange: (range) => set({ timeRange: range }),

  reset: () => set({ ...initialState }),
}))
