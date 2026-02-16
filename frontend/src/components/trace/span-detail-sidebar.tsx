"use client";

import { SpanNode } from "@/lib/api";
import { getSpanColor, formatDuration } from "@/lib/trace-utils";
import { Highlight, themes } from "prism-react-renderer";
import { X, ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";

interface SpanDetailSidebarProps {
  selectedSpan: SpanNode | null;
  totalDuration: number;
  traceId: string;
  jobId: string;
  onClose: () => void;
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
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <button
        onClick={() => onCopy(value, field)}
        className="flex items-center gap-1 text-xs font-mono hover:bg-muted px-1.5 py-0.5 rounded"
      >
        {value.length > 16 ? `${value.slice(0, 16)}...` : value}
        {copiedField === field ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
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
      <div className="space-y-1 text-sm">
        {fields.operation !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Operation:</span>
            <span className="text-xs font-mono">{String(fields.operation)}</span>
          </div>
        )}
        {fields.api_code !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">API Code:</span>
            <span className="text-xs font-mono">{String(fields.api_code)}</span>
          </div>
        )}
        {fields.form !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Form:</span>
            <span className="text-xs">{String(fields.form)}</span>
          </div>
        )}
        {fields.overlay_group !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Overlay Group:</span>
            <span className="text-xs">{String(fields.overlay_group)}</span>
          </div>
        )}
        {fields.request_id !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Request ID:</span>
            <span className="text-xs font-mono">{String(fields.request_id)}</span>
          </div>
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
      <div className="space-y-1 text-sm">
        {fields.sql_table !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Table:</span>
            <span className="text-xs font-mono">{String(fields.sql_table)}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Execution Time:</span>
          <span className="text-xs font-mono">{formatDuration(durationMs)}</span>
        </div>
        {queueTimeMs > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Queue Time:</span>
            <span className="text-xs font-mono">{formatDuration(queueTimeMs)}</span>
          </div>
        )}
      </div>

      {sqlStatement && (
        <div className="mt-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-1">SQL Statement</h5>
          <div className="rounded-md border bg-muted/30 overflow-auto max-h-48">
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
      <div className="space-y-1 text-sm">
        {fields.filter_name !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Filter Name:</span>
            <span className="text-xs">{String(fields.filter_name)}</span>
          </div>
        )}
        {filterLevel !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Filter Level:</span>
            <span className="text-xs">Phase {String(filterLevel)}</span>
          </div>
        )}
        {fields.operation !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Operation:</span>
            <span className="text-xs font-mono">{String(fields.operation)}</span>
          </div>
        )}
        {fields.form !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Form:</span>
            <span className="text-xs">{String(fields.form)}</span>
          </div>
        )}
        {fields.success !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className={`text-xs font-medium ${isSuccess ? "text-green-600" : "text-red-600"}`}>
              {isSuccess ? "Pass" : "Fail"}
            </span>
          </div>
        )}
        {fields.request_id !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Request ID:</span>
            <span className="text-xs font-mono">{String(fields.request_id)}</span>
          </div>
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
      <div className="space-y-1 text-sm">
        {fields.esc_name !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Name:</span>
            <span className="text-xs">{String(fields.esc_name)}</span>
          </div>
        )}
        {fields.esc_pool !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Pool:</span>
            <span className="text-xs">{String(fields.esc_pool)}</span>
          </div>
        )}
        {fields.scheduled_time !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Scheduled:</span>
            <span className="text-xs font-mono">{String(fields.scheduled_time)}</span>
          </div>
        )}
        {delayMs > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Delay:</span>
            <span className="text-xs font-mono">{formatDuration(delayMs)}</span>
          </div>
        )}
        {fields.error_encountered !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Error:</span>
            <span className={`text-xs font-medium ${hasError ? "text-red-600" : "text-green-600"}`}>
              {hasError ? "Yes" : "No"}
            </span>
          </div>
        )}
        {fields.error_message !== undefined && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <p className="font-medium">Error Message:</p>
            <p className="mt-1 font-mono text-[10px]">{String(fields.error_message)}</p>
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
  onClose,
}: SpanDetailSidebarProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!selectedSpan) {
    return (
      <div className="w-80 border-l bg-card flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Span Details</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <p className="text-sm text-muted-foreground">
            Click a span to view details
          </p>
        </div>
      </div>
    );
  }

  const colors = getSpanColor(selectedSpan.log_type);
  const percentOfTotal = totalDuration > 0 
    ? ((selectedSpan.duration_ms / totalDuration) * 100).toFixed(1) 
    : "0";

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
            {selectedSpan.log_type}
          </span>
          <h3 className="font-semibold">Span Details</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {selectedSpan.has_error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">
              <p className="font-medium">Error detected</p>
              {selectedSpan.error_message && (
                <p className="mt-1 font-mono text-[10px]">{selectedSpan.error_message}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Common Fields</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Timestamp:</span>
              <span className="text-xs font-mono">{selectedSpan.timestamp || "-"}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">Duration:</span>
              <span className="text-xs font-mono">{formatDuration(selectedSpan.duration_ms)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">% of Total:</span>
              <span className="text-xs font-mono">{percentOfTotal}%</span>
            </div>
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
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">User:</span>
                <span className="text-xs">{selectedSpan.user}</span>
              </div>
            )}
            {selectedSpan.queue && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Queue:</span>
                <span className="text-xs">{selectedSpan.queue}</span>
              </div>
            )}
            {selectedSpan.form && (
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Form:</span>
                <span className="text-xs">{selectedSpan.form}</span>
              </div>
            )}
          </div>
        </div>

        <hr />

        {renderTypeSpecificDetails()}
      </div>

      <div className="p-4 border-t">
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
