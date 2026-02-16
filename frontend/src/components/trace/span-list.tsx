"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import { SpanNode } from "@/lib/api";
import { getSpanColor, formatDuration } from "@/lib/trace-utils";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";

type SortField = "timestamp" | "log_type" | "operation" | "duration_ms" | "user" | "form" | "status";
type SortDirection = "asc" | "desc";

interface SpanListProps {
  spans: SpanNode[];
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string | null) => void;
}

const ROW_HEIGHT = 40;

interface SortHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeader({ field, label, currentField, direction, onSort }: SortHeaderProps) {
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium hover:text-foreground ${
        isActive ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
      {isActive ? (
        direction === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

export function SpanList({ spans, selectedSpanId, onSelectSpan }: SpanListProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sortedSpans = useMemo(() => {
    const sorted = [...spans];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "timestamp":
          cmp = a.start_offset_ms - b.start_offset_ms;
          break;
        case "log_type":
          cmp = a.log_type.localeCompare(b.log_type);
          break;
        case "operation":
          cmp = (a.operation || "").localeCompare(b.operation || "");
          break;
        case "duration_ms":
          cmp = a.duration_ms - b.duration_ms;
          break;
        case "user":
          cmp = (a.user || "").localeCompare(b.user || "");
          break;
        case "form":
          cmp = (a.form || "").localeCompare(b.form || "");
          break;
        case "status":
          cmp = (a.success ? 1 : 0) - (b.success ? 1 : 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [spans, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (!spans || spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No spans to display
      </div>
    );
  }

  const RowRenderer = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const span = sortedSpans[index];
    const colors = getSpanColor(span.log_type);
    const hasError = !span.success || span.has_error;
    const isSelected = selectedSpanId === span.id;

    const getLabel = () => {
      switch (span.log_type) {
        case "API":
          return String(span.fields?.api_code || span.operation || "API Call");
        case "SQL":
          return String(span.fields?.sql_table || "SQL Query");
        case "FLTR":
          return String(span.fields?.filter_name || "Filter");
        case "ESCL":
          return String(span.fields?.esc_name || "Escalation");
        default:
          return span.operation || "-";
      }
    };

    return (
      <div
        style={style}
        onClick={() => onSelectSpan(span.id)}
        className={`flex items-center px-3 border-b cursor-pointer hover:bg-muted/30 ${
          isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
        } ${hasError ? "bg-red-50/50" : ""}`}
      >
        <div className="w-32 text-xs font-mono text-muted-foreground truncate">
          {span.start_offset_ms}ms
        </div>
        <div className="w-20">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.bg} ${colors.text}`}>
            {span.log_type}
          </span>
        </div>
        <div className="flex-1 text-xs truncate px-2">{getLabel()}</div>
        <div className="w-24 text-xs font-mono text-right px-2">
          {formatDuration(span.duration_ms)}
        </div>
        <div className="w-28 text-xs truncate px-2">{span.user || "-"}</div>
        <div className="w-40 text-xs truncate px-2">{span.form || "-"}</div>
        <div className="w-16 flex justify-center">
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-3 py-2 border-b bg-muted/30 text-xs font-medium">
        <div className="w-32">
          <SortHeader field="timestamp" label="Offset" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="w-20">
          <SortHeader field="log_type" label="Type" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="flex-1 px-2">
          <SortHeader field="operation" label="Operation" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="w-24 px-2 text-right">
          <SortHeader field="duration_ms" label="Duration" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="w-28 px-2">
          <SortHeader field="user" label="User" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="w-40 px-2">
          <SortHeader field="form" label="Form" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
        <div className="w-16 text-center">
          <SortHeader field="status" label="Status" currentField={sortField} direction={sortDirection} onSort={handleSort} />
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={containerRef}>
        <List
          height={containerHeight}
          itemCount={sortedSpans.length}
          itemSize={ROW_HEIGHT}
          width="100%"
        >
          {RowRenderer}
        </List>
      </div>
    </div>
  );
}
