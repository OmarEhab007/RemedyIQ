"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface LogEntry {
  entry_id: string;
  line_number: number;
  timestamp: string;
  log_type: string;
  duration_ms?: number;
  user?: string;
  success?: boolean;
  raw_text?: string;
}

interface ContextResponse {
  target: LogEntry;
  before: LogEntry[];
  after: LogEntry[];
  window_size: number;
}

interface ContextViewProps {
  jobId: string;
  entryId: string;
  onClose: () => void;
  onSelectEntry?: (entry: LogEntry) => void;
}

export function ContextView({ jobId, entryId, onClose, onSelectEntry }: ContextViewProps) {
  const [data, setData] = useState<ContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState(10);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    async function fetchContext() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/analysis/${jobId}/entries/${entryId}/context?window=${windowSize}`,
          { headers: getApiHeaders() }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch context");
        }

        const contextData: ContextResponse = await res.json();
        setData(contextData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch context");
      } finally {
        setLoading(false);
      }
    }

    fetchContext();
  }, [jobId, entryId, windowSize]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "API":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "SQL":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "FLTR":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "ESCL":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const renderEntry = (entry: LogEntry, isTarget: boolean = false) => (
    <div
      key={entry.entry_id}
      role="button"
      tabIndex={0}
      className={`flex items-start gap-2 py-1.5 px-2 text-xs cursor-pointer hover:bg-accent/50 rounded outline-none focus:ring-2 focus:ring-primary ${
        isTarget ? "bg-primary/10 border-l-2 border-primary" : ""
      }`}
      onClick={() => onSelectEntry?.(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelectEntry?.(entry);
      }}
    >
      <span className="text-muted-foreground w-16 shrink-0 font-mono">
        {formatTime(entry.timestamp)}
      </span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getLogTypeColor(entry.log_type)}`}>
        {entry.log_type}
      </span>
      <span className="text-muted-foreground w-12 shrink-0">
        {entry.duration_ms != null ? `${entry.duration_ms}ms` : "-"}
      </span>
      <span className="truncate flex-1" title={entry.raw_text}>
        {entry.raw_text?.substring(0, 80) || entry.entry_id}
        {entry.raw_text && entry.raw_text.length > 80 ? "..." : ""}
      </span>
      <span className="text-muted-foreground w-16 shrink-0 text-right font-mono">
        #{entry.line_number}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Entry context view">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Entry Context</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Window:</span>
              <select
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="h-5 w-5 border-2 border-muted-foreground border-t-primary rounded-full animate-spin mr-2" />
              Loading context...
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground mb-2 px-2">
                {(data.before ?? []).length} entries before | Target | {(data.after ?? []).length} entries after
              </div>

              {(data.before ?? []).map((entry) => renderEntry(entry, false))}
              {data.target && renderEntry(data.target, true)}
              {(data.after ?? []).map((entry) => renderEntry(entry, false))}
            </div>
          )}
        </div>

        <div className="p-4 border-t text-xs text-muted-foreground">
          Click an entry to view details
        </div>
      </div>
    </div>
  );
}
