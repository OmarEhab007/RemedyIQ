'use client'

/**
 * DistributionChart — T055
 *
 * Bar chart showing log type distribution by count and percentage.
 * Uses Recharts BarChart with LOG_TYPE_COLORS for bar fills.
 *
 * Usage:
 *   <DistributionChart distribution={dashboardData.distribution} />
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { Distribution, DistributionBucket } from '@/lib/api-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DistributionChartProps {
  distribution: Distribution
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOG_TYPE_ORDER = ['API', 'SQL', 'FLTR', 'ESCL'] as const

function getBarColor(label: string): string {
  const key = label.toUpperCase() as keyof typeof LOG_TYPE_COLORS
  return LOG_TYPE_COLORS[key]?.bg ?? 'var(--color-text-tertiary)'
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface BucketPayload {
  label: string
  count: number
  percentage: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: BucketPayload }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  if (!item) return null

  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg text-xs"
      role="tooltip"
    >
      <p className="font-semibold text-[var(--color-text-primary)] mb-1">{item.payload.label}</p>
      <p className="text-[var(--color-text-secondary)]">
        Count:{' '}
        <span className="font-mono font-semibold text-[var(--color-text-primary)]">
          {item.value.toLocaleString()}
        </span>
      </p>
      <p className="text-[var(--color-text-secondary)]">
        Share:{' '}
        <span className="font-mono font-semibold text-[var(--color-text-primary)]">
          {item.payload.percentage.toFixed(1)}%
        </span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DistributionChart
// ---------------------------------------------------------------------------

/**
 * Converts backend distribution (Record<string, number>) to sorted DistributionBucket[].
 * Falls back to the legacy log_type array if already in that format.
 */
function toBuckets(distribution: Distribution): DistributionBucket[] {
  // Handle backend format: by_type is a Record<string, number>
  if (distribution.by_type && typeof distribution.by_type === 'object') {
    const entries = Object.entries(distribution.by_type)
    const total = entries.reduce((sum, [, count]) => sum + count, 0)
    return entries.map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
  }
  // Legacy format: already an array
  if (Array.isArray(distribution.log_type)) {
    return distribution.log_type
  }
  return []
}

export function DistributionChart({ distribution, className }: DistributionChartProps) {
  // Sort buckets by the canonical log type order
  const buckets = toBuckets(distribution).sort((a, b) => {
    const ai = LOG_TYPE_ORDER.indexOf(a.label.toUpperCase() as (typeof LOG_TYPE_ORDER)[number])
    const bi = LOG_TYPE_ORDER.indexOf(b.label.toUpperCase() as (typeof LOG_TYPE_ORDER)[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Log Type Distribution
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {buckets.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            No distribution data available
          </div>
        ) : (
          <>
            <div className="h-40" aria-label="Bar chart of log type distribution">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={buckets}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border-light)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-tertiary)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {buckets.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={getBarColor(entry.label)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Percentage legend */}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: getBarColor(b.label) }}
                    aria-hidden="true"
                  />
                  <dt className="text-[10px] text-[var(--color-text-secondary)]">{b.label}</dt>
                  <dd className="ml-auto text-[10px] font-mono font-semibold text-[var(--color-text-primary)]">
                    {b.percentage.toFixed(1)}%
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
