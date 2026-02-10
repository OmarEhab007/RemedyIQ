"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/api";

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground">
        No time series data available
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <div className="border rounded-lg bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Activity Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="api_count" name="API" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sql_count" name="SQL" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="filter_count" name="Filter" stroke="#a855f7" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="esc_count" name="Escalation" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
