"use client";

import { useState, useMemo, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import { SpanNode, WaterfallResponse } from "@/lib/api";
import { TimestampRuler } from "./timestamp-ruler";
import { WaterfallRow } from "./waterfall-row";

interface WaterfallProps {
  data: WaterfallResponse;
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string | null) => void;
  filters?: {
    searchText?: string;
    logTypes?: Set<string>;
    errorsOnly?: boolean;
  };
  filteredSpanIds?: Set<string>;
  showCriticalPath?: boolean;
}

interface FlattenedRow {
  span: SpanNode;
  depth: number;
  hasChildren: boolean;
}

const ROW_HEIGHT = 48;

export function Waterfall({
  data,
  selectedSpanId,
  onSelectSpan,
  filters,
  filteredSpanIds,
  showCriticalPath = false,
}: WaterfallProps) {
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);

  const totalDurationMs = data.total_duration_ms;
  const traceStart = data.trace_start;
  const traceEnd = data.trace_end;

  const flattenedRows = useMemo(() => {
    const rows: FlattenedRow[] = [];
    const hasFilters = filters && (
      (filters.searchText && filters.searchText.length > 0) ||
      (filters.logTypes && filters.logTypes.size < 4) ||
      filters.errorsOnly
    );

    const isSpanVisible = (span: SpanNode): boolean => {
      if (!hasFilters) return true;
      if (filteredSpanIds && filteredSpanIds.size > 0) {
        return filteredSpanIds.has(span.id);
      }
      return true;
    };

    function flatten(nodes: SpanNode[], depth: number) {
      for (const node of nodes) {
        const hasChildren = node.children && node.children.length > 0;
        const isVisible = isSpanVisible(node);
        
        if (isVisible) {
          rows.push({ span: node, depth, hasChildren });
        }

        if (hasChildren && !collapsedSpans.has(node.id)) {
          flatten(node.children, depth + 1);
        }
      }
    }

    flatten(data.spans, 0);
    return rows;
  }, [data.spans, collapsedSpans, filters, filteredSpanIds]);

  const toggleExpand = useCallback((spanId: string) => {
    setCollapsedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  }, []);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z * 1.5, 5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z / 1.5, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  if (!data.spans || data.spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No trace spans to display
      </div>
    );
  }

  const scaledWidth = 800 * zoomLevel;

  const RowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = flattenedRows[index];
    return (
      <div style={style}>
        <WaterfallRow
          span={row.span}
          totalDurationMs={totalDurationMs}
          depth={row.depth}
          isSelected={selectedSpanId === row.span.id}
          isExpanded={!collapsedSpans.has(row.span.id)}
          onSelect={onSelectSpan}
          onToggleExpand={toggleExpand}
          collapsed={row.span.children?.length === 0}
          showCriticalPath={showCriticalPath}
        />
      </div>
    );
  };

  const isFiltered = filters && (
    (filters.searchText && filters.searchText.length > 0) ||
    (filters.logTypes && filters.logTypes.size < 4) ||
    filters.errorsOnly
  );

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium">Waterfall View</span>
        <span className="text-xs text-muted-foreground">
          {isFiltered ? `${flattenedRows.length} of ${data.span_count}` : data.span_count} spans
          {data.error_count > 0 && ` • ${data.error_count} errors`}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 text-xs border rounded hover:bg-muted"
            disabled={zoomLevel <= 0.5}
          >
            -
          </button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 text-xs border rounded hover:bg-muted"
            disabled={zoomLevel >= 5}
          >
            +
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs border rounded hover:bg-muted ml-1"
          >
            Reset
          </button>
        </div>
      </div>

      <TimestampRuler
        traceStart={traceStart}
        traceEnd={traceEnd}
        totalDurationMs={totalDurationMs}
        width={scaledWidth}
        zoomLevel={1}
      />

      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: `${scaledWidth + 360}px` }}>
          {flattenedRows.length > 0 ? (
            <List
              height={Math.min(600, flattenedRows.length * ROW_HEIGHT)}
              itemCount={flattenedRows.length}
              itemSize={ROW_HEIGHT}
              width="100%"
            >
              {RowRenderer}
            </List>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No spans match the current filters
            </div>
          )}
        </div>
      </div>

      {data.correlation_type === "rpc_id" && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
          Using RPC ID fallback (pre-19.x AR Server). Trace correlation may be incomplete.
        </div>
      )}
    </div>
  );
}
