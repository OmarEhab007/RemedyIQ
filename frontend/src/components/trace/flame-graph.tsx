"use client";

import { useMemo, useState } from "react";
import { SpanNode } from "@/lib/api";
import { getSpanColor, formatDuration } from "@/lib/trace-utils";

interface FlameGraphProps {
  spans: SpanNode[];
  totalDurationMs: number;
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string | null) => void;
}

interface FlameNode {
  span: SpanNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ROW_HEIGHT = 24;
const MIN_WIDTH = 2;

export function FlameGraph({
  spans,
  totalDurationMs,
  selectedSpanId,
  onSelectSpan,
}: FlameGraphProps) {
  const [hoveredSpan, setHoveredSpan] = useState<SpanNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const flameNodes = useMemo(() => {
    const nodes: FlameNode[] = [];
    const total = totalDurationMs || 1;

    function processNode(span: SpanNode, x: number, y: number, availableWidth: number) {
      const nodeWidth = Math.max((span.duration_ms / total) * availableWidth, MIN_WIDTH);
      nodes.push({
        span,
        x,
        y,
        width: nodeWidth,
        height: ROW_HEIGHT,
      });

      if (span.children && span.children.length > 0) {
        let childX = x;
        for (const child of span.children) {
          const childWidth = (child.duration_ms / total) * availableWidth;
          processNode(child, childX, y + ROW_HEIGHT + 1, childWidth);
          childX += childWidth;
        }
      }
    }

    for (const root of spans) {
      processNode(root, 0, 0, 100);
    }

    return nodes;
  }, [spans, totalDurationMs]);

  const maxY = useMemo(() => {
    return Math.max(...flameNodes.map((n) => n.y), 0) + ROW_HEIGHT;
  }, [flameNodes]);

  const handleMouseEnter = (span: SpanNode, e: React.MouseEvent) => {
    setHoveredSpan(span);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredSpan(null);
  };

  if (!spans || spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No spans to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium">Flame Graph</span>
        <span className="text-xs text-muted-foreground">
          {spans.length} root spans • Click to zoom
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <svg
          viewBox={`0 0 100 ${maxY + 10}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ minWidth: "600px", minHeight: `${Math.min(maxY + 40, 500)}px` }}
        >
          {flameNodes.map((node) => {
            const colors = getSpanColor(node.span.log_type);
            const isSelected = selectedSpanId === node.span.id;
            const hasError = !node.span.success || node.span.has_error;

            return (
              <g key={node.span.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  className={`${hasError ? "fill-red-200" : colors.bg.replace("bg-", "fill-")}`}
                  stroke={isSelected ? "var(--primary)" : hasError ? "#ef4444" : "var(--border)"}
                  strokeWidth={isSelected ? 2 : 1}
                  rx={2}
                  onClick={() => onSelectSpan(node.span.id)}
                  onMouseEnter={(e) => handleMouseEnter(node.span, e)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: "pointer" }}
                />
                {node.width > 8 && (
                  <text
                    x={node.x + 2}
                    y={node.y + ROW_HEIGHT / 2 + 3}
                    fontSize="3"
                    className="fill-foreground"
                    style={{ pointerEvents: "none" }}
                  >
                    {node.span.log_type}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredSpan && (
        <div
          className="fixed z-50 px-2 py-1 bg-card border rounded shadow-lg text-xs pointer-events-none"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
          }}
        >
          <div className="font-medium">{hoveredSpan.log_type}</div>
          <div className="text-muted-foreground">
            Duration: {formatDuration(hoveredSpan.duration_ms)}
          </div>
          {hoveredSpan.form && (
            <div className="text-muted-foreground">Form: {hoveredSpan.form}</div>
          )}
        </div>
      )}
    </div>
  );
}
