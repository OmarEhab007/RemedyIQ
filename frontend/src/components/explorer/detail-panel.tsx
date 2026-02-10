"use client";

import type { SearchHit } from "@/hooks/use-search";

interface DetailPanelProps {
  entry: SearchHit;
  onClose: () => void;
}

export function DetailPanel({ entry, onClose }: DetailPanelProps) {
  const fields = entry.fields || {};

  return (
    <div className="w-96 border-l bg-card overflow-y-auto">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Log Entry Details</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Key fields */}
        <div className="space-y-2">
          <FieldRow label="Entry ID" value={entry.id} mono />
          <FieldRow label="Log Type" value={fields.log_type} badge />
          <FieldRow label="Line Number" value={fields.line_number} />
          <FieldRow label="Timestamp" value={fields.timestamp ? new Date(fields.timestamp).toLocaleString() : undefined} />
          <FieldRow label="Duration" value={fields.duration_ms != null ? `${fields.duration_ms}ms` : undefined} />
          <FieldRow label="Status" value={fields.success != null ? (fields.success ? "Success" : "Failed") : undefined} />
        </div>

        {/* Context */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Context</h4>
          <div className="space-y-2">
            <FieldRow label="User" value={fields.user} />
            <FieldRow label="Queue" value={fields.queue} />
            <FieldRow label="Thread" value={fields.thread_id} mono />
            <FieldRow label="Trace ID" value={fields.trace_id} mono />
            <FieldRow label="RPC ID" value={fields.rpc_id} mono />
          </div>
        </div>

        {/* Type-specific fields */}
        {fields.log_type === "API" && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">API Details</h4>
            <div className="space-y-2">
              <FieldRow label="API Code" value={fields.api_code} mono />
              <FieldRow label="Form" value={fields.form} />
            </div>
          </div>
        )}

        {fields.log_type === "SQL" && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">SQL Details</h4>
            <div className="space-y-2">
              <FieldRow label="Table" value={fields.sql_table} mono />
              <FieldRow label="Statement" value={fields.sql_statement} mono />
            </div>
          </div>
        )}

        {fields.log_type === "FLTR" && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Filter Details</h4>
            <div className="space-y-2">
              <FieldRow label="Filter Name" value={fields.filter_name} />
              <FieldRow label="Operation" value={fields.operation} />
            </div>
          </div>
        )}

        {fields.log_type === "ESCL" && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Escalation Details</h4>
            <div className="space-y-2">
              <FieldRow label="Escalation" value={fields.esc_name} />
              <FieldRow label="Pool" value={fields.esc_pool} />
            </div>
          </div>
        )}

        {/* Error message */}
        {fields.error_message && (
          <div>
            <h4 className="text-xs font-medium text-destructive uppercase mb-2">Error</h4>
            <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded whitespace-pre-wrap">
              {fields.error_message}
            </pre>
          </div>
        )}

        {/* Raw text */}
        {fields.raw_text && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Raw Text</h4>
            <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {fields.raw_text}
            </pre>
          </div>
        )}

        {/* All fields */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            All Fields ({Object.keys(fields).length})
          </summary>
          <pre className="mt-2 bg-muted p-2 rounded whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
            {JSON.stringify(fields, null, 2)}
          </pre>
        </details>
      </div>
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
  value?: string | number | boolean;
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
