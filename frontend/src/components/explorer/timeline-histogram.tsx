'use client'

/**
 * TimelineHistogram — Recharts bar chart showing log entry distribution over time.
 *
 * Aggregates log entries into time buckets and stacks by log type, using the
 * design-system LOG_TYPE_COLORS palette.
 *
 * Usage:
 *   <TimelineHistogram entries={logEntries} buckets={20} />
 */

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { LogEntry, LogType } from '@/lib/api-types'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineHistogramProps {
  entries: LogEntry[]
  /** Number of time buckets to split the range into. Defaults to 20. */
  buckets?: number
  className?: string
  /** Height in pixels. Defaults to 120. */
  height?: number
}

interface BucketData {
  label: string
  API: number
  SQL: number
  FLTR: number
  ESCL: number
}

// ---------------------------------------------------------------------------
// Helper: bucket entries by timestamp
// ---------------------------------------------------------------------------

const LOG_TYPES: LogType[] = ['API', 'SQL', 'FLTR', 'ESCL']

function bucketEntries(entries: LogEntry[], numBuckets: number): BucketData[] {
  if (entries.length === 0) return []

  const timestamps = entries
    .filter((e) => e?.timestamp)
    .map((e) => new Date(e.timestamp).getTime())
    .filter((t) => !isNaN(t) && t > 0)
  if (timestamps.length === 0) return []
  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)
  const range = maxTs - minTs || 1

  const bucketSize = range / numBuckets

  // Initialize buckets
  const bucketArray: BucketData[] = Array.from({ length: numBuckets }, (_, i) => {
    const bucketStart = new Date(minTs + i * bucketSize)
    // Format label based on range
    const label =
      range < 60_000
        ? bucketStart.toISOString().slice(14, 19) // MM:SS
        : range < 3_600_000
          ? bucketStart.toISOString().slice(11, 16) // HH:MM
          : range < 86_400_000
            ? bucketStart.toISOString().slice(11, 16) // HH:MM
            : bucketStart.toISOString().slice(5, 10) // MM-DD

    return { label, API: 0, SQL: 0, FLTR: 0, ESCL: 0 }
  })

  // Assign each entry to a bucket
  for (const entry of entries) {
    if (!entry?.timestamp) continue
    const ts = new Date(entry.timestamp).getTime()
    if (isNaN(ts)) continue
    const bucketIndex = Math.min(
      Math.floor(((ts - minTs) / range) * numBuckets),
      numBuckets - 1,
    )
    const bucket = bucketArray[bucketIndex]
    if (bucket) {
      const lt = entry.log_type as keyof Omit<BucketData, 'label'>
      if (lt in bucket) {
        bucket[lt]++
      }
    }
  }

  return bucketArray
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0)

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 shadow-lg text-xs">
      <p className="mb-2 font-semibold text-[var(--color-text-primary)]">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: p.color }}
              />
              <span className="text-[var(--color-text-secondary)]">{p.name}</span>
            </span>
            <span className="font-mono font-medium text-[var(--color-text-primary)]">
              {p.value.toLocaleString()}
            </span>
          </div>
        ))}
      {payload.length > 1 && (
        <div className="mt-1.5 border-t border-[var(--color-border-light)] pt-1.5 flex justify-between">
          <span className="text-[var(--color-text-tertiary)]">Total</span>
          <span className="font-mono font-medium">{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimelineHistogram component
// ---------------------------------------------------------------------------

export function TimelineHistogram({
  entries,
  buckets = 20,
  className,
  height = 120,
}: TimelineHistogramProps) {
  const data = useMemo(
    () => bucketEntries(entries, buckets),
    [entries, buckets],
  )

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
          className,
        )}
        style={{ height }}
        aria-label="No data to display"
      >
        <p className="text-xs text-[var(--color-text-tertiary)]">
          No entries to chart
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 pt-2',
        className,
      )}
      style={{ height }}
      role="img"
      aria-label={`Timeline histogram showing ${entries.length} log entries across ${buckets} time buckets`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          barCategoryGap="10%"
          barGap={1}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-light)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--color-text-tertiary)', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-primary-light)', opacity: 0.4 }} />
          <Legend
            iconSize={8}
            iconType="square"
            wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }}
          />
          {LOG_TYPES.map((logType) => (
            <Bar
              key={logType}
              dataKey={logType}
              stackId="a"
              fill={LOG_TYPE_COLORS[logType].bg}
              name={LOG_TYPE_COLORS[logType].label}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
