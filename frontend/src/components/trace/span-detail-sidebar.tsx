"use client";

import { SpanNode } from "@/lib/api";
import { getSpanColor, formatDuration } from "@/lib/trace-utils";
import { Highlight, themes } from "prism-react-renderer";
import { ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";

interface SpanDetailSidebarProps {
  selectedSpan: SpanNode | null;
  totalDuration: number;
  traceId: string;
  jobId: string;
}

interface CopyableFieldProps {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

function CopyableField({ label, value, field, copiedField, onCopy }: CopyableFieldProps) {
  return (
    <div className="py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        onClick={() => onCopy(value, field)}
        className="flex items-center gap-1.5 text-xs font-mono break-all mt-0.5 hover:bg-muted px-1.5 py-0.5 rounded w-full text-left"
      >
        <span className="flex-1 break-all">{value}</span>
        {copiedField === field ? (
          <Check className="w-3 h-3 text-green-500 shrink-0" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
      </button>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function FieldRow({ label, value, mono = false }: FieldRowProps) {
  return (
    <div className="py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={`text-xs break-all mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

interface TypeDetailsProps {
  fields: Record<string, unknown>;
}

function APISpanDetails({ fields }: TypeDetailsProps) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">API Details</h4>
      <div className="space-y-0.5">
        {fields.operation !== undefined && (
          <FieldRow label="Operation" value={String(fields.operation)} mono />
        )}
        {fields.api_code !== undefined && (
          <FieldRow label="API Code" value={String(fields.api_code)} mono />
        )}
        {fields.form !== undefined && (
          <FieldRow label="Form" value={String(fields.form)} />
        )}
        {fields.overlay_group !== undefined && (
          <FieldRow label="Overlay Group" value={String(fields.overlay_group)} />
        )}
        {fields.request_id !== undefined && (
          <FieldRow label="Request ID" value={String(fields.request_id)} mono />
        )}
      </div>
    </div>
  );
}

function SQLSpanDetails({ fields }: TypeDetailsProps) {
  const sqlStatement = fields.sql_statement as string | undefined;
  const durationMs = typeof fields.duration_ms === "number" ? fields.duration_ms : 0;
  const queueTimeMs = typeof fields.queue_time_ms === "number" ? fields.queue_time_ms : 0;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">SQL Details</h4>
      <div className="space-y-0.5">
        {fields.sql_table !== undefined && (
          <FieldRow label="Table" value={String(fields.sql_table)} mono />
        )}
        <FieldRow label="Execution Time" value={formatDuration(durationMs)} mono />
        {queueTimeMs > 0 && (
          <FieldRow label="Queue Time" value={formatDuration(queueTimeMs)} mono />
        )}
      </div>

      {sqlStatement && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-1">SQL Statement</h5>
          <div className="rounded-md border bg-muted/30 overflow-auto max-h-80">
            <Highlight
              theme={themes.vsLight}
              code={sqlStatement}
              language="sql"
            >
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre className={`${className} text-xs p-2`} style={style}>
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSpanDetails({ fields }: TypeDetailsProps) {
  const isSuccess = fields.success === true;
  const filterLevel = typeof fields.filter_level === "number" ? fields.filter_level : fields.filter_level;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">Filter Details</h4>
      <div className="space-y-0.5">
        {fields.filter_name !== undefined && (
          <FieldRow label="Filter Name" value={String(fields.filter_name)} />
        )}
        {filterLevel !== undefined && (
          <FieldRow label="Filter Level" value={`Phase ${String(filterLevel)}`} />
        )}
        {fields.operation !== undefined && (
          <FieldRow label="Operation" value={String(fields.operation)} mono />
        )}
        {fields.form !== undefined && (
          <FieldRow label="Form" value={String(fields.form)} />
        )}
        {fields.success !== undefined && (
          <div className="py-1.5">
            <span className="text-xs text-muted-foreground">Status</span>
            <div className={`text-xs font-medium mt-0.5 ${isSuccess ? "text-green-600" : "text-red-600"}`}>
              {isSuccess ? "Pass" : "Fail"}
            </div>
          </div>
        )}
        {fields.request_id !== undefined && (
          <FieldRow label="Request ID" value={String(fields.request_id)} mono />
        )}
      </div>
    </div>
  );
}

function EscalationSpanDetails({ fields }: TypeDetailsProps) {
  const delayMs = typeof fields.delay_ms === "number" ? fields.delay_ms : 0;
  const hasError = fields.error_encountered === true;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">Escalation Details</h4>
      <div className="space-y-0.5">
        {fields.esc_name !== undefined && (
          <FieldRow label="Name" value={String(fields.esc_name)} />
        )}
        {fields.esc_pool !== undefined && (
          <FieldRow label="Pool" value={String(fields.esc_pool)} />
        )}
        {fields.scheduled_time !== undefined && (
          <FieldRow label="Scheduled" value={String(fields.scheduled_time)} mono />
        )}
        {delayMs > 0 && (
          <FieldRow label="Delay" value={formatDuration(delayMs)} mono />
        )}
        {fields.error_encountered !== undefined && (
          <div className="py-1.5">
            <span className="text-xs text-muted-foreground">Error</span>
            <div className={`text-xs font-medium mt-0.5 ${hasError ? "text-red-600" : "text-green-600"}`}>
              {hasError ? "Yes" : "No"}
            </div>
          </div>
        )}
        {fields.error_message !== undefined && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <p className="font-medium">Error Message:</p>
            <p className="mt-1 font-mono text-[10px] break-all">{String(fields.error_message)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SpanDetailSidebar({
  selectedSpan,
  totalDuration,
  traceId,
  jobId,
}: SpanDetailSidebarProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!selectedSpan) {
    return null;
  }

  const colors = getSpanColor(selectedSpan.log_type);
  const percentOfTotal = totalDuration > 0
    ? ((selectedSpan.duration_ms / totalDuration) * 100).toFixed(1)
    : "0";

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API unavailable or permission denied
    }
  };

  const renderTypeSpecificDetails = () => {
    const fields = selectedSpan.fields || {};

    switch (selectedSpan.log_type) {
      case "API":
        return <APISpanDetails fields={fields} />;
      case "SQL":
        return <SQLSpanDetails fields={fields} />;
      case "FLTR":
        return <FilterSpanDetails fields={fields} />;
      case "ESCL":
        return <EscalationSpanDetails fields={fields} />;
      default:
        return null;
    }
  };

  const logExplorerUrl = `/explorer?job_id=${jobId}&entry_id=${selectedSpan.id}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
          {selectedSpan.log_type}
        </span>
        <span className="font-semibold text-sm">Span Details</span>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pr-1">
        {selectedSpan.has_error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">
              <p className="font-medium">Error detected</p>
              {selectedSpan.error_message && (
                <p className="mt-1 font-mono text-[10px] break-all">{selectedSpan.error_message}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Common Fields</h4>
          <div className="space-y-0.5">
            <FieldRow label="Timestamp" value={selectedSpan.timestamp || "-"} mono />
            <FieldRow label="Duration" value={formatDuration(selectedSpan.duration_ms)} mono />
            <FieldRow label="% of Total" value={`${percentOfTotal}%`} mono />
            <CopyableField
              label="Thread ID"
              value={selectedSpan.thread_id || "-"}
              field="thread_id"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
            <CopyableField
              label="Trace ID"
              value={traceId}
              field="trace_id"
              copiedField={copiedField}
              onCopy={copyToClipboard}
            />
            {selectedSpan.rpc_id && (
              <CopyableField
                label="RPC ID"
                value={selectedSpan.rpc_id}
                field="rpc_id"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
            )}
            {selectedSpan.user && (
              <FieldRow label="User" value={selectedSpan.user} />
            )}
            {selectedSpan.queue && (
              <FieldRow label="Queue" value={selectedSpan.queue} />
            )}
            {selectedSpan.form && (
              <FieldRow label="Form" value={selectedSpan.form} />
            )}
          </div>
        </div>

        <hr />

        {renderTypeSpecificDetails()}
      </div>

      <div className="pt-3 mt-auto">
        <a
          href={logExplorerUrl}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <ExternalLink className="w-4 h-4" />
          View in Log Explorer
        </a>
      </div>
    </div>
  );
}
