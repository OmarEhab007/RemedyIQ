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
import type { GeneralStatistics, Distribution } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsCardsProps {
  stats: GeneralStatistics
  distribution?: Distribution
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
        'flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <span
        className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]"
        style={textColor ? { color: textColor } : undefined}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {description && (
        <span className="text-[11px] text-[var(--color-text-tertiary)] leading-tight">
          {description}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatsCards
// ---------------------------------------------------------------------------

export function StatsCards({ stats, distribution, className }: StatsCardsProps) {
  const errorRate = distribution?.error_rate ?? 0
  const errorRateDisplay = `${(errorRate * 100).toFixed(1)}%`

  const totalEntries =
    stats.api_count + stats.sql_count + stats.filter_count + stats.esc_count

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6',
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
    </div>
  )
}
