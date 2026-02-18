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
import { useCallback, useEffect, useState } from 'react'
import {
  useDashboard,
  useAnalysis,
  useDashboardAggregates,
  useDashboardExceptions,
  useDashboardGaps,
  useDashboardThreads,
  useDashboardFilters,
} from '@/hooks/use-api'
import { PageHeader } from '@/components/layout/page-header'
import { PageState } from '@/components/ui/page-state'
import { HealthScoreCard } from '@/components/dashboard/health-score-card'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { TimeSeriesChart } from '@/components/dashboard/time-series-chart'
import { DistributionChart } from '@/components/dashboard/distribution-chart'
import { TopNTable } from '@/components/dashboard/top-n-table'
import { CollapsibleSection } from '@/components/dashboard/collapsible-section'
import { AggregatesSection } from '@/components/dashboard/aggregates-section'
import { ExceptionsSection } from '@/components/dashboard/exceptions-section'
import { GapsSection } from '@/components/dashboard/gaps-section'
import { ThreadsSection } from '@/components/dashboard/threads-section'
import { FiltersSection } from '@/components/dashboard/filters-section'
import { ReportButton } from '@/components/dashboard/report-button'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type {
  LogType,
  AggregatesResponse,
  AggregateSection,
  AggregateGroup,
  ExceptionsResponse,
  ExceptionEntry,
  GapsResponse,
  GapEntry,
  QueueHealthSummary,
  ThreadStatsResponse,
  ThreadStatsEntry,
  FilterComplexityResponse,
  MostExecutedFilter,
  FilterPerTransaction,
} from '@/lib/api-types'

// ---------------------------------------------------------------------------
// API response normalizers
//
// The Go backend returns field names that differ from the frontend TypeScript
// types. These functions bridge the gap so section components receive the
// shapes they expect.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeAggregates(raw: any): AggregatesResponse | undefined {
  if (!raw) return undefined
  // Already in expected format
  if (Array.isArray(raw.sections)) return raw as AggregatesResponse

  const sections: AggregateSection[] = []

  // JAR-native format: { api_by_form: { grouped_by, groups: [{entity_name, rows, subtotal}] }, ... , source: "jar_parsed" }
  if (raw.source === 'jar_parsed') {
    const jarHeaders = ['OK', 'Fail', 'Total', 'Min (ms)', 'Max (ms)', 'Avg (ms)', 'Sum (ms)']
    for (const [key, label] of [
      ['api_by_form', 'API by Form'],
      ['api_by_client', 'API by Client'],
      ['api_by_client_ip', 'API by Client IP'],
      ['sql_by_table', 'SQL by Table'],
      ['esc_by_form', 'Escalation by Form'],
      ['esc_by_pool', 'Escalation by Pool'],
    ] as const) {
      const table = raw[key]
      if (!table?.groups?.length) continue
      const groups: AggregateGroup[] = table.groups.map((g: any) => {
        const rows = (g.rows ?? []).map((r: any) => ({
          label: r.operation_type ?? '',
          values: [r.ok ?? 0, r.fail ?? 0, r.total ?? 0, r.min_time ?? 0, r.max_time ?? 0, r.avg_time ?? 0, r.sum_time ?? 0],
        }))
        if (g.subtotal) {
          const s = g.subtotal
          rows.push({
            label: 'Subtotal',
            values: [s.ok ?? 0, s.fail ?? 0, s.total ?? 0, s.min_time ?? 0, s.max_time ?? 0, s.avg_time ?? 0, s.sum_time ?? 0],
          })
        }
        return { name: g.entity_name ?? '', headers: jarHeaders, rows }
      })
      if (groups.length > 0) {
        sections.push({ title: label, groups })
      }
    }
    return { job_id: raw.job_id ?? '', sections }
  }

  // Computed format: { api: { groups: [...], grand_total }, sql: {...}, filter: {...} }
  for (const [key, label] of [['api', 'API'], ['sql', 'SQL'], ['filter', 'Filter']] as const) {
    const section = raw[key]
    if (!section) continue
    const rawGroups: any[] = Array.isArray(section.groups) ? section.groups : []
    const headers = ['Count', 'Total (ms)', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'Errors', 'Error Rate']
    const groups: AggregateGroup[] = rawGroups.map((g: any) => ({
      name: g.name ?? '',
      headers,
      rows: [{
        label: g.name ?? '',
        values: [
          g.count ?? 0,
          g.total_ms ?? 0,
          typeof g.avg_ms === 'number' ? g.avg_ms.toFixed(2) : 0,
          g.min_ms ?? 0,
          g.max_ms ?? 0,
          g.error_count ?? 0,
          typeof g.error_rate === 'number' ? `${(g.error_rate * 100).toFixed(1)}%` : '0%',
        ],
      }],
    }))
    if (section.grand_total) {
      const gt = section.grand_total
      groups.push({
        name: 'Grand Total',
        headers,
        rows: [{
          label: 'Total',
          values: [
            gt.count ?? 0,
            gt.total_ms ?? 0,
            typeof gt.avg_ms === 'number' ? gt.avg_ms.toFixed(2) : 0,
            gt.min_ms ?? 0,
            gt.max_ms ?? 0,
            gt.error_count ?? 0,
            typeof gt.error_rate === 'number' ? `${(gt.error_rate * 100).toFixed(1)}%` : '0%',
          ],
        }],
      })
    }
    if (groups.length > 0) {
      sections.push({ title: `${label} Aggregates`, groups })
    }
  }
  return { job_id: raw.job_id ?? '', sections }
}

function normalizeExceptions(raw: any): ExceptionsResponse | undefined {
  if (!raw) return undefined

  const exceptions: ExceptionEntry[] = []

  // JAR-native format: { api_errors: [...], api_exceptions: [...], sql_exceptions: [...], source: "jar_parsed" }
  if (raw.source === 'jar_parsed') {
    // API errors: { end_line, trace_id, queue, api, form, user, start_time, error_message }
    for (const e of raw.api_errors ?? []) {
      exceptions.push({
        line_number: e.end_line ?? 0,
        timestamp: e.start_time ?? '',
        trace_id: e.trace_id ?? '',
        rpc_id: '',
        thread_id: '',
        queue: e.queue ?? '',
        user: e.user ?? '',
        log_type: 'API',
        message: e.error_message ?? '',
        stack_trace: null,
        form: e.form ?? null,
        duration_ms: null,
      })
    }
    // API exceptions: { line_number, trace_id, type, message, sql_statement }
    for (const e of raw.api_exceptions ?? []) {
      exceptions.push({
        line_number: e.line_number ?? 0,
        timestamp: '',
        trace_id: e.trace_id ?? '',
        rpc_id: '',
        thread_id: '',
        queue: '',
        user: '',
        log_type: 'API',
        message: `${e.type ?? ''}: ${e.message ?? ''}`.trim(),
        stack_trace: null,
        form: null,
        duration_ms: null,
      })
    }
    // SQL exceptions
    for (const e of raw.sql_exceptions ?? []) {
      exceptions.push({
        line_number: e.line_number ?? 0,
        timestamp: '',
        trace_id: e.trace_id ?? '',
        rpc_id: '',
        thread_id: '',
        queue: '',
        user: '',
        log_type: 'SQL',
        message: `${e.type ?? ''}: ${e.message ?? ''}`.trim(),
        stack_trace: e.sql_statement ?? null,
        form: null,
        duration_ms: null,
      })
    }
    return { job_id: raw.job_id ?? '', exceptions, total: exceptions.length }
  }

  // Computed format: { exceptions: [...], total_count, error_rates, top_codes }
  const total = raw.total ?? raw.total_count ?? raw.exceptions?.length ?? 0
  for (const e of raw.exceptions ?? []) {
    exceptions.push({
      line_number: e.line_number ?? e.sample_line ?? 0,
      timestamp: e.timestamp ?? e.first_seen ?? '',
      trace_id: e.trace_id ?? e.sample_trace ?? '',
      rpc_id: e.rpc_id ?? '',
      thread_id: e.thread_id ?? '',
      queue: e.queue ?? '',
      user: e.user ?? '',
      log_type: e.log_type ?? 'API',
      message: e.message ?? e.error_code ?? '',
      stack_trace: e.stack_trace ?? null,
      form: e.form ?? null,
      duration_ms: e.duration_ms ?? null,
    })
  }
  return { job_id: raw.job_id ?? '', exceptions, total }
}

function normalizeGaps(raw: any): GapsResponse | undefined {
  if (!raw) return undefined

  const gaps: GapEntry[] = []

  // JAR-native format: { line_gaps: [...], thread_gaps: [...], queue_health: [...], source: "jar_parsed" }
  if (raw.source === 'jar_parsed') {
    for (const g of [...(raw.line_gaps ?? []), ...(raw.thread_gaps ?? [])]) {
      gaps.push({
        start_time: g.timestamp ?? '',
        end_time: '',
        duration_ms: typeof g.gap_duration === 'number' ? Math.round(g.gap_duration * 1000) : 0,
        before_line: g.line_number ?? 0,
        after_line: 0,
        description: g.details ?? `Gap of ${g.gap_duration?.toFixed(1) ?? 0}s at line ${g.line_number ?? 0}`,
      })
    }
  } else {
    // Computed format: { gaps: [...] }
    for (const g of raw.gaps ?? []) {
      gaps.push({
        start_time: g.start_time ?? '',
        end_time: g.end_time ?? '',
        duration_ms: g.duration_ms ?? 0,
        before_line: g.before_line ?? 0,
        after_line: g.after_line ?? 0,
        description: g.description ?? '',
      })
    }
  }

  const queueHealth: QueueHealthSummary[] = (raw.queue_health ?? []).map((q: any) => ({
    queue: q.queue ?? '',
    total_requests: q.total_requests ?? q.total_calls ?? 0,
    error_count: q.error_count ?? 0,
    avg_duration_ms: q.avg_duration_ms ?? q.avg_ms ?? 0,
    max_duration_ms: q.max_duration_ms ?? q.p95_ms ?? 0,
    gap_count: q.gap_count ?? 0,
  }))
  return {
    job_id: raw.job_id ?? '',
    gaps,
    queue_health: queueHealth,
    total_gaps: raw.total_gaps ?? gaps.length,
  }
}

function normalizeThreads(raw: any): ThreadStatsResponse | undefined {
  if (!raw) return undefined

  const threadStats: ThreadStatsEntry[] = []

  // JAR-native format: { api_threads: [...], sql_threads: [...], source: "jar_parsed" }
  if (raw.source === 'jar_parsed') {
    // Merge API and SQL threads by thread_id
    const threadMap = new Map<string, ThreadStatsEntry>()
    for (const t of [...(raw.api_threads ?? []), ...(raw.sql_threads ?? [])]) {
      const tid = t.thread_id ?? ''
      const existing = threadMap.get(tid)
      if (existing) {
        existing.total_requests += t.count ?? 0
        existing.total_duration_ms += Math.round((t.total_time ?? 0) * 1000)
        existing.max_duration_ms = Math.max(existing.max_duration_ms, Math.round((t.total_time ?? 0) * 1000))
      } else {
        threadMap.set(tid, {
          thread_id: tid,
          queue: t.queue ?? '',
          total_requests: t.count ?? 0,
          error_count: 0,
          avg_duration_ms: Math.round((t.total_time ?? 0) / Math.max(t.count ?? 1, 1) * 1000),
          max_duration_ms: Math.round((t.total_time ?? 0) * 1000),
          min_duration_ms: 0,
          total_duration_ms: Math.round((t.total_time ?? 0) * 1000),
          unique_users: 0,
          unique_forms: 0,
        })
      }
    }
    threadStats.push(...threadMap.values())
  } else {
    // Computed format: { threads: [...] } or { thread_stats: [...] }
    const rawStats: any[] = raw.thread_stats ?? raw.threads ?? []
    for (const t of rawStats) {
      threadStats.push({
        thread_id: t.thread_id ?? '',
        queue: t.queue ?? '',
        total_requests: t.total_requests ?? t.total_calls ?? 0,
        error_count: t.error_count ?? 0,
        avg_duration_ms: t.avg_duration_ms ?? t.avg_ms ?? 0,
        max_duration_ms: t.max_duration_ms ?? t.max_ms ?? 0,
        min_duration_ms: t.min_duration_ms ?? t.min_ms ?? 0,
        total_duration_ms: t.total_duration_ms ?? t.total_ms ?? 0,
        unique_users: t.unique_users ?? 0,
        unique_forms: t.unique_forms ?? 0,
      })
    }
  }

  return {
    job_id: raw.job_id ?? '',
    thread_stats: threadStats,
    total_threads: raw.total_threads ?? threadStats.length,
  }
}

function normalizeFilters(raw: any): FilterComplexityResponse | undefined {
  if (!raw) return undefined

  // JAR-native most_executed: { filter_name, pass_count, fail_count }
  // Computed most_executed: { name, count, total_ms }
  // Frontend expects: { filter_name, execution_count, avg_duration_ms, ... }
  const mostExecuted: MostExecutedFilter[] = (raw.most_executed ?? []).map((f: any) => {
    const passCount = f.pass_count ?? 0
    const failCount = f.fail_count ?? 0
    const jarTotal = passCount + failCount
    const count = f.execution_count ?? f.count ?? (jarTotal > 0 ? jarTotal : 0)
    const totalMs = f.total_duration_ms ?? f.total_ms ?? 0
    return {
      filter_name: f.filter_name ?? f.name ?? '',
      execution_count: count,
      avg_duration_ms: f.avg_duration_ms ?? (count > 0 ? totalMs / count : 0),
      max_duration_ms: f.max_duration_ms ?? totalMs,
      total_duration_ms: totalMs,
      error_count: f.error_count ?? failCount,
      form: f.form ?? null,
    }
  })

  // JAR-native per_transaction: { line_number, trace_id, filter_count, operation, form, request_id, filters_per_sec }
  // Computed per_transaction: { transaction_id, filter_name, execution_count, total_ms, ... }
  const rawPerTxn: any[] = raw.filters_per_transaction ?? raw.per_transaction ?? []
  const filtersPerTxn: FilterPerTransaction[] = rawPerTxn.map((t: any) => ({
    trace_id: t.trace_id ?? t.transaction_id ?? '',
    rpc_id: t.rpc_id ?? t.request_id ?? '',
    timestamp: t.timestamp ?? '',
    filter_count: t.filter_count ?? t.execution_count ?? 0,
    total_filter_duration_ms: t.total_filter_duration_ms ?? t.total_ms ?? 0,
    user: t.user ?? '',
    queue: t.queue ?? '',
  }))

  // Compute avg/max if not present
  const counts = filtersPerTxn.map((t) => t.filter_count)
  const avgFilters = raw.avg_filters_per_transaction ?? (counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0)
  const maxFilters = raw.max_filters_per_transaction ?? (counts.length ? Math.max(...counts) : 0)
  return {
    job_id: raw.job_id ?? '',
    most_executed: mostExecuted,
    filters_per_transaction: filtersPerTxn,
    avg_filters_per_transaction: avgFilters,
    max_filters_per_transaction: maxFilters,
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// CountBadge
// ---------------------------------------------------------------------------

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// TopN Tab Configuration
// ---------------------------------------------------------------------------

type TopNTab = 'api' | 'sql' | 'filter' | 'escalation'

const TOP_N_TABS: Array<{
  key: TopNTab
  label: string
  logType: LogType
  title: string
  dataKey: 'top_api_calls' | 'top_sql_statements' | 'top_filters' | 'top_escalations'
}> = [
  { key: 'api', label: 'API', logType: 'API', title: 'Top API Calls', dataKey: 'top_api_calls' },
  { key: 'sql', label: 'SQL', logType: 'SQL', title: 'Top SQL Statements', dataKey: 'top_sql_statements' },
  { key: 'filter', label: 'Filter', logType: 'FLTR', title: 'Top Filters', dataKey: 'top_filters' },
  { key: 'escalation', label: 'Escl', logType: 'ESCL', title: 'Top Escalations', dataKey: 'top_escalations' },
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

  // Lazy-load states for collapsible sections
  const [aggregatesEnabled, setAggregatesEnabled] = useState(false)
  const [exceptionsEnabled, setExceptionsEnabled] = useState(false)
  const [gapsEnabled, setGapsEnabled] = useState(false)
  const [threadsEnabled, setThreadsEnabled] = useState(false)
  const [filtersEnabled, setFiltersEnabled] = useState(false)

  const { data: rawAggregates, isLoading: aggLoading } = useDashboardAggregates(
    jobId,
    undefined,
    { enabled: aggregatesEnabled }
  )
  const { data: rawExceptions, isLoading: excLoading } = useDashboardExceptions(
    exceptionsEnabled ? jobId : null
  )
  const { data: rawGaps, isLoading: gapsLoading } = useDashboardGaps(
    gapsEnabled ? jobId : null
  )
  const { data: rawThreads, isLoading: threadsLoading } = useDashboardThreads(
    threadsEnabled ? jobId : null
  )
  const { data: rawFilters, isLoading: filtersLoading } = useDashboardFilters(
    filtersEnabled ? jobId : null
  )

  // Normalize API responses to match component expectations
  const aggregates = normalizeAggregates(rawAggregates)
  const exceptions = normalizeExceptions(rawExceptions)
  const gaps = normalizeGaps(rawGaps)
  const threads = normalizeThreads(rawThreads)
  const filters = normalizeFilters(rawFilters)

  const handleAggExpand = useCallback(() => setAggregatesEnabled(true), [])
  const handleExcExpand = useCallback(() => setExceptionsEnabled(true), [])
  const handleGapsExpand = useCallback(() => setGapsEnabled(true), [])
  const handleThreadsExpand = useCallback(() => setThreadsEnabled(true), [])
  const handleFiltersExpand = useCallback(() => setFiltersEnabled(true), [])

  // Auto-select first non-empty tab when dashboard data arrives
  useEffect(() => {
    if (!dashboard || autoSelected) return
    const first = TOP_N_TABS.find((t) => (dashboard[t.dataKey]?.length ?? 0) > 0)
    if (first) {
      setActiveTab(first.key)
    }
    setAutoSelected(true)
  }, [dashboard, autoSelected])

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
  const activeTabData = dashboard[activeTabConfig.dataKey] ?? []

  return (
    <div className="space-y-5">
      {/* Header with breadcrumb */}
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
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
              onClick={() => router.push(ROUTES.ANALYSIS_EXPLORER(jobId))}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              Log Explorer
            </button>
            <ReportButton jobId={jobId} />
          </div>
        }
      />

      {/* Row 1: Health Score + Stats */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {health_score && (
          <div className="lg:col-span-1">
            <HealthScoreCard healthScore={health_score} />
          </div>
        )}
        <div className={health_score ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <StatsCards stats={general_stats} distribution={distribution} />
        </div>
      </div>

      {/* Row 2: Time series — full width */}
      <TimeSeriesChart data={time_series} />

      {/* Row 3: Tabbed Top-N + Distribution side-by-side */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Tabbed Top-N (spans 3 cols) */}
        <div className="xl:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            role="tablist"
            aria-label="Top entries by log type"
          >
            {TOP_N_TABS.map((tab) => {
              const tabData = dashboard[tab.dataKey] ?? []
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
                    tabData.length > 0 ? 'opacity-60' : 'opacity-30'
                  )}>
                    ({tabData.length})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tab panel */}
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

        {/* Distribution chart (spans 2 cols) */}
        <div className="xl:col-span-2">
          <DistributionChart distribution={distribution} />
        </div>
      </div>

      {/* Collapsible detail sections */}
      <div className="space-y-3" aria-label="Detailed analysis sections">
        <CollapsibleSection
          title="Aggregates"
          description="Statistical breakdowns by form, table, and filter"
          badge={aggregates?.sections?.length ? <CountBadge count={aggregates.sections.length} /> : undefined}
          onExpand={handleAggExpand}
          isLoading={aggLoading}
        >
          {aggregates && <AggregatesSection data={aggregates} />}
        </CollapsibleSection>

        <CollapsibleSection
          title="Exceptions"
          description="Errors and exceptions found in the log"
          badge={typeof exceptions?.total === 'number' ? <CountBadge count={exceptions.total} /> : undefined}
          onExpand={handleExcExpand}
          isLoading={excLoading}
        >
          {exceptions && <ExceptionsSection data={exceptions} />}
        </CollapsibleSection>

        <CollapsibleSection
          title="Timing Gaps"
          description="Periods of inactivity or log coverage breaks"
          badge={typeof gaps?.total_gaps === 'number' ? <CountBadge count={gaps.total_gaps} /> : undefined}
          onExpand={handleGapsExpand}
          isLoading={gapsLoading}
        >
          {gaps && <GapsSection data={gaps} />}
        </CollapsibleSection>

        <CollapsibleSection
          title="Thread Statistics"
          description="Per-thread request counts and duration statistics"
          badge={typeof threads?.total_threads === 'number' ? <CountBadge count={threads.total_threads} /> : undefined}
          onExpand={handleThreadsExpand}
          isLoading={threadsLoading}
        >
          {threads && <ThreadsSection data={threads} />}
        </CollapsibleSection>

        <CollapsibleSection
          title="Filter Complexity"
          description="Most executed filters and per-transaction filter counts"
          onExpand={handleFiltersExpand}
          isLoading={filtersLoading}
        >
          {filters && <FiltersSection data={filters} />}
        </CollapsibleSection>
      </div>
    </div>
  )
}
