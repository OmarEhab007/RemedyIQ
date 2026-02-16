"use client";

import { useMemo } from "react";
import { WaterfallResponse, SpanNode } from "@/lib/api";
import { buildComparisonAlignment, getSpanColor, formatDuration, getSpanLabel } from "@/lib/trace-utils";
import { ArrowUp, ArrowDown, Minus, X } from "lucide-react";

interface TraceComparisonProps {
  traceA: WaterfallResponse;
  traceB: WaterfallResponse;
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string | null) => void;
  onClose: () => void;
}

export function TraceComparison({
  traceA,
  traceB,
  selectedSpanId,
  onSelectSpan,
  onClose,
}: TraceComparisonProps) {
  const alignment = useMemo(() => {
    return buildComparisonAlignment(traceA.spans, traceB.spans);
  }, [traceA.spans, traceB.spans]);

  const stats = useMemo(() => {
    let faster = 0;
    let slower = 0;
    let missing = 0;
    let anomalous = 0;

    for (const aligned of alignment) {
      if (!aligned.spanA || !aligned.spanB) {
        missing++;
      } else if (aligned.durationDelta < 0) {
        faster++;
      } else if (aligned.durationDelta > 0) {
        slower++;
      }
      if (aligned.isAnomalous) {
        anomalous++;
      }
    }

    return { faster, slower, missing, anomalous, total: alignment.length };
  }, [alignment]);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Trace Comparison</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <ArrowUp className="w-3 h-3" />
              {stats.faster} faster
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <ArrowDown className="w-3 h-3" />
              {stats.slower} slower
            </span>
            {stats.missing > 0 && (
              <span className="text-amber-600">
                {stats.missing} unmatched
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-0 flex-1 overflow-hidden">
        <div className="border-r overflow-auto">
          <div className="sticky top-0 bg-blue-50 border-b px-3 py-2 text-xs font-medium text-blue-700">
            Trace A: {traceA.trace_id.slice(0, 12)}...
            <span className="ml-2 font-normal text-blue-600">
              {formatDuration(traceA.total_duration_ms)}
            </span>
          </div>
          <div className="divide-y">
            {alignment.map((aligned, idx) => (
              <ComparisonRow
                key={idx}
                span={aligned.spanA}
                isAnomalous={aligned.isAnomalous}
                isSelected={aligned.spanA?.id === selectedSpanId}
                onSelect={onSelectSpan}
                side="A"
              />
            ))}
          </div>
        </div>

        <div className="border-r overflow-auto bg-muted/20">
          <div className="sticky top-0 bg-muted/50 border-b px-3 py-2 text-xs font-medium text-center">
            Delta
          </div>
          <div className="divide-y">
            {alignment.map((aligned, idx) => (
              <DeltaCell
                key={idx}
                delta={aligned.durationDelta}
                isAnomalous={aligned.isAnomalous}
                hasMatch={!!aligned.spanA && !!aligned.spanB}
              />
            ))}
          </div>
        </div>

        <div className="overflow-auto">
          <div className="sticky top-0 bg-green-50 border-b px-3 py-2 text-xs font-medium text-green-700">
            Trace B: {traceB.trace_id.slice(0, 12)}...
            <span className="ml-2 font-normal text-green-600">
              {formatDuration(traceB.total_duration_ms)}
            </span>
          </div>
          <div className="divide-y">
            {alignment.map((aligned, idx) => (
              <ComparisonRow
                key={idx}
                span={aligned.spanB}
                isAnomalous={aligned.isAnomalous}
                isSelected={aligned.spanB?.id === selectedSpanId}
                onSelect={onSelectSpan}
                side="B"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComparisonRowProps {
  span: SpanNode | null;
  isAnomalous: boolean;
  isSelected: boolean;
  onSelect: (spanId: string | null) => void;
  side: "A" | "B";
}

function ComparisonRow({ span, isAnomalous, isSelected, onSelect, side }: ComparisonRowProps) {
  if (!span) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground italic">
        {side === "A" ? "Only in Trace B" : "Only in Trace A"}
      </div>
    );
  }

  const colors = getSpanColor(span.log_type);
  const label = getSpanLabel(span);

  return (
    <div
      onClick={() => onSelect(span.id)}
      className={`px-3 py-2 cursor-pointer hover:bg-muted/30 ${
        isSelected ? "bg-primary/10" : ""
      } ${isAnomalous ? "bg-amber-50/50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}>
          {span.log_type}
        </span>
        <span className="text-xs truncate flex-1">{label}</span>
        <span className="text-xs font-mono text-muted-foreground">
          {formatDuration(span.duration_ms)}
        </span>
      </div>
    </div>
  );
}

interface DeltaCellProps {
  delta: number;
  isAnomalous: boolean;
  hasMatch: boolean;
}

function DeltaCell({ delta, isAnomalous, hasMatch }: DeltaCellProps) {
  if (!hasMatch) {
    return (
      <div className="px-3 py-2 text-xs text-center text-amber-600">
        —
      </div>
    );
  }

  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const color = isPositive ? "text-red-600" : isNegative ? "text-green-600" : "text-muted-foreground";
  const Icon = isPositive ? ArrowDown : isNegative ? ArrowUp : Minus;

  return (
    <div className={`px-3 py-2 text-xs text-center flex items-center justify-center gap-1 ${color} ${isAnomalous ? "font-medium" : ""}`}>
      <Icon className="w-3 h-3" />
      {isNegative ? "" : "+"}{formatDuration(Math.abs(delta))}
    </div>
  );
}
