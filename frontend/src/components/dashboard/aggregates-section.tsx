'use client'

/**
 * AggregatesSection — T058
 *
 * Renders AggregatesResponse data grouped by section and group.
 * Each section has a title; groups have optional headers and a data table.
 *
 * Usage:
 *   <AggregatesSection data={aggregatesData} />
 */

import { useMemo } from 'react'
import { useResizableTableColumns, type ResizableColumnConfig } from '@/hooks/use-resizable-table-columns'
import { cn } from '@/lib/utils'
import type { AggregatesResponse, AggregateGroup, AggregateRow } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AggregatesSectionProps {
  data: AggregatesResponse
  className?: string
}

// ---------------------------------------------------------------------------
// AggregatesGroupTable
// ---------------------------------------------------------------------------

function AggregatesGroupTable({
  group,
  sectionIndex,
  groupIndex,
  ariaLabel,
}: {
  group: AggregateGroup
  sectionIndex: number
  groupIndex: number
  ariaLabel: string
}) {
  const valueColumnCount =
    group.headers.length > 0
      ? group.headers.length
      : group.rows.reduce((max, r) => Math.max(max, r.values.length), 0)

  const resizeSpec = useMemo((): ResizableColumnConfig[] => {
    const spec: ResizableColumnConfig[] = [
      { id: 'label', defaultWidth: 148, minWidth: 88, maxWidth: 400 },
      ...Array.from({ length: valueColumnCount }, (_, i) => ({
        id: `c${i}`,
        defaultWidth: 104,
        minWidth: 64,
        maxWidth: 280,
      })),
    ]
    return spec
  }, [valueColumnCount])

  const { tableLayoutStyle, thStyle, tdStyle, renderResizeHandle } = useResizableTableColumns(resizeSpec, {
    storageKey: `remedyiq:aggregate:v1:${sectionIndex}:${groupIndex}`,
  })

  const showHeaderRow = valueColumnCount > 0

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="text-xs" style={tableLayoutStyle} aria-label={ariaLabel}>
        {showHeaderRow && (
          <thead>
            <tr className="bg-[var(--color-bg-secondary)]">
              <th
                scope="col"
                style={thStyle(0)}
                className="relative box-border border-b border-[var(--color-border)] px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
              >
                <span className="pr-2">Label</span>
                {renderResizeHandle(0)}
              </th>
              {group.headers.length > 0
                ? group.headers.map((h, hi) => (
                    <th
                      key={hi}
                      scope="col"
                      style={thStyle(hi + 1)}
                      className="relative box-border border-b border-[var(--color-border)] px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                    >
                      <span className="pr-2">{h}</span>
                      {renderResizeHandle(hi + 1)}
                    </th>
                  ))
                : Array.from({ length: valueColumnCount }, (_, hi) => (
                    <th
                      key={hi}
                      scope="col"
                      style={thStyle(hi + 1)}
                      className="relative box-border border-b border-[var(--color-border)] px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                    >
                      <span className="pr-2 tabular-nums">{hi + 1}</span>
                      {renderResizeHandle(hi + 1)}
                    </th>
                  ))}
            </tr>
          </thead>
        )}
        <tbody>
          {group.rows.map((row: AggregateRow, ri) => (
            <tr
              key={ri}
              className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <td style={tdStyle(0)} className="box-border min-w-0 px-3 py-2 align-top font-medium text-[var(--color-text-primary)] break-words whitespace-normal">
                {row.label}
              </td>
              {row.values.map((val, vi) => (
                <td
                  key={vi}
                  style={tdStyle(vi + 1)}
                  className="box-border px-3 py-2 align-top text-right font-mono text-[var(--color-text-secondary)] whitespace-nowrap"
                >
                  {val == null ? '—' : String(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AggregatesSection
// ---------------------------------------------------------------------------

export function AggregatesSection({ data, className }: AggregatesSectionProps) {
  if (!data.sections || data.sections.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
        No aggregates data available for this job.
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-[var(--color-border-light)]', className)}>
      {data.sections.map((section, si) => (
        <div key={si} className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            {section.title}
          </h3>

          <div className="space-y-6">
            {section.groups.map((group, gi) => (
              <div key={gi}>
                {group.name && (
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {group.name}
                  </h4>
                )}

                {group.rows.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-tertiary)]">No data</p>
                ) : (
                  <AggregatesGroupTable
                    group={group}
                    sectionIndex={si}
                    groupIndex={gi}
                    ariaLabel={group.name || section.title}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
