"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDashboard, type DashboardData } from "@/lib/api";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopNTable } from "@/components/dashboard/top-n-table";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { DistributionChart } from "@/components/dashboard/distribution-chart";
import { AnomalyAlerts } from "@/components/dashboard/anomaly-alerts";
import { ReportButton } from "@/components/dashboard/report-button";

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
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  useEffect(() => {
    if (!params.id) return;

    async function fetchDashboard() {
      try {
        setLoading(true);
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
      />
    </div>
  );
}
