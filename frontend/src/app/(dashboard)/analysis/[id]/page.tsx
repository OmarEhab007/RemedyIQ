'use client'

/**
 * Analysis Dashboard Page — T064 (Reworked)
 *
 * Route: /analysis/:id
 *
 * Layout:
 *   - PageHeader with breadcrumb back to /analysis + ReportButton
 *   - HealthScoreCard + StatsCards (top row)
 *   - TimeSeriesChart (full width)
 *   - Tabbed TopN section (API | SQL | Filter | Escalation) — limited to 10 rows
 *   - DistributionChart (full width, compact)
 *   - Collapsible sections: Aggregates, Exceptions, Gaps, Threads, Filters
 */

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  useDashboard,
  useAnalysis,
  useQueuedCalls,
} from '@/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { PageState } from '@/components/ui/page-state'
import { HealthScoreCard } from '@/components/dashboard/health-score-card'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart'
import { DistributionChart } from '@/components/dashboard/distribution-chart'
import { TopNTable } from '@/components/dashboard/top-n-table'
import { ReportButton } from '@/components/dashboard/report-button'
import { ErrorOpsSummary } from '@/components/dashboard/error-ops-summary'
import { DashboardJobCompare } from '@/components/dashboard/dashboard-job-compare'
import {
  DashboardJumpNav,
  DashboardJumpNavMobile,
  type DashboardJumpLink,
} from '@/components/dashboard/dashboard-jump-nav'
import { ROUTES } from '@/lib/constants'
import { trackEvent } from '@/lib/telemetry'
import { cn } from '@/lib/utils'
import type { LogType } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// TopN Tab Configuration
// ---------------------------------------------------------------------------

type TopNTab = 'api' | 'sql' | 'filter' | 'escalation' | 'queued'

/** In-page anchors for the jump rail (see CollapsibleSection `id` pattern). */
const DASHBOARD_JUMP_LINKS: DashboardJumpLink[] = [
  { href: '#dashboard-overview', label: 'Overview & KPIs', shortLabel: 'Overview' },
  { href: '#dashboard-activity', label: 'Throughput & distribution', shortLabel: 'Charts' },
  { href: '#dashboard-explorer', label: 'Top entries table', shortLabel: 'Top N' },
]

const TOP_N_TABS: Array<{
  key: TopNTab
  label: string
  logType: LogType
  title: string
  dataKey: 'top_api_calls' | 'top_sql_statements' | 'top_filters' | 'top_escalations' | null
}> = [
  { key: 'api', label: 'API', logType: 'API', title: 'Top API Calls', dataKey: 'top_api_calls' },
  { key: 'sql', label: 'SQL', logType: 'SQL', title: 'Top SQL Statements', dataKey: 'top_sql_statements' },
  { key: 'filter', label: 'Filter', logType: 'FLTR', title: 'Top Filters', dataKey: 'top_filters' },
  { key: 'escalation', label: 'Escl', logType: 'ESCL', title: 'Top Escalations', dataKey: 'top_escalations' },
  { key: 'queued', label: 'Queued', logType: 'API', title: 'Longest Queued API Calls', dataKey: null },
]

// ---------------------------------------------------------------------------
// AnalysisDashboardPage
// ---------------------------------------------------------------------------

export default function AnalysisDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = typeof params?.id === 'string' ? params.id : (Array.isArray(params?.id) ? params.id[0] : '') ?? ''

  // Active TopN tab — auto-selects first non-empty tab once data loads
  const [activeTab, setActiveTab] = useState<TopNTab>('api')
  const [autoSelected, setAutoSelected] = useState(false)

  // Core dashboard data
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = useDashboard(jobId)

  const { data: job } = useAnalysis(jobId)

  // Queued calls — fetched lazily when the "Queued" tab is selected
  const { data: queuedCallsData } = useQueuedCalls(jobId, { enabled: activeTab === 'queued' })

  // Auto-select first non-empty tab when dashboard data arrives
  useEffect(() => {
    if (!dashboard || autoSelected) return
    const first = TOP_N_TABS.find((t) => t.dataKey && (dashboard[t.dataKey]?.length ?? 0) > 0)
    if (first) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot default tab from dashboard payload
      setActiveTab(first.key)
    }
    setAutoSelected(true)
  }, [dashboard, autoSelected])

  useEffect(() => {
    if (!jobId || dashboardLoading || dashboardError || !dashboard) return
    trackEvent('dashboard_render_complete', {
      job_id: jobId,
      entry_surface: 'analysis_dashboard',
      surface_version: 'phase1',
    })
  }, [jobId, dashboardLoading, dashboardError, dashboard])

  // Loading / error states
  if (dashboardLoading) {
    return <PageState variant="loading" rows={6} />
  }

  if (dashboardError || !dashboard) {
    return (
      <PageState
        variant="error"
        message="Failed to load dashboard data. The analysis may still be in progress."
        onRetry={() => void refetchDashboard()}
      />
    )
  }

  const { general_stats, health_score, time_series, distribution } = dashboard
  const totalEntries = general_stats.api_count + general_stats.sql_count + general_stats.filter_count + general_stats.esc_count
  const pageTitle = job ? `Analysis ${job.id.slice(0, 8)}` : 'Analysis Dashboard'
  const pageDescription = `${totalEntries.toLocaleString()} entries analyzed`

  // Get active tab config and data
  const activeTabConfig = TOP_N_TABS.find((t) => t.key === activeTab) ?? TOP_N_TABS[0]
  const activeTabData = activeTab === 'queued'
    ? (queuedCallsData?.queued_api_calls ?? [])
    : (activeTabConfig.dataKey ? dashboard[activeTabConfig.dataKey] ?? [] : [])

  return (
    <div className="analysis-dashboard-root">
      <div className="relative z-[1] xl:grid xl:grid-cols-[minmax(0,1fr)_12.5rem] xl:items-start xl:gap-8">
        <div className="min-w-0 space-y-5">
          <div id="dashboard-overview" className="scroll-mt-24 space-y-4">
            <PageHeader
              title={pageTitle}
              description={pageDescription}
              headingClassName="text-2xl sm:text-[1.65rem] font-semibold tracking-tight bg-gradient-to-r from-[var(--color-text-primary)] to-[var(--color-text-secondary)] bg-clip-text text-transparent"
              descriptionClassName="text-sm text-[var(--color-text-secondary)]"
              actions={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.ANALYSIS)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    aria-label="Back to analyses list"
                  >
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    All Jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent('core_workflow_entered', {
                        workflow_type: activeTab === 'queued' ? 'api' : activeTabConfig.key,
                        entry_surface: 'analysis_dashboard',
                        job_id: jobId,
                      })
                      trackEvent('nav_click', {
                        from_surface: 'analysis_dashboard',
                        to_surface: 'investigate',
                        workflow_type: activeTab === 'queued' ? 'api' : activeTabConfig.key,
                        job_id: jobId,
                      })
                      router.push(`${ROUTES.ANALYSIS_EXPLORER(jobId)}?workflow=${activeTab === 'queued' ? 'api' : activeTabConfig.key}`)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                  >
                    Log Explorer
                  </button>
                  <ReportButton jobId={jobId} />
                </div>
              }
            />

            <DashboardJumpNavMobile links={DASHBOARD_JUMP_LINKS} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {health_score && (
                <div className="lg:col-span-1">
                  <HealthScoreCard healthScore={health_score} />
                </div>
              )}
              <div className={health_score ? 'lg:col-span-2' : 'lg:col-span-3'}>
                <StatsCards
                  stats={general_stats}
                  distribution={distribution}
                  errorSummary={dashboard.error_summary}
                />
              </div>
            </div>

            <ErrorOpsSummary jobId={jobId} summary={dashboard.error_summary} />

            <DashboardJobCompare currentJobId={jobId} />
          </div>

          <div id="dashboard-activity" className="scroll-mt-24 grid grid-cols-1 gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <TimeSeriesChart data={time_series} />
            </div>
            <div className="xl:col-span-2">
              <DistributionChart distribution={distribution} />
            </div>
          </div>

          <div id="dashboard-explorer" className="scroll-mt-24">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
              <div
                className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                role="tablist"
                aria-label="Top entries by log type"
              >
                {TOP_N_TABS.map((tab) => {
                  const tabCount = tab.key === 'queued'
                    ? (queuedCallsData?.total ?? 0)
                    : (tab.dataKey ? dashboard[tab.dataKey]?.length ?? 0 : 0)
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      aria-controls={`tabpanel-${tab.key}`}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
                        activeTab === tab.key
                          ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-surface)]'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      )}
                    >
                      {tab.label}
                      <span className={cn(
                        'ml-1.5 text-[10px]',
                        tabCount > 0 ? 'opacity-60' : 'opacity-30'
                      )}>
                        ({tabCount})
                      </span>
                    </button>
                  )
                })}
              </div>

              <div
                id={`tabpanel-${activeTab}`}
                role="tabpanel"
                aria-label={activeTabConfig.title}
              >
                <TopNTable
                  entries={activeTabData}
                  title={activeTabConfig.title}
                  logType={activeTabConfig.logType}
                  maxRows={10}
                  compact
                />
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Detailed diagnostic sections are removed from this dashboard to keep focus on core workflows.
              Use <span className="font-medium text-[var(--color-text-primary)]">Log Explorer</span> for deep investigation.
            </p>
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-4">
            <DashboardJumpNav links={DASHBOARD_JUMP_LINKS} />
          </div>
        </aside>
      </div>
    </div>
  )
}
