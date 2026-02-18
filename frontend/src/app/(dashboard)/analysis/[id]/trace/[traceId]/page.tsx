'use client'

/**
 * analysis/[id]/trace/[traceId]/page.tsx — Single trace detail page.
 *
 * Uses useWaterfall(jobId, traceId).
 * Renders: header + ViewSwitcher + TraceFilters + active view + SpanDetail sidebar.
 */

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'
import { useWaterfall } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import { Waterfall } from '@/components/trace/waterfall'
import { SpanDetail } from '@/components/trace/span-detail'
import { ViewSwitcher } from '@/components/trace/view-switcher'
import { TraceFilters } from '@/components/trace/trace-filters'
import { CriticalPathToggle } from '@/components/trace/critical-path'
import type { SpanNode, LogType } from '@/lib/api-types'
import type { TraceView } from '@/components/trace/view-switcher'
import type { WaterfallFilters } from '@/components/trace/waterfall'

// Dynamically import heavy alternate views (only loaded when user switches)
const FlameGraph = dynamic(
  () => import('@/components/trace/flame-graph').then((m) => ({ default: m.FlameGraph })),
  { loading: () => <PageState variant="loading" rows={6} /> },
)
const SpanList = dynamic(
  () => import('@/components/trace/span-list').then((m) => ({ default: m.SpanList })),
  { loading: () => <PageState variant="loading" rows={6} /> },
)

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: WaterfallFilters = {
  logTypes: new Set<LogType>(),
  minDurationMs: 0,
  errorsOnly: false,
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TraceDetailPage() {
  const params = useParams<{ id: string; traceId: string }>()
  const jobId = params.id
  // Next.js passes URL-encoded params (e.g. %3A for :).
  // Decode to avoid double-encoding in API calls.
  const traceId = decodeURIComponent(params.traceId)

  const [activeView, setActiveView] = useState<TraceView>('waterfall')
  const [selectedSpan, setSelectedSpan] = useState<SpanNode | null>(null)
  const [showCriticalPath, setShowCriticalPath] = useState(false)
  const [filters, setFilters] = useState<WaterfallFilters>(DEFAULT_FILTERS)

  const { data, isLoading, isError, refetch } = useWaterfall(jobId, traceId)

  const handleSelectSpan = useCallback((span: SpanNode | null) => {
    setSelectedSpan(span)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedSpan(null)
  }, [])

  // Loading state
  if (isLoading) {
    return <PageState variant="loading" rows={8} />
  }

  // Error state
  if (isError || !data) {
    return (
      <PageState
        variant="error"
        title="Failed to load trace"
        message={`Could not fetch waterfall data for trace "${traceId}".`}
        onRetry={() => void refetch()}
      />
    )
  }

  const criticalSpans = data.flat_spans.filter((s) => s.on_critical_path)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Breadcrumb / header */}
      <div className="flex shrink-0 flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Link href={ROUTES.ANALYSIS_DETAIL(jobId)} className="hover:text-[var(--color-primary)] hover:underline">
              Analysis
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--color-text-primary)] font-medium">Trace</span>
          </nav>

          <h1 className="text-lg font-bold text-[var(--color-text-primary)] font-mono truncate">
            {traceId}
          </h1>

          {/* Stat pills */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>
              <strong className="text-[var(--color-text-primary)]">{data.total_duration_ms.toFixed(1)}</strong> ms total
            </span>
            <span>
              <strong className="text-[var(--color-text-primary)]">{data.span_count}</strong> spans
            </span>
            {data.error_count > 0 && (
              <span className="text-[var(--color-error)]">
                <strong>{data.error_count}</strong> error{data.error_count !== 1 ? 's' : ''}
              </span>
            )}
            {/* Type breakdown */}
            {data.type_breakdown.api_count > 0 && (
              <span className="text-[var(--color-primary)]">{data.type_breakdown.api_count} API</span>
            )}
            {data.type_breakdown.sql_count > 0 && (
              <span className="text-[var(--color-success)]">{data.type_breakdown.sql_count} SQL</span>
            )}
            {data.type_breakdown.filter_count > 0 && (
              <span className="text-[var(--color-warning)]">{data.type_breakdown.filter_count} FLTR</span>
            )}
            {data.type_breakdown.esc_count > 0 && (
              <span className="text-[var(--color-escalation)]">{data.type_breakdown.esc_count} ESCL</span>
            )}
          </div>
        </div>

        {/* View switcher */}
        <ViewSwitcher
          activeView={activeView}
          onChangeView={setActiveView}
          spanCount={data.span_count}
          className="shrink-0"
        />
      </div>

      {/* Filters + Critical path toggle */}
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <TraceFilters
          filters={filters}
          onChange={setFilters}
          className="flex-1"
        />
        <CriticalPathToggle
          enabled={showCriticalPath}
          onChange={setShowCriticalPath}
          criticalSpanCount={criticalSpans.length}
          totalSpanCount={data.span_count}
          criticalDurationMs={criticalSpans.reduce((sum, s) => sum + s.duration_ms, 0)}
          totalDurationMs={data.total_duration_ms}
          className="shrink-0"
        />
      </div>

      {/* Main content area: view + sidebar */}
      <div className={cn('flex flex-1 min-h-0 gap-4 overflow-hidden')}>
        {/* Active view panel */}
        <div
          className="flex-1 min-w-0 overflow-auto"
          role="tabpanel"
          id={`trace-panel-${activeView}`}
          aria-labelledby={`trace-tab-${activeView}`}
        >
          {activeView === 'waterfall' && (
            <Waterfall
              data={data}
              selectedSpanId={selectedSpan?.id ?? null}
              onSelectSpan={handleSelectSpan}
              showCriticalPath={showCriticalPath}
              filters={filters}
            />
          )}
          {activeView === 'flame-graph' && (
            <FlameGraph
              data={data}
              selectedSpanId={selectedSpan?.id ?? null}
              onSelectSpan={handleSelectSpan}
            />
          )}
          {activeView === 'span-list' && (
            <SpanList
              spans={data.flat_spans}
              selectedSpanId={selectedSpan?.id ?? null}
              onSelectSpan={handleSelectSpan}
            />
          )}
        </div>

        {/* Span detail sidebar */}
        {selectedSpan && (
          <div className="w-80 shrink-0 overflow-hidden">
            <SpanDetail span={selectedSpan} onClose={handleCloseDetail} className="h-full" />
          </div>
        )}
      </div>
    </div>
  )
}
