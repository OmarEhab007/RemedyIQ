"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as ReactWindow from "react-window";
import type { SearchHit } from "@/hooks/use-search";

interface LogTableProps {
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
  selectedId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: string) => void;
  focusedRowIndex?: number | null;
  onFocusedRowChange?: (index: number | null) => void;
  tableRef?: React.RefObject<HTMLDivElement | null>;
}

const ROW_HEIGHT = 40;

/** Map raw ClickHouse log_type codes to human-readable labels. */
const LOG_TYPE_LABELS: Record<string, string> = {
  API: "API",
  SQL: "SQL",
  FLTR: "Filter",
  ESCL: "Escalation",
};

/** Type badge color config. */
const TYPE_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  API:  { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  SQL:  { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  FLTR: { bg: "bg-orange-50 dark:bg-orange-950/60", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  ESCL: { bg: "bg-purple-50 dark:bg-purple-950/60", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
};

const DEFAULT_BADGE = { bg: "bg-gray-50 dark:bg-gray-900", text: "text-gray-700 dark:text-gray-300", dot: "bg-gray-500" };

function LogRow({ index, style, hits, onSelect, selectedId, focusedRowIndex, onFocusRow }: {
  index: number;
  style: React.CSSProperties;
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
  selectedId?: string;
  focusedRowIndex?: number | null;
  onFocusRow: (index: number) => void;
}) {
  const rowIndex = index;
  const hit = hits[rowIndex];
  const fields = hit.fields || {};
  const isSelected = hit.id === selectedId;
  const isFocused = rowIndex === focusedRowIndex;
  const isEven = rowIndex % 2 === 0;
  const badge = TYPE_BADGE[fields.log_type] || DEFAULT_BADGE;

  return (
    <div
      style={style}
      tabIndex={0}
      data-row-index={rowIndex}
      className={`flex items-center text-[13px] cursor-pointer transition-colors outline-none border-b border-border/40 ${
        isSelected
          ? "bg-primary/10 dark:bg-primary/20"
          : isEven
          ? "bg-card"
          : "bg-muted/20"
      } ${
        !isSelected ? "hover:bg-accent/50" : ""
      } ${isFocused ? "ring-2 ring-primary ring-inset" : ""}`}
      onClick={() => onSelect(hit)}
      onFocus={() => onFocusRow(rowIndex)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(hit);
        }
      }}
    >
      <div className="w-[70px] px-3 text-muted-foreground font-mono tabular-nums shrink-0">
        {fields.line_number || "-"}
      </div>
      <div className="w-[90px] px-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.bg} ${badge.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          {LOG_TYPE_LABELS[fields.log_type] || fields.log_type || "?"}
        </span>
      </div>
      <div className="w-[110px] px-2 text-muted-foreground tabular-nums font-mono shrink-0 text-[12px]">
        {fields.timestamp
          ? new Date(fields.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              fractionalSecondDigits: 3,
            } as Intl.DateTimeFormatOptions)
          : "-"}
      </div>
      <div className="w-[100px] px-2 font-mono truncate shrink-0">{fields.user || "-"}</div>
      <div className="w-[140px] px-2 truncate shrink-0">{fields.form || fields.filter_name || fields.esc_name || "-"}</div>
      <div className="flex-1 px-2 truncate font-mono text-muted-foreground min-w-0">
        {fields.api_code || fields.sql_statement || fields.raw_text || "-"}
      </div>
      <div className="w-[80px] px-2 text-right font-mono tabular-nums shrink-0">
        {fields.duration_ms != null && fields.duration_ms > 0 ? (
          <span className={fields.duration_ms > 1000 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
            {fields.duration_ms >= 1000
              ? `${(fields.duration_ms / 1000).toFixed(1)}s`
              : `${fields.duration_ms}ms`}
          </span>
        ) : (
          <span className="text-muted-foreground/40">-</span>
        )}
      </div>
      <div className="w-[50px] px-2 text-center shrink-0">
        {fields.success != null ? (
          fields.success ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              &#10003;
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-bold">
              &#10007;
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}

export function LogTable({
  hits,
  onSelect,
  selectedId,
  sortBy,
  sortOrder,
  onSort,
  focusedRowIndex,
  onFocusedRowChange,
  tableRef,
}: LogTableProps) {
  const [internalFocusedRow, setInternalFocusedRow] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  const activeFocusedRow = focusedRowIndex ?? internalFocusedRow;

  const handleFocusRow = useCallback(
    (index: number) => {
      setInternalFocusedRow(index);
      onFocusedRowChange?.(index);
    },
    [onFocusedRowChange]
  );

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListHeight(Math.max(entry.contentRect.height, 100));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tableRef?.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextRow = activeFocusedRow === null ? 0 : Math.min(activeFocusedRow + 1, hits.length - 1);
        handleFocusRow(nextRow);
        const row = tableRef.current?.querySelector(`[data-row-index="${nextRow}"]`) as HTMLElement;
        row?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevRow = activeFocusedRow === null ? 0 : Math.max(activeFocusedRow - 1, 0);
        handleFocusRow(prevRow);
        const row = tableRef.current?.querySelector(`[data-row-index="${prevRow}"]`) as HTMLElement;
        row?.focus();
      }
    };

    const table = tableRef.current;
    table.addEventListener("keydown", handleKeyDown);
    return () => table.removeEventListener("keydown", handleKeyDown);
  }, [activeFocusedRow, hits.length, handleFocusRow, tableRef]);

  if (hits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-1">
        <p>No results found</p>
        <p className="text-xs">Try adjusting your search query or filters</p>
      </div>
    );
  }

  const rowProps = {
    hits,
    onSelect,
    selectedId,
    focusedRowIndex: activeFocusedRow,
    onFocusRow: handleFocusRow,
  };

  const renderSortableHeader = (field: string, label: string, widthClass: string, extraClass?: string) => (
    <div
      key={field}
      className={`${widthClass} px-2 py-2 select-none ${extraClass || ""} ${
        onSort ? "cursor-pointer hover:bg-muted/80 transition-colors" : ""
      }`}
      onClick={() => onSort?.(field)}
      role={onSort ? "button" : undefined}
      aria-sort={sortBy === field ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === field ? (
          <span className="text-primary font-bold">{sortOrder === "asc" ? "↑" : "↓"}</span>
        ) : (
          onSort && <span className="text-muted-foreground/40">↕</span>
        )}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full" ref={tableRef} tabIndex={-1}>
      <div className="flex items-center border-b bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {renderSortableHeader("line_number", "Line", "w-[70px] shrink-0")}
        {renderSortableHeader("log_type", "Type", "w-[90px] shrink-0")}
        {renderSortableHeader("timestamp", "Time", "w-[110px] shrink-0")}
        {renderSortableHeader("user", "User", "w-[100px] shrink-0")}
        <div className="w-[140px] px-2 py-2 shrink-0">Context</div>
        <div className="flex-1 px-2 py-2 min-w-0">Details</div>
        {renderSortableHeader("duration_ms", "Duration", "w-[80px] shrink-0", "text-right")}
        <div className="w-[50px] px-2 py-2 text-center shrink-0">Status</div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden" ref={listContainerRef}>
        <ReactWindow.List
          height={listHeight}
          rowCount={hits.length}
          rowHeight={ROW_HEIGHT}
          rowComponent={LogRow}
          rowProps={rowProps}
        />
      </div>
    </div>
  );
}

LogRow.displayName = "LogRow";
