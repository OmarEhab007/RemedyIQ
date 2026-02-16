"use client";

import { SpanNode } from "@/lib/api";
import { getSpanColor, getSpanLabel, formatDuration, hasErrorChildren } from "@/lib/trace-utils";
import { ChevronRight, ChevronDown, AlertCircle } from "lucide-react";

interface WaterfallRowProps {
  span: SpanNode;
  totalDurationMs: number;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (spanId: string) => void;
  onToggleExpand: (spanId: string) => void;
  collapsed: boolean;
  showCriticalPath?: boolean;
}

export function WaterfallRow({
  span,
  totalDurationMs,
  depth,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  collapsed,
  showCriticalPath = false,
}: WaterfallRowProps) {
  const colors = getSpanColor(span.log_type);
  const hasChildren = span.children && span.children.length > 0;
  const label = getSpanLabel(span);
  const hasError = !span.success || span.has_error;
  const hasChildErrors = hasErrorChildren(span);
  const isOnCriticalPath = span.on_critical_path;
  
  const leftOffset = totalDurationMs > 0 
    ? (span.start_offset_ms / totalDurationMs) * 100 
    : 0;
  const barWidth = totalDurationMs > 0 
    ? Math.max((span.duration_ms / totalDurationMs) * 100, 0.5) 
    : 0;
  
  const indentPx = depth * 20;

  const getRowOpacity = (): string => {
    if (showCriticalPath && !isOnCriticalPath) {
      return "opacity-50";
    }
    return "";
  };
  
  return (
    <div
      className={`flex items-center h-12 border-b hover:bg-muted/30 cursor-pointer transition-colors ${
        isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
      } ${hasError ? "bg-red-50/50" : ""} ${getRowOpacity()}`}
      onClick={() => onSelect(span.id)}
      style={{ minWidth: "100%" }}
    >
      <div 
        className="flex items-center gap-1 px-2 shrink-0"
        style={{ paddingLeft: `${indentPx + 8}px`, width: "200px" }}
      >
        {hasChildren && !collapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(span.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
        {(!hasChildren || collapsed) && <div className="w-4" />}
        
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}
        >
          {span.log_type}
        </span>
        
        {hasError && (
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        )}
        {!hasError && hasChildErrors && (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        )}
        
        {showCriticalPath && isOnCriticalPath && (
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="On critical path" />
        )}
      </div>
      
      <div className="flex-1 relative h-6 mx-2">
        <div
          className={`absolute h-6 rounded ${colors.bg} border ${
            hasError ? "border-red-500 bg-red-100" : colors.border
          } ${isSelected ? "ring-1 ring-primary" : ""} ${
            showCriticalPath && isOnCriticalPath ? "border-l-4 border-l-amber-500" : ""
          }`}
          style={{
            left: `${leftOffset}%`,
            width: `${barWidth}%`,
            minWidth: "4px",
          }}
          title={`${label}: ${formatDuration(span.duration_ms)}${isOnCriticalPath ? " (Critical Path)" : ""}`}
        >
          {barWidth > 10 && (
            <span 
              className="absolute inset-0 flex items-center px-1 text-[10px] truncate text-foreground/70"
            >
              {formatDuration(span.duration_ms)}
            </span>
          )}
        </div>
      </div>
      
      <div className="w-32 px-2 shrink-0 text-xs text-muted-foreground truncate">
        {label}
      </div>
      
      <div className="w-20 px-2 shrink-0 text-xs text-right font-mono">
        {formatDuration(span.duration_ms)}
      </div>
    </div>
  );
}
