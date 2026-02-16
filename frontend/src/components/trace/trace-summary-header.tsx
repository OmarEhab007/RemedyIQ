"use client";

import { WaterfallResponse } from "@/lib/api";
import { formatDuration, getSpanColor } from "@/lib/trace-utils";
import { Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";

interface TraceSummaryHeaderProps {
  data: WaterfallResponse;
  onClear: () => void;
}

export function TraceSummaryHeader({ data, onClear }: TraceSummaryHeaderProps) {
  const [copiedTraceId, setCopiedTraceId] = useState(false);

  const copyTraceId = async () => {
    await navigator.clipboard.writeText(data.trace_id);
    setCopiedTraceId(true);
    setTimeout(() => setCopiedTraceId(false), 2000);
  };

  const typeBreakdown = data.type_breakdown || {};
  const typeColors: Record<string, string> = {
    API: "bg-blue-100 text-blue-700 border-blue-200",
    SQL: "bg-green-100 text-green-700 border-green-200",
    FLTR: "bg-purple-100 text-purple-700 border-purple-200",
    ESCL: "bg-orange-100 text-orange-700 border-orange-200",
  };

  return (
    <div className="border-b bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Trace</h2>
          <button
            onClick={copyTraceId}
            className="flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-sm font-mono"
          >
            {data.trace_id.slice(0, 12)}...
            {copiedTraceId ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-lg font-semibold font-mono">
            {formatDuration(data.total_duration_ms)}
          </p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Spans</p>
          <p className="text-lg font-semibold">{data.span_count}</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">User</p>
          <p className="text-lg font-semibold truncate">{data.primary_user || "-"}</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Queue</p>
          <p className="text-lg font-semibold truncate">{data.primary_queue || "-"}</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Errors</p>
          <p className={`text-lg font-semibold ${data.error_count > 0 ? "text-red-600" : ""}`}>
            {data.error_count}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Types:</span>
        <div className="flex gap-1 flex-wrap">
          {Object.entries(typeBreakdown).map(([type, count]) => (
            <span
              key={type}
              className={`px-2 py-0.5 rounded border text-xs font-medium ${typeColors[type] || "bg-gray-100 text-gray-700 border-gray-200"}`}
            >
              {count} {type}
            </span>
          ))}
        </div>
        {data.error_count > 0 && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
            {data.error_count} errors
          </span>
        )}
        {data.correlation_type === "rpc_id" && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" />
            RPC ID fallback
          </span>
        )}
      </div>

      <MiniTimeline data={data} />
    </div>
  );
}

interface MiniTimelineProps {
  data: WaterfallResponse;
}

function MiniTimeline({ data }: MiniTimelineProps) {
  if (!data.flat_spans || data.flat_spans.length === 0) return null;

  const spans = data.flat_spans;
  const totalDuration = data.total_duration_ms || 1;

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Timeline Overview</p>
      <div className="h-4 bg-muted/30 rounded relative overflow-hidden">
        {spans.map((span) => {
          const left = (span.start_offset_ms / totalDuration) * 100;
          const width = Math.max((span.duration_ms / totalDuration) * 100, 0.5);
          const colors = getSpanColor(span.log_type);
          
          return (
            <div
              key={span.id}
              className={`absolute h-2 top-1 rounded-sm ${colors.bg} ${
                !span.success || span.has_error ? "bg-red-300" : ""
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                minWidth: "2px",
              }}
              title={`${span.log_type}: ${formatDuration(span.duration_ms)}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>0ms</span>
        <span>{formatDuration(data.total_duration_ms)}</span>
      </div>
    </div>
  );
}
