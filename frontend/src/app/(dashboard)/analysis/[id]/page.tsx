"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getDashboard,
  getDashboardAggregates,
  getDashboardExceptions,
  getDashboardGaps,
  getDashboardThreads,
  getDashboardFilters,
  type DashboardData,
} from "@/lib/api";
import { useLazySection } from "@/hooks/use-lazy-section";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopNTable } from "@/components/dashboard/top-n-table";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { DistributionChart } from "@/components/dashboard/distribution-chart";
import { AnomalyAlerts } from "@/components/dashboard/anomaly-alerts";
import { ReportButton } from "@/components/dashboard/report-button";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { AggregatesSection } from "@/components/dashboard/aggregates-section";
import { ExceptionsSection } from "@/components/dashboard/exceptions-section";
import { GapsSection } from "@/components/dashboard/gaps-section";
import { ThreadsSection } from "@/components/dashboard/threads-section";
import { FiltersSection } from "@/components/dashboard/filters-section";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";

interface Anomaly {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  metric: string;
  value: number;
  baseline: number;
  sigma: number;
  detected_at: string;
}

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const anomalies: Anomaly[] = [];

  useEffect(() => {
    if (!params.id) return;

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const dashboard = await getDashboard(params.id);
        setData(dashboard);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [params.id]);

  // Lazy-loaded sections
  const aggregates = useLazySection(() => getDashboardAggregates(params.id));
  const exceptions = useLazySection(() => getDashboardExceptions(params.id));
  const gaps = useLazySection(() => getDashboardGaps(params.id));
  const threads = useLazySection(() => getDashboardThreads(params.id));
  const filters = useLazySection(() => getDashboardFilters(params.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analysis Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Job ID: {params.id}
          </p>
        </div>
        <ReportButton jobId={params.id} />
      </div>

      <HealthScoreCard healthScore={data.health_score} />

      <AnomalyAlerts anomalies={anomalies} jobId={params.id} />

      <StatsCards stats={data.general_stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart data={data.time_series} />
        <DistributionChart distribution={data.distribution} />
      </div>

      <TopNTable
        apiCalls={data.top_api_calls || []}
        sqlStatements={data.top_sql_statements || []}
        filters={data.top_filters || []}
        escalations={data.top_escalations || []}
        jobId={params.id}
      />

      {/* Lazy-loaded collapsible sections */}
      <div ref={aggregates.ref}>
        <CollapsibleSection title="Aggregates">
          <AggregatesSection
            data={aggregates.data}
            loading={aggregates.loading}
            error={aggregates.error}
            refetch={aggregates.refetch}
            headless
          />
        </CollapsibleSection>
      </div>

      <div ref={exceptions.ref}>
        <CollapsibleSection title="Exceptions">
          <ExceptionsSection
            data={exceptions.data}
            loading={exceptions.loading}
            error={exceptions.error}
            refetch={exceptions.refetch}
            headless
          />
        </CollapsibleSection>
      </div>

      <div ref={gaps.ref}>
        <CollapsibleSection title="Gap Analysis">
          <GapsSection
            data={gaps.data}
            loading={gaps.loading}
            error={gaps.error}
            refetch={gaps.refetch}
            headless
          />
        </CollapsibleSection>
      </div>

      <div ref={threads.ref}>
        <CollapsibleSection title="Thread Statistics">
          <ThreadsSection
            data={threads.data}
            loading={threads.loading}
            error={threads.error}
            refetch={threads.refetch}
            headless
          />
        </CollapsibleSection>
      </div>

      <div ref={filters.ref}>
        <CollapsibleSection title="Filter Complexity">
          <FiltersSection
            data={filters.data}
            loading={filters.loading}
            error={filters.error}
            refetch={filters.refetch}
            headless
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
