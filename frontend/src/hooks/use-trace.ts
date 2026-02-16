"use client";

import { useState, useCallback } from "react";
import {
  WaterfallResponse,
  TransactionSummary,
  TransactionSearchParams,
  SpanNode,
  getWaterfall,
  searchTransactions,
} from "@/lib/api";

export type TraceView = "waterfall" | "flamegraph" | "spanlist";

export interface TraceFilters {
  logTypes: Set<string>;
  errorsOnly: boolean;
  minDurationMs: number | null;
  searchText: string;
}

export interface TraceState {
  traceId: string | null;
  waterfall: WaterfallResponse | null;
  selectedSpanId: string | null;
  activeView: TraceView;
  filters: TraceFilters;
  filteredSpans: SpanNode[];
  comparisonTrace: WaterfallResponse | null;
  aiInsights: string | null;
  loading: boolean;
  error: string | null;
}

export interface RecentTrace {
  traceId: string;
  jobId: string;
  user: string;
  timestamp: string;
  duration: number;
}

const defaultFilters: TraceFilters = {
  logTypes: new Set(["API", "SQL", "FLTR", "ESCL"]),
  errorsOnly: false,
  minDurationMs: null,
  searchText: "",
};

export function useTrace() {
  const [state, setState] = useState<TraceState>({
    traceId: null,
    waterfall: null,
    selectedSpanId: null,
    activeView: "waterfall",
    filters: defaultFilters,
    filteredSpans: [],
    comparisonTrace: null,
    aiInsights: null,
    loading: false,
    error: null,
  });

  const [recentTraces, setRecentTraces] = useState<RecentTrace[]>([]);

  const fetchWaterfall = useCallback(async (jobId: string, traceId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null, traceId }));
    try {
      const waterfall = await getWaterfall(jobId, traceId);
      setState((prev) => ({
        ...prev,
        waterfall,
        filteredSpans: waterfall.flat_spans,
        loading: false,
      }));
      
      setRecentTraces((prev) => {
        const newTrace: RecentTrace = {
          traceId,
          jobId,
          user: waterfall.primary_user,
          timestamp: waterfall.trace_start,
          duration: waterfall.total_duration_ms,
        };
        const filtered = prev.filter((t) => t.traceId !== traceId);
        return [newTrace, ...filtered].slice(0, 20);
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch trace",
      }));
    }
  }, []);

  const searchTransactionsByParams = useCallback(
    async (jobId: string, params: TransactionSearchParams): Promise<TransactionSummary[]> => {
      const response = await searchTransactions(jobId, params);
      return response.transactions || [];
    },
    []
  );

  const setSelectedSpan = useCallback((spanId: string | null) => {
    setState((prev) => ({ ...prev, selectedSpanId: spanId }));
  }, []);

  const switchView = useCallback((view: TraceView) => {
    setState((prev) => ({ ...prev, activeView: view }));
  }, []);

  const applyFilters = useCallback((newFilters: Partial<TraceFilters>) => {
    setState((prev) => {
      const updatedFilters = { ...prev.filters, ...newFilters };
      const filtered = filterSpans(prev.waterfall?.flat_spans || [], updatedFilters);
      return { ...prev, filters: updatedFilters, filteredSpans: filtered };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filters: defaultFilters,
      filteredSpans: prev.waterfall?.flat_spans || [],
    }));
  }, []);

  const setComparisonTrace = useCallback((trace: WaterfallResponse | null) => {
    setState((prev) => ({ ...prev, comparisonTrace: trace }));
  }, []);

  const setAiInsights = useCallback((insights: string | null) => {
    setState((prev) => ({ ...prev, aiInsights: insights }));
  }, []);

  const clearTrace = useCallback(() => {
    setState({
      traceId: null,
      waterfall: null,
      selectedSpanId: null,
      activeView: "waterfall",
      filters: defaultFilters,
      filteredSpans: [],
      comparisonTrace: null,
      aiInsights: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    recentTraces,
    fetchWaterfall,
    searchTransactions: searchTransactionsByParams,
    setSelectedSpan,
    switchView,
    applyFilters,
    clearFilters,
    setComparisonTrace,
    setAiInsights,
    clearTrace,
  };
}

function filterSpans(spans: SpanNode[], filters: TraceFilters): SpanNode[] {
  if (!spans.length) return [];

  let filtered = [...spans];

  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filtered = filtered.filter((span) => {
      const searchable = [
        span.operation,
        span.form,
        span.user,
        String(span.fields?.sql_statement || ""),
        String(span.fields?.filter_name || ""),
        String(span.fields?.api_code || ""),
        span.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(searchLower);
    });
  }

  if (filters.logTypes.size > 0 && filters.logTypes.size < 4) {
    filtered = filtered.filter((span) => filters.logTypes.has(span.log_type));
  }

  if (filters.errorsOnly) {
    filtered = filtered.filter((span) => !span.success || span.has_error);
  }

  if (filters.minDurationMs !== null && filters.minDurationMs > 0) {
    const minMs = filters.minDurationMs;
    filtered = filtered.filter((span) => span.duration_ms >= minMs);
  }

  return filtered;
}
