"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
  Legend,
} from "recharts";

export interface HistogramBucket {
  timestamp: string;
  counts: {
    api: number;
    sql: number;
    fltr: number;
    escl: number;
    total: number;
  };
}

interface TimelineHistogramProps {
  data: HistogramBucket[];
  onRangeSelect: (start: Date, end: Date) => void;
  timeFrom?: string;
  timeTo?: string;
  height?: number;
}

const LOG_TYPES = [
  { key: "api", label: "API", color: "#3b82f6" },
  { key: "sql", label: "SQL", color: "#22c55e" },
  { key: "fltr", label: "Filter", color: "#f97316" },
  { key: "escl", label: "Escalation", color: "#a855f7" },
] as const;

function formatTimeAxis(tickItem: string, spanMs: number): string {
  const date = new Date(tickItem);
  if (spanMs < 60_000) {
    // Under 1 minute: show HH:MM:SS
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  if (spanMs < 24 * 3600_000) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipTime(label: string): string {
  const date = new Date(label);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce(
    (sum: number, entry: { value: number }) => sum + (entry.value || 0),
    0
  );

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-foreground mb-1.5 border-b border-border pb-1">
        {formatTooltipTime(String(label))}
      </div>
      <div className="space-y-0.5">
        {payload
          .filter((entry: { value: number }) => entry.value > 0)
          .reverse()
          .map((entry: { name: string; value: number; color: string }) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">
                  {LOG_TYPES.find((t) => t.key === entry.name)?.label || entry.name.toUpperCase()}
                </span>
              </div>
              <span className="font-medium text-foreground tabular-nums">
                {entry.value.toLocaleString()}
              </span>
            </div>
          ))}
      </div>
      {total > 0 && payload.filter((e: { value: number }) => e.value > 0).length > 1 && (
        <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-border text-foreground font-medium">
          <span>Total</span>
          <span className="tabular-nums">{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground -mt-1">
      {payload.map((entry: { value: string; color: string }) => (
        <div key={entry.value} className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span>{LOG_TYPES.find((t) => t.key === entry.value)?.label || entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TimelineHistogram({
  data,
  onRangeSelect,
  timeFrom,
  timeTo,
  height = 180,
}: TimelineHistogramProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const effectiveSelectionStart = isSelecting ? selectionStart : (timeFrom ?? null);
  const effectiveSelectionEnd = isSelecting ? selectionEnd : (timeTo ?? null);

  const { chartData, timeSpanMs, maxBarSize } = useMemo(() => {
    const mapped = data.map((bucket) => ({
      timestamp: bucket.timestamp,
      api: bucket.counts.api,
      sql: bucket.counts.sql,
      fltr: bucket.counts.fltr,
      escl: bucket.counts.escl,
      total: bucket.counts.total,
    }));

    let spanMs = 0;
    if (mapped.length >= 2) {
      const first = new Date(mapped[0].timestamp).getTime();
      const last = new Date(mapped[mapped.length - 1].timestamp).getTime();
      spanMs = last - first;
    }

    // Limit bar width for sparse data
    const maxBar = mapped.length <= 5 ? 40 : mapped.length <= 15 ? 30 : undefined;

    return { chartData: mapped, timeSpanMs: spanMs, maxBarSize: maxBar };
  }, [data]);

  // Map mouse x-coordinate to a data index, accounting for chart margins and Y-axis width.
  const xToIndex = useCallback(
    (clientX: number): number | null => {
      if (!chartRef.current || data.length === 0) return null;
      const rect = chartRef.current.getBoundingClientRect();
      // Chart has margin left:0 + YAxis width:40, margin right:12
      const plotLeft = 40;
      const plotRight = 12;
      const plotWidth = rect.width - plotLeft - plotRight;
      if (plotWidth <= 0) return null;
      const x = clientX - rect.left - plotLeft;
      const xPercent = Math.max(0, Math.min(1, x / plotWidth));
      const index = Math.min(data.length - 1, Math.floor(xPercent * data.length));
      return index >= 0 ? index : null;
    },
    [data]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const index = xToIndex(e.clientX);
      if (index === null) return;
      setIsSelecting(true);
      setSelectionStart(data[index].timestamp);
      setSelectionEnd(data[index].timestamp);
    },
    [data, xToIndex]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting) return;
      const index = xToIndex(e.clientX);
      if (index === null) return;
      setSelectionEnd(data[index].timestamp);
    },
    [isSelecting, data, xToIndex]
  );

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      return;
    }
    let startDate = new Date(selectionStart < selectionEnd ? selectionStart : selectionEnd);
    let endDate = new Date(selectionStart < selectionEnd ? selectionEnd : selectionStart);

    // Single click on one bucket: extend to cover that bucket's interval
    if (startDate.getTime() === endDate.getTime() && data.length >= 2) {
      const bucketMs = new Date(data[1].timestamp).getTime() - new Date(data[0].timestamp).getTime();
      endDate = new Date(startDate.getTime() + bucketMs);
    }

    if (startDate.getTime() !== endDate.getTime()) {
      onRangeSelect(startDate, endDate);
    }
    setIsSelecting(false);
  }, [isSelecting, selectionStart, selectionEnd, onRangeSelect, data]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) handleMouseUp();
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isSelecting, handleMouseUp]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/30 rounded border text-muted-foreground text-sm"
        style={{ height }}
      >
        No histogram data available
      </div>
    );
  }

  const minTime =
    effectiveSelectionStart && effectiveSelectionEnd
      ? effectiveSelectionStart < effectiveSelectionEnd
        ? effectiveSelectionStart
        : effectiveSelectionEnd
      : null;
  const maxTime =
    effectiveSelectionStart && effectiveSelectionEnd
      ? effectiveSelectionStart < effectiveSelectionEnd
        ? effectiveSelectionEnd
        : effectiveSelectionStart
      : null;

  return (
    <div
      ref={chartRef}
      className="relative rounded-lg border bg-card cursor-crosshair select-none"
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(tick) => formatTimeAxis(tick, timeSpanMs)}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxis}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
          />
          <Legend content={<CustomLegend />} />
          {LOG_TYPES.map(({ key, color }) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="logtype"
              fill={color}
              fillOpacity={0.85}
              radius={key === "escl" ? [2, 2, 0, 0] : undefined}
              maxBarSize={maxBarSize}
            />
          ))}
          {minTime && maxTime && !isSelecting && (
            <ReferenceArea
              x1={minTime}
              x2={maxTime}
              stroke="#3b82f6"
              strokeOpacity={0.6}
              fill="#3b82f6"
              fillOpacity={0.08}
            />
          )}
          {isSelecting && selectionStart && selectionEnd && (
            <ReferenceArea
              x1={selectionStart < selectionEnd ? selectionStart : selectionEnd}
              x2={selectionStart < selectionEnd ? selectionEnd : selectionStart}
              stroke="#3b82f6"
              strokeOpacity={0.8}
              fill="#3b82f6"
              fillOpacity={0.15}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      <div className="absolute top-2 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
        Drag to select range
      </div>
    </div>
  );
}
