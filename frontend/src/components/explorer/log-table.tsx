"use client";

import * as ReactWindow from "react-window";
import type { SearchHit } from "@/hooks/use-search";

interface LogTableProps {
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
  selectedId?: string;
}

interface RowData {
  hits: SearchHit[];
  onSelect: (hit: SearchHit) => void;
  selectedId?: string;
}

const ROW_HEIGHT = 40;

function LogRow({ rowIndex, style, data }: { rowIndex: number; style: React.CSSProperties; data: RowData }) {
  const { hits, onSelect, selectedId } = data;
  const hit = hits[rowIndex];
  const fields = hit.fields || {};
  const isSelected = hit.id === selectedId;

  return (
    <div
      style={style}
      className={`flex items-center border-b text-xs cursor-pointer hover:bg-muted/50 transition-colors ${
        isSelected ? "bg-primary/10" : ""
      }`}
      onClick={() => onSelect(hit)}
    >
      <div className="w-16 px-2 text-muted-foreground font-mono">
        {fields.line_number || "-"}
      </div>
      <div className="w-16 px-2">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            fields.log_type === "API"
              ? "bg-blue-100 text-blue-800"
              : fields.log_type === "SQL"
              ? "bg-green-100 text-green-800"
              : fields.log_type === "FLTR"
              ? "bg-purple-100 text-purple-800"
              : "bg-orange-100 text-orange-800"
          }`}
        >
          {fields.log_type || "?"}
        </span>
      </div>
      <div className="w-24 px-2 text-muted-foreground">
        {fields.timestamp
          ? new Date(fields.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "-"}
      </div>
      <div className="w-20 px-2 font-mono">{fields.user || "-"}</div>
      <div className="w-24 px-2 truncate">{fields.form || fields.filter_name || fields.esc_name || "-"}</div>
      <div className="flex-1 px-2 truncate font-mono">
        {fields.api_code || fields.sql_statement || fields.raw_text || "-"}
      </div>
      <div className="w-20 px-2 text-right font-mono">
        {fields.duration_ms != null ? `${fields.duration_ms}ms` : "-"}
      </div>
      <div className="w-16 px-2">
        {fields.success != null && (
          <span className={fields.success ? "text-green-600" : "text-red-600"}>
            {fields.success ? "OK" : "ERR"}
          </span>
        )}
      </div>
    </div>
  );
}

export function LogTable({ hits, onSelect, selectedId }: LogTableProps) {
  if (hits.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No results found
      </div>
    );
  }

  const itemData: RowData = { hits, onSelect, selectedId };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center border-b bg-muted/50 text-xs font-medium">
        <div className="w-16 px-2 py-2">Line</div>
        <div className="w-16 px-2 py-2">Type</div>
        <div className="w-24 px-2 py-2">Time</div>
        <div className="w-20 px-2 py-2">User</div>
        <div className="w-24 px-2 py-2">Context</div>
        <div className="flex-1 px-2 py-2">Details</div>
        <div className="w-20 px-2 py-2 text-right">Duration</div>
        <div className="w-16 px-2 py-2">Status</div>
      </div>
      {/* Virtualized rows */}
      <div className="flex-1">
        <ReactWindow.List
          height={600}
          itemCount={hits.length}
          itemSize={ROW_HEIGHT}
          itemData={itemData}
        >
          {/* @ts-ignore react-window children type compatibility - known issue with @types/react-window */}
          {renderRow}
        </ReactWindow.List>
      </div>
    </div>
  );
}

LogRow.displayName = "LogRow";

// Render function for react-window - works around type compatibility issues
const renderRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) => (
  <LogRow rowIndex={index} style={style} data={data} />
);
