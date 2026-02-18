'use client'

/**
 * HealthScoreCard — T052
 *
 * Large card showing overall health score (0-100), status badge, and a
 * factor breakdown table. Color-coded by threshold:
 *   good    >= 80  → green
 *   warning >= 60  → yellow
 *   critical < 60  → red
 *
 * Usage:
 *   <HealthScoreCard healthScore={dashboardData.health_score} />
 */

import { cn } from '@/lib/utils'
import { getHealthScoreLevel } from '@/lib/constants'
import type { HealthScore, HealthScoreFactor, HealthSeverity } from '@/lib/api-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthScoreCardProps {
  healthScore: HealthScore
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVEL_STYLES = {
  good: {
    scoreBg: 'bg-[var(--color-success-light)]',
    scoreText: 'text-[var(--color-success)]',
    badgeBg: 'bg-[var(--color-success-light)]',
    badgeText: 'text-[var(--color-success)]',
    ring: 'ring-[var(--color-success)]',
    label: 'Healthy',
  },
  warning: {
    scoreBg: 'bg-[var(--color-warning-light)]',
    scoreText: 'text-[var(--color-warning)]',
    badgeBg: 'bg-[var(--color-warning-light)]',
    badgeText: 'text-[var(--color-warning)]',
    ring: 'ring-[var(--color-warning)]',
    label: 'Degraded',
  },
  critical: {
    scoreBg: 'bg-[var(--color-error-light)]',
    scoreText: 'text-[var(--color-error)]',
    badgeBg: 'bg-[var(--color-error-light)]',
    badgeText: 'text-[var(--color-error)]',
    ring: 'ring-[var(--color-error)]',
    label: 'Critical',
  },
} as const

function severityColor(severity: HealthSeverity): string {
  switch (severity) {
    case 'ok':
      return 'text-[var(--color-success)]'
    case 'warning':
      return 'text-[var(--color-warning)]'
    case 'critical':
      return 'text-[var(--color-error)]'
  }
}

function FactorBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const color =
    pct >= 80
      ? 'bg-[var(--color-success)]'
      : pct >= 60
        ? 'bg-[var(--color-warning)]'
        : 'bg-[var(--color-error)]'

  return (
    <div
      className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemax={maxScore}
      aria-valuemin={0}
    >
      <div
        className={cn('h-1.5 rounded-full transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function FactorRow({ factor }: { factor: HealthScoreFactor }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className="truncate text-xs text-[var(--color-text-primary)]"
          title={factor.description}
        >
          {factor.name}
        </span>
        <span
          className={cn(
            'shrink-0 text-xs font-mono font-semibold',
            severityColor(factor.severity)
          )}
        >
          {factor.score}/{factor.max_score}
        </span>
      </div>
      <FactorBar score={factor.score} maxScore={factor.max_score} />
      {factor.description && (
        <span className="text-[10px] leading-tight text-[var(--color-text-tertiary)]">
          {factor.description}
        </span>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// HealthScoreCard
// ---------------------------------------------------------------------------

export function HealthScoreCard({ healthScore, className }: HealthScoreCardProps) {
  const level = getHealthScoreLevel(healthScore.score)
  const styles = LEVEL_STYLES[level]

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Health Score
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Score + badge */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-20 w-20 shrink-0 items-center justify-center rounded-full ring-4',
              styles.scoreBg,
              styles.ring
            )}
            aria-label={`Health score: ${healthScore.score} out of 100`}
          >
            <span className={cn('text-3xl font-bold tabular-nums', styles.scoreText)}>
              {healthScore.score}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                styles.badgeBg,
                styles.badgeText
              )}
              role="status"
            >
              {styles.label}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Composite score across {healthScore.factors.length} factor
              {healthScore.factors.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Factor breakdown */}
        {healthScore.factors.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Factors
            </h3>
            <ul className="space-y-3" aria-label="Health score factors">
              {healthScore.factors.map((factor) => (
                <FactorRow key={factor.name} factor={factor} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
