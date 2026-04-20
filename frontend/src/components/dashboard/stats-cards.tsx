'use client'

/**
 * StatsCards — T053
 *
 * Row of stat cards: total entries, API/SQL/Filter/Esc counts, error rate.
 * Each card is color-coded using LOG_TYPE_COLORS.
 *
 * Usage:
 *   <StatsCards stats={dashboardData.general_stats} distribution={dashboardData.distribution} />
 */

import { cn } from '@/lib/utils'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import type { GeneralStatistics, Distribution, ErrorSummary } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsCardsProps {
  stats: GeneralStatistics
  distribution?: Distribution
  /** JAR-primary error totals from dashboard.error_summary (when present). */
  errorSummary?: ErrorSummary
  className?: string
}

interface StatCardProps {
  label: string
  value: number | string
  accentColor: string
  textColor?: string
  description?: string
  className?: string
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accentColor,
  textColor,
  description,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[7rem] flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm',
        'border-l-[3px] transition-[transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-md',
        className
      )}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span
          className="line-clamp-2 min-h-[2rem] text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.12em]"
          title={label}
        >
          {label}
        </span>
      </div>
      <span
        className="truncate text-2xl font-bold tabular-nums text-[var(--color-text-primary)]"
        title={typeof value === 'number' ? value.toLocaleString() : value}
        style={textColor ? { color: textColor } : undefined}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {description && (
        <span
          className="line-clamp-2 text-[11px] leading-tight text-[var(--color-text-tertiary)]"
          title={description}
        >
          {description}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatsCards
// ---------------------------------------------------------------------------

export function StatsCards({ stats, distribution, errorSummary, className }: StatsCardsProps) {
  const errorRate = distribution?.error_rate ?? 0
  const errorRateDisplay = `${(errorRate * 100).toFixed(1)}%`

  const totalEntries =
    stats.api_count + stats.sql_count + stats.filter_count + stats.esc_count

  const gridCols =
    errorSummary && errorSummary.jar_event_total > 0
      ? 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7'
      : 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6'

  return (
    <div
      className={cn(
        'grid',
        gridCols,
        className
      )}
      role="region"
      aria-label="Summary statistics"
    >
      <StatCard
        label="Total Entries"
        value={totalEntries}
        accentColor="var(--color-text-tertiary)"
        description={stats.log_duration ?? undefined}
        className="sm:col-span-1"
      />

      <StatCard
        label="API"
        value={stats.api_count}
        accentColor={LOG_TYPE_COLORS.API.bg}
        description="AR Server API calls"
      />

      <StatCard
        label="SQL"
        value={stats.sql_count}
        accentColor={LOG_TYPE_COLORS.SQL.bg}
        description="Database queries"
      />

      <StatCard
        label="Filter"
        value={stats.filter_count}
        accentColor={LOG_TYPE_COLORS.FLTR.bg}
        description="Filter executions"
      />

      <StatCard
        label="Escalation"
        value={stats.esc_count}
        accentColor={LOG_TYPE_COLORS.ESCL.bg}
        description="Escalation events"
      />

      <StatCard
        label="Error Rate"
        value={errorRateDisplay}
        accentColor="var(--color-error)"
        textColor={errorRate > 0.05 ? 'var(--color-error)' : undefined}
        description={`${stats.unique_users} unique users`}
      />

      {errorSummary && errorSummary.jar_event_total > 0 && (
        <StatCard
          label="JAR error events"
          value={errorSummary.jar_event_total.toLocaleString()}
          accentColor="var(--color-error)"
          textColor="var(--color-error)"
          description="Rows in JAR exception sections"
        />
      )}
    </div>
  )
}
