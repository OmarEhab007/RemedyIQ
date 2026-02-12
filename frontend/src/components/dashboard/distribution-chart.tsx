"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AggregatesResponse } from "@/lib/api";

interface DistributionChartProps {
  distribution: Record<string, Record<string, number>>;
  aggregatesData?: AggregatesResponse | null;
}

const dimensions = [
  { key: "by_type", label: "By Type" },
  { key: "by_queue", label: "By Queue" },
  { key: "by_form", label: "By Form" },
  { key: "by_user", label: "By User" },
  { key: "by_table", label: "By Table" },
] as const;

const topNOptions = [5, 10, 15, 25, 50];

export function DistributionChart({ distribution, aggregatesData }: DistributionChartProps) {
  const [dimension, setDimension] = useState("by_type");
  const [topN, setTopN] = useState(10);

  if (!distribution || Object.keys(distribution).length === 0) {
    return (
      <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground">
        No distribution data available
      </div>
    );
  }

  // Build data based on selected dimension
  let data: Record<string, number> | undefined = distribution[dimension];
  if ((!data || Object.keys(data).length === 0) && aggregatesData) {
    // Compute distribution from aggregates data
    const distMap: Record<string, number> = {};
    if (dimension === "by_form" && aggregatesData.api) {
      for (const g of aggregatesData.api.groups) {
        distMap[g.name] = g.count;
      }
    } else if (dimension === "by_table" && aggregatesData.sql) {
      for (const g of aggregatesData.sql.groups) {
        distMap[g.name] = g.count;
      }
    }
    if (Object.keys(distMap).length > 0) {
      data = distMap;
    }
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="border rounded-lg bg-card p-6 text-center text-muted-foreground">
        No distribution data available for this dimension
      </div>
    );
  }

  const chartData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([name, value]) => ({ name, count: value }));

  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">
          Distribution {dimensions.find((d) => d.key === dimension)?.label || ""}
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            {dimensions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            {topNOptions.map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>
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
