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
  PieChart,
  Pie,
  Cell,
  Legend,
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

/** Distinct colors for log types matching the histogram palette. */
const LOG_TYPE_COLORS: Record<string, string> = {
  API: "#3b82f6",
  SQL: "#22c55e",
  FLTR: "#f97316",
  ESCL: "#a855f7",
};

const LOG_TYPE_LABELS: Record<string, string> = {
  API: "API",
  SQL: "SQL",
  FLTR: "Filter",
  ESCL: "Escalation",
};

/** Vibrant palette for non-type dimensions. */
const BAR_PALETTE = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899",
  "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#06b6d4",
  "#84cc16", "#f43f5e", "#8b5cf6", "#10b981", "#f59e0b",
];

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function PieTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number; percent: number; fill: string } }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: d.fill }} />
        <span className="font-medium">{d.name}</span>
      </div>
      <div className="text-muted-foreground mt-1">
        {d.count.toLocaleString()} entries ({d.percent.toFixed(1)}%)
      </div>
    </div>
  );
}

function BarTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number }; color?: string }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-medium truncate max-w-[200px]">{d.name}</div>
      <div className="text-muted-foreground">{d.count.toLocaleString()} entries</div>
    </div>
  );
}

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

  let data: Record<string, number> | undefined = distribution[dimension];
  if ((!data || Object.keys(data).length === 0) && aggregatesData) {
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

  const sortedEntries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = sortedEntries.reduce((sum, [, v]) => sum + v, 0);
  const isTypeView = dimension === "by_type";

  const chartData = sortedEntries
    .slice(0, topN)
    .map(([name, value], i) => ({
      name: isTypeView ? (LOG_TYPE_LABELS[name] || name) : name,
      rawName: name,
      count: value,
      percent: total > 0 ? (value / total) * 100 : 0,
      fill: isTypeView ? (LOG_TYPE_COLORS[name] || BAR_PALETTE[i % BAR_PALETTE.length]) : BAR_PALETTE[i % BAR_PALETTE.length],
    }));

  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">
            Distribution {dimensions.find((d) => d.key === dimension)?.label || ""}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCount(total)} total entries
          </p>
        </div>
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
          {!isTypeView && (
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
          )}
        </div>
      </div>

      {isTypeView ? (
        <div className="flex items-center">
          <ResponsiveContainer width="55%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-3 pl-2">
            {chartData.map((entry) => (
              <div key={entry.rawName} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: entry.fill }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCount(entry.count)}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${entry.percent}%`, background: entry.fill }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{entry.percent.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-20" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={formatCount}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={130}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<BarTooltipContent />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
