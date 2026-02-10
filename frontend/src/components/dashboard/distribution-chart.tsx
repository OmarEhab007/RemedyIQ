"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DistributionChartProps {
  distribution: Record<string, Record<string, number>>;
}

export function DistributionChart({ distribution }: DistributionChartProps) {
  if (!distribution || Object.keys(distribution).length === 0) {
    return (
      <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground">
        No distribution data available
      </div>
    );
  }

  // Show by_type distribution if available, otherwise first available key.
  const categoryKey = distribution["by_type"]
    ? "by_type"
    : Object.keys(distribution)[0];
  const data = distribution[categoryKey];

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground">
        No distribution data available
      </div>
    );
  }

  const chartData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([name, value]) => ({ name, count: value }));

  return (
    <div className="border rounded-lg bg-card p-4">
      <h3 className="text-sm font-medium mb-4">
        Distribution by {categoryKey.replace("by_", "").replace("_", " ")}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            width={120}
          />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
