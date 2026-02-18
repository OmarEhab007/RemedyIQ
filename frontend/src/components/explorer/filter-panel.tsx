'use client'

/**
 * FilterPanel — Faceted filter sidebar for the Log Explorer.
 *
 * Renders filter controls for:
 *   - Log type (checkboxes: API, SQL, FLTR, ESCL)
 *   - Error status (toggle)
 *   - Duration range (min / max ms inputs)
 *   - Active filters as removable badges
 *   - "Clear All" button
 *
 * Reads and writes to the explorer store. Parent pages pass activeFilters /
 * setters so this component stays flexible (job-scoped vs global explorer).
 *
 * Usage:
 *   <FilterPanel
 *     filters={filters}
 *     onAddFilter={addFilter}
 *     onRemoveFilter={removeFilter}
 *     onClearFilters={clearFilters}
 *   />
 */

import { useState } from 'react'
import type { ExplorerFilter } from '@/stores/explorer-store'
import type { LogType } from '@/lib/api-types'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterPanelProps {
  filters: ExplorerFilter[]
  onAddFilter: (filter: ExplorerFilter) => void
  onRemoveFilter: (index: number) => void
  onClearFilters: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_TYPES: LogType[] = ['API', 'SQL', 'FLTR', 'ESCL']

// ---------------------------------------------------------------------------
// LogTypeBadge — inline colored chip for a log type
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
// Section header
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// ActiveFilterBadge
// ---------------------------------------------------------------------------

function ActiveFilterBadge({
  filter,
  onRemove,
}: {
  filter: ExplorerFilter
  onRemove: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary-light)] py-0.5 pl-2.5 pr-1 text-xs text-[var(--color-primary-dark)]">
      <span className="truncate font-medium">
        {filter.field}
        {filter.operator !== 'eq' ? ` ${filter.operator}` : ':'} {filter.value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${filter.field} ${filter.value}`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-primary)]/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// FilterPanel component
// ---------------------------------------------------------------------------

export function FilterPanel({
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  className,
}: FilterPanelProps) {
  // Local state for duration inputs (not committed until blur / enter)
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')

  // Derive currently-active log types from filters
  const activeLogTypes = filters
    .filter((f) => f.field === 'log_type' && f.operator === 'eq')
    .map((f) => f.value as LogType)

  // Derive error-only filter
  const errorOnly = filters.some(
    (f) => f.field === 'error_only' && f.value === 'true',
  )

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function toggleLogType(logType: LogType) {
    const existingIndex = filters.findIndex(
      (f) => f.field === 'log_type' && f.value === logType,
    )
    if (existingIndex >= 0) {
      onRemoveFilter(existingIndex)
    } else {
      onAddFilter({ field: 'log_type', value: logType, operator: 'eq' })
    }
  }

  function toggleErrorOnly() {
    const existingIndex = filters.findIndex((f) => f.field === 'error_only')
    if (existingIndex >= 0) {
      onRemoveFilter(existingIndex)
    } else {
      onAddFilter({ field: 'error_only', value: 'true', operator: 'eq' })
    }
  }

  function applyMinDuration() {
    const ms = parseInt(minDuration, 10)
    if (isNaN(ms) || ms < 0) return
    // Remove existing min_duration filter
    const existingIndex = filters.findIndex((f) => f.field === 'min_duration')
    if (existingIndex >= 0) onRemoveFilter(existingIndex)
    onAddFilter({ field: 'min_duration', value: String(ms), operator: 'gte' })
  }

  function applyMaxDuration() {
    const ms = parseInt(maxDuration, 10)
    if (isNaN(ms) || ms < 0) return
    const existingIndex = filters.findIndex((f) => f.field === 'max_duration')
    if (existingIndex >= 0) onRemoveFilter(existingIndex)
    onAddFilter({ field: 'max_duration', value: String(ms), operator: 'lte' })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <aside
      aria-label="Log filters"
      className={cn(
        'flex w-56 shrink-0 flex-col gap-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Filters
        </h2>
        {filters.length > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)] rounded"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Active filters">
          {filters.map((filter, i) => (
            <div key={`${filter.field}-${filter.value}-${i}`} role="listitem">
              <ActiveFilterBadge
                filter={filter}
                onRemove={() => onRemoveFilter(i)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-[var(--color-border)]" role="separator" />

      {/* Log type section */}
      <fieldset>
        <legend className="sr-only">Log type</legend>
        <SectionLabel>Log Type</SectionLabel>
        <div className="space-y-2">
          {LOG_TYPES.map((logType) => {
            const checked = activeLogTypes.includes(logType)
            return (
              <label
                key={logType}
                className="flex cursor-pointer items-center gap-2.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLogType(logType)}
                  aria-label={LOG_TYPE_COLORS[logType].description}
                  className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
                <LogTypeBadge logType={logType} />
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {LOG_TYPE_COLORS[logType].label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="h-px bg-[var(--color-border)]" role="separator" />

      {/* Error only section */}
      <div>
        <SectionLabel>Status</SectionLabel>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={errorOnly}
            onChange={toggleErrorOnly}
            aria-label="Show error entries only"
            className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
          />
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-error)]"
              aria-hidden="true"
            />
            Errors only
          </span>
        </label>
      </div>

      <div className="h-px bg-[var(--color-border)]" role="separator" />

      {/* Duration range section */}
      <div>
        <SectionLabel>Duration (ms)</SectionLabel>
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-min-duration"
              className="text-xs text-[var(--color-text-secondary)]"
            >
              Min
            </label>
            <input
              id="filter-min-duration"
              type="number"
              min="0"
              value={minDuration}
              onChange={(e) => setMinDuration(e.target.value)}
              onBlur={applyMinDuration}
              onKeyDown={(e) => e.key === 'Enter' && applyMinDuration()}
              placeholder="e.g. 1000"
              className={cn(
                'h-7 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]',
                'focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30',
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-max-duration"
              className="text-xs text-[var(--color-text-secondary)]"
            >
              Max
            </label>
            <input
              id="filter-max-duration"
              type="number"
              min="0"
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              onBlur={applyMaxDuration}
              onKeyDown={(e) => e.key === 'Enter' && applyMaxDuration()}
              placeholder="e.g. 30000"
              className={cn(
                'h-7 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]',
                'focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/30',
              )}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
