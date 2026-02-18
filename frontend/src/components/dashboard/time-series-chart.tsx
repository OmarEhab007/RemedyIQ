'use client'

/**
 * TimeSeriesChart — T054
 *
 * Recharts area/line chart. X axis: timestamps, Y axis: counts per log type.
 * Series: API, SQL, FLTR, ESCL + error_count. Responsive container.
 * Themed to use CSS variable colors.
 *
 * Usage:
 *   <TimeSeriesChart data={dashboardData.time_series} />
 */

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { TimeSeriesPoint } from '@/lib/api-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[]
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

function formatTooltipLabel(ts: string): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

const SERIES = [
  { key: 'api_count', label: 'API', color: 'var(--color-primary)' },
  { key: 'sql_count', label: 'SQL', color: 'var(--color-success)' },
  { key: 'filter_count', label: 'Filter', color: 'var(--color-warning)' },
  { key: 'esc_count', label: 'Escalation', color: 'var(--color-escalation)' },
  { key: 'error_count', label: 'Errors', color: 'var(--color-error)' },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

interface TooltipEntry {
  dataKey?: string | number
  name?: string | number
  value?: number
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg text-xs"
      role="tooltip"
    >
      <p className="mb-2 font-medium text-[var(--color-text-primary)]">
        {label ? formatTooltipLabel(label) : ''}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={String(entry.dataKey ?? i)} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-[var(--color-text-secondary)]">{String(entry.name ?? '')}:</span>
            <span className="font-mono font-semibold text-[var(--color-text-primary)]">
              {(entry.value ?? 0).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimeSeriesChart
// ---------------------------------------------------------------------------

export function TimeSeriesChart({ data, className }: TimeSeriesChartProps) {
  const chartData = useMemo(
    () =>
      data.map((pt) => ({
        ...pt,
        _label: formatTimestamp(pt.timestamp),
      })),
    [data]
  )

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            Activity Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            No time series data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Activity Over Time
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="h-64" aria-label="Time series chart of log activity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                {SERIES.map(({ key, color }) => (
                  <linearGradient
                    key={key}
                    id={`grad-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-light)"
                vertical={false}
              />

              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTimestamp}
                tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />

              {SERIES.map(({ key, label, color }) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key as SeriesKey}
                  name={label}
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
