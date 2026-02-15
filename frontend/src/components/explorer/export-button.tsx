"use client";

import { useState } from "react";
import { getApiHeaders } from "@/lib/api";

interface ExportButtonProps {
  jobId: string;
  query: string;
  timeFrom?: string | null;
  timeTo?: string | null;
}

export function ExportButton({ jobId, query, timeFrom, timeTo }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "csv" | "json") => {
    setShowMenu(false);
    setExporting(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
      const params = new URLSearchParams({
        q: query || "*",
        format,
        limit: "10000",
      });
      if (timeFrom) params.set("time_from", timeFrom);
      if (timeTo) params.set("time_to", timeTo);

      const res = await fetch(
        `${API_BASE}/analysis/${jobId}/search/export?${params}`,
        { headers: getApiHeaders() }
      );

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `log-export-${jobId.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-accent disabled:opacity-50"
      >
        {exporting ? (
          <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        {exporting ? "Exporting..." : "Export"}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-lg z-50 min-w-[120px]">
          <button
            onClick={() => handleExport("csv")}
            className="w-full px-3 py-2 text-xs text-left hover:bg-accent"
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="w-full px-3 py-2 text-xs text-left hover:bg-accent"
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
