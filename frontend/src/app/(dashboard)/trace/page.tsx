"use client";

import { useState } from "react";
import { Timeline } from "@/components/trace/timeline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface TraceEntry {
  id: string;
  log_type: string;
  timestamp: string;
  duration_ms: number;
  identifier: string;
  user?: string;
  form?: string;
  success: boolean;
  details?: string;
}

export default function TracePage() {
  const [traceId, setTraceId] = useState("");
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTrace = async () => {
    if (!traceId.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/search?q=${encodeURIComponent(`trace:${traceId}`)}`,
        {
          headers: {
            "X-Dev-User-ID": "dev-user",
            "X-Dev-Tenant-ID": "dev-tenant",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Trace search failed");
      }

      const data = await res.json();
      const mapped: TraceEntry[] = (data.results || []).map((hit: Record<string, unknown>) => {
        const fields = (hit as { fields?: Record<string, unknown> }).fields || {};
        return {
          id: (hit as { id?: string }).id || "",
          log_type: (fields.log_type as string) || "API",
          timestamp: (fields.timestamp as string) || "",
          duration_ms: (fields.duration_ms as number) || 0,
          identifier: (fields.api_code as string) || (fields.filter_name as string) || (fields.esc_name as string) || "-",
          user: fields.user as string,
          form: fields.form as string,
          success: (fields.success as boolean) ?? true,
        };
      });

      setEntries(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search trace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transaction Tracer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trace a transaction across API, SQL, Filter, and Escalation logs
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={traceId}
          onChange={(e) => setTraceId(e.target.value)}
          placeholder="Enter Trace ID or RPC ID..."
          className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          onKeyDown={(e) => e.key === "Enter" && searchTrace()}
        />
        <button
          onClick={searchTrace}
          disabled={loading || !traceId.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Trace"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-4">
            Found {entries.length} entries for trace {traceId}
          </div>
          <Timeline entries={entries} />
        </div>
      )}

      {!loading && entries.length === 0 && traceId && !error && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No entries found for this trace ID
        </div>
      )}
    </div>
  );
}
