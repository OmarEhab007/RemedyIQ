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

import { cn } from '@/lib/utils'
import type { AggregatesResponse } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AggregatesSectionProps {
  data: AggregatesResponse
  className?: string
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
                  <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-xs" aria-label={group.name || section.title}>
                      {group.headers.length > 0 && (
                        <thead>
                          <tr className="bg-[var(--color-bg-secondary)]">
                            {/* Row label column */}
                            <th
                              scope="col"
                              className="border-b border-[var(--color-border)] px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                            >
                              Label
                            </th>
                            {group.headers.map((h, hi) => (
                              <th
                                key={hi}
                                scope="col"
                                className="border-b border-[var(--color-border)] px-3 py-2 text-right font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {group.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
                          >
                            <td className="px-3 py-2 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                              {row.label}
                            </td>
                            {row.values.map((val, vi) => (
                              <td
                                key={vi}
                                className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)] whitespace-nowrap"
                              >
                                {val == null ? '—' : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
