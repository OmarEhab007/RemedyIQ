"use client";

import { useState, useEffect, useRef } from "react";
import type { SearchHit } from "@/hooks/use-search";
import { getApiHeaders } from "@/lib/api";
import { ContextView } from "./context-view";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

/** Map raw ClickHouse log_type codes to human-readable labels. */
const LOG_TYPE_LABELS: Record<string, string> = {
  API: "API",
  SQL: "SQL",
  FLTR: "Filter",
  ESCL: "Escalation",
};

interface LogEntry {
  entry_id: string;
  line_number: number;
  file_number: number;
  timestamp: string;
  log_type: string;
  trace_id?: string;
  rpc_id?: string;
  thread_id?: string;
  queue?: string;
  user?: string;
  duration_ms?: number;
  queue_time_ms?: number;
  success?: boolean;
  api_code?: string;
  form?: string;
  sql_table?: string;
  sql_statement?: string;
  filter_name?: string;
  filter_level?: string;
  operation?: string;
  request_id?: string;
  esc_name?: string;
  esc_pool?: string;
  delay_ms?: number;
  error_encountered?: boolean;
  raw_text?: string;
  error_message?: string;
}

interface DetailPanelProps {
  entry: SearchHit;
  onClose: () => void;
  jobId?: string;
  onSearchRelated?: (field: string, value: string) => void;
}

export function DetailPanel({ entry, onClose, jobId, onSearchRelated }: DetailPanelProps) {
  const [fullEntry, setFullEntry] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const entryId = entry.id;

  useEffect(() => {
    if (!jobId || !entryId) {
      setFullEntry(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchFullEntry() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/analysis/${jobId}/entries/${entryId}`, {
          headers: getApiHeaders(),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Entry not found");
          }
          throw new Error("Failed to fetch entry");
        }

        const data: LogEntry = await res.json();
        setFullEntry(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch entry");
      } finally {
        setLoading(false);
      }
    }

    fetchFullEntry();
    return () => controller.abort();
  }, [jobId, entryId]);

  const fields = fullEntry || entry.fields || {};
  const logType = fields.log_type;

  const handleSearchRelated = (field: string, value: string) => {
    if (onSearchRelated && value) {
      onSearchRelated(field, value);
    }
  };

  return (
    <div className="w-96 border-l bg-card overflow-y-auto">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
        <h3 className="text-sm font-semibold">Log Entry Details</h3>
        <div className="flex items-center gap-2">
          {jobId && (
            <button
              onClick={() => setShowContext(true)}
              className="text-xs px-2 py-1 border rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="View surrounding entries"
            >
              Context
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close detail panel"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-muted-foreground border-t-primary rounded-full animate-spin mr-2" />
          Loading entry...
        </div>
      )}

      {error && (
        <div className="p-4 m-4 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <FieldRow label="Entry ID" value={entryId} mono />
            <FieldRow label="Log Type" value={logType ? (LOG_TYPE_LABELS[logType] || logType) : undefined} badge />
            <FieldRow label="Line Number" value={fields.line_number} />
            <FieldRow label="Timestamp" value={fields.timestamp ? new Date(fields.timestamp).toLocaleString() : undefined} />
            <FieldRow label="Duration" value={fields.duration_ms != null ? `${fields.duration_ms}ms` : undefined} />
            <FieldRow label="Status" value={fields.success != null ? (fields.success ? "Success" : "Failed") : undefined} />
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Context</h4>
            <div className="space-y-2">
              <FieldRow label="User" value={fields.user} />
              <FieldRow label="Queue" value={fields.queue} />
              <FieldRow label="Thread" value={fields.thread_id} mono />
              <ClickableFieldRow 
                label="Trace ID" 
                value={fields.trace_id} 
                mono 
                onClick={() => handleSearchRelated("trace_id", fields.trace_id || "")}
              />
              <ClickableFieldRow 
                label="RPC ID" 
                value={fields.rpc_id} 
                mono 
                onClick={() => handleSearchRelated("rpc_id", fields.rpc_id || "")}
              />
            </div>
          </div>

          {logType === "API" && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">API Details</h4>
              <div className="space-y-2">
                <FieldRow label="API Code" value={fields.api_code} mono />
                <FieldRow label="Form" value={fields.form} />
              </div>
            </div>
          )}

          {logType === "SQL" && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">SQL Details</h4>
              <div className="space-y-2">
                <FieldRow label="Table" value={fields.sql_table} mono />
                <FieldRow label="Statement" value={fields.sql_statement} mono />
              </div>
            </div>
          )}

          {logType === "FLTR" && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Filter Details</h4>
              <div className="space-y-2">
                <FieldRow label="Filter Name" value={fields.filter_name} />
                <FieldRow label="Operation" value={fields.operation} />
              </div>
            </div>
          )}

          {logType === "ESCL" && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Escalation Details</h4>
              <div className="space-y-2">
                <FieldRow label="Escalation" value={fields.esc_name} />
                <FieldRow label="Pool" value={fields.esc_pool} />
              </div>
            </div>
          )}

          {fields.error_message && (
            <div>
              <h4 className="text-xs font-medium text-destructive uppercase mb-2">Error</h4>
              <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded whitespace-pre-wrap">
                {fields.error_message}
              </pre>
            </div>
          )}

          {fields.raw_text && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Raw Text</h4>
              <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {fields.raw_text}
              </pre>
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              All Fields ({Object.keys(fields).length})
            </summary>
            <pre className="mt-2 bg-muted p-2 rounded whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
              {JSON.stringify(fields, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {showContext && jobId && entryId && (
        <ContextView
          jobId={jobId}
          entryId={entryId}
          onClose={() => setShowContext(false)}
        />
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value?: string | number | boolean | null;
  mono?: boolean;
  badge?: boolean;
}) {
  if (value == null || value === "") return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground min-w-[80px]">{label}</span>
      {badge ? (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
          {String(value)}
        </span>
      ) : (
        <span className={`text-xs break-all ${mono ? "font-mono" : ""}`}>
          {String(value)}
        </span>
      )}
    </div>
  );
}

function ClickableFieldRow({
  label,
  value,
  mono,
  onClick,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  onClick?: () => void;
}) {
  if (value == null || value === "") return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground min-w-[80px]">{label}</span>
      <button
        onClick={onClick}
        className={`text-xs break-all text-left hover:text-primary hover:underline cursor-pointer ${mono ? "font-mono" : ""}`}
        title={`Search for entries with ${label.toLowerCase()}: ${value}`}
      >
        {String(value)}
      </button>
    </div>
  );
}
