"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts";
import type { TimeSeriesPoint } from "@/lib/api";

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const [showDuration, setShowDuration] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Activity Over Time</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showDuration}
              onChange={(e) => setShowDuration(e.target.checked)}
              className="rounded border-gray-400 h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Duration</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showErrors}
              onChange={(e) => setShowErrors(e.target.checked)}
              className="rounded border-gray-400 h-3.5 w-3.5"
            />
            <span className="text-muted-foreground">Errors</span>
          </label>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="count" tick={{ fontSize: 12 }} />
          {showDuration && (
            <YAxis
              yAxisId="duration"
              orientation="right"
              tick={{ fontSize: 12 }}
              label={{ value: "ms", position: "insideTopRight", offset: -5, style: { fontSize: 10 } }}
            />
          )}
          <Tooltip />
          <Legend />
          <Line yAxisId="count" type="monotone" dataKey="api_count" name="API" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="sql_count" name="SQL" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="filter_count" name="Filter" stroke="#a855f7" strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="esc_count" name="Escalation" stroke="#f97316" strokeWidth={2} dot={false} />
          {showDuration && (
            <Line
              yAxisId="duration"
              type="monotone"
              dataKey="avg_duration_ms"
              name="Avg Duration (ms)"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
          {showErrors && (
            <Area
              yAxisId="count"
              type="monotone"
              dataKey="error_count"
              name="Errors"
              fill="#ef444433"
              stroke="#ef4444"
              strokeWidth={1}
            />
          )}
          {chartData.length > 10 && (
            <Brush
              dataKey="time"
              height={20}
              stroke="#8884d8"
              startIndex={0}
              endIndex={chartData.length - 1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
