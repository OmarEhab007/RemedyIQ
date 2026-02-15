"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { getApiHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export interface HistogramBucket {
  timestamp: string;
  counts: {
    api: number;
    sql: number;
    fltr: number;
    escl: number;
    total: number;
  };
}

export interface SearchHit {
  id: string;
  score: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: Record<string, any>;
}

export interface FacetEntry {
  value: string;
  count: number;
}

export interface SearchResponse {
  results: SearchHit[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  facets?: Record<string, FacetEntry[]>;
  histogram?: HistogramBucket[];
  took_ms?: number;
}

export interface UseSearchOptions {
  jobId: string;
  filters?: Record<string, string[]>;
  pageSize?: number;
  includeHistogram?: boolean;
}

interface SearchOverrides {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  timeFrom?: string | null;
  timeTo?: string | null;
}

export function useSearch(options: UseSearchOptions) {
  const { jobId, filters, pageSize = 50, includeHistogram = true } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [sortBy, setSortBy] = useState(searchParams.get("sort_by") || "timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("sort_order") as "asc" | "desc") || "desc"
  );
  const [timeFrom, setTimeFrom] = useState<string | null>(searchParams.get("time_from"));
  const [timeTo, setTimeTo] = useState<string | null>(searchParams.get("time_to"));

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  // Accept optional overrides to avoid stale closure issues when state
  // hasn't re-rendered yet (e.g. setSort calls setSortBy then executeSearch).
  const executeSearch = useCallback(async (q: string, p: number, overrides?: SearchOverrides) => {
    if (!jobId) {
      setResults(null);
      return;
    }

    const searchQuery = q.trim() || "*";

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const effectiveSortBy = overrides?.sortBy ?? sortBy;
      const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
      const effectiveTimeFrom = overrides?.timeFrom !== undefined ? overrides.timeFrom : timeFrom;
      const effectiveTimeTo = overrides?.timeTo !== undefined ? overrides.timeTo : timeTo;

      const params = new URLSearchParams({
        q: searchQuery,
        page: String(p),
        page_size: String(pageSize),
        sort_by: effectiveSortBy,
        sort_order: effectiveSortOrder,
        include_histogram: String(includeHistogram),
      });

      if (effectiveTimeFrom) params.set("time_from", effectiveTimeFrom);
      if (effectiveTimeTo) params.set("time_to", effectiveTimeTo);

      if (filters) {
        Object.entries(filters).forEach(([key, values]) => {
          values.forEach(value => params.append(key, value));
        });
      }

      const res = await fetch(`${API_BASE}/analysis/${jobId}/search?${params}`, {
        headers: getApiHeaders(),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMsg = "Search failed";
        try {
          const err = await res.json();
          errMsg = err.message || errMsg;
        } catch {
          // Response body is not JSON
        }
        throw new Error(errMsg);
      }

      const data: SearchResponse = await res.json();
      setResults(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [jobId, pageSize, filters, sortBy, sortOrder, timeFrom, timeTo, includeHistogram]);

  const search = useCallback((q: string) => {
    setQuery(q);
    setPage(1);

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sortBy !== "timestamp") params.set("sort_by", sortBy);
    if (sortOrder !== "desc") params.set("sort_order", sortOrder);
    if (timeFrom) params.set("time_from", timeFrom);
    if (timeTo) params.set("time_to", timeTo);
    router.replace(`${pathname}?${params.toString()}`);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(q, 1);
    }, 300);
  }, [executeSearch, router, pathname, sortBy, sortOrder, timeFrom, timeTo]);

  const goToPage = useCallback((p: number) => {
    setPage(p);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(p));
    if (sortBy !== "timestamp") params.set("sort_by", sortBy);
    if (sortOrder !== "desc") params.set("sort_order", sortOrder);
    if (timeFrom) params.set("time_from", timeFrom);
    if (timeTo) params.set("time_to", timeTo);
    router.replace(`${pathname}?${params.toString()}`);

    executeSearch(query, p);
  }, [query, executeSearch, router, pathname, sortBy, sortOrder, timeFrom, timeTo]);

  const setSort = useCallback((field: string, order: "asc" | "desc") => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (field !== "timestamp") params.set("sort_by", field);
    if (order !== "desc") params.set("sort_order", order);
    if (timeFrom) params.set("time_from", timeFrom);
    if (timeTo) params.set("time_to", timeTo);
    router.replace(`${pathname}?${params.toString()}`);

    // Pass new sort values directly to avoid stale closure
    executeSearch(query, 1, { sortBy: field, sortOrder: order });
  }, [query, executeSearch, router, pathname, timeFrom, timeTo]);

  const setTimeRange = useCallback((from: string | null, to: string | null) => {
    setTimeFrom(from);
    setTimeTo(to);
    setPage(1);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sortBy !== "timestamp") params.set("sort_by", sortBy);
    if (sortOrder !== "desc") params.set("sort_order", sortOrder);
    if (from) params.set("time_from", from);
    if (to) params.set("time_to", to);
    router.replace(`${pathname}?${params.toString()}`);

    // Pass new time values directly to avoid stale closure
    executeSearch(query, 1, { timeFrom: from, timeTo: to });
  }, [query, executeSearch, router, pathname, sortBy, sortOrder]);

  useEffect(() => {
    const q = searchParams.get("q");
    const p = parseInt(searchParams.get("page") || "1");
    const sb = searchParams.get("sort_by") || "timestamp";
    const so = (searchParams.get("sort_order") as "asc" | "desc") || "desc";
    const tf = searchParams.get("time_from");
    const tt = searchParams.get("time_to");

    setSortBy(sb);
    setSortOrder(so);
    setTimeFrom(tf);
    setTimeTo(tt);

    if (jobId) {
      if (q) {
        setQuery(q);
        setPage(p);
      }
      executeSearch(q || "*", p, { sortBy: sb, sortOrder: so, timeFrom: tf, timeTo: tt });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return {
    query,
    results,
    loading,
    error,
    search,
    page,
    goToPage,
    setQuery,
    sortBy,
    sortOrder,
    setSort,
    timeFrom,
    timeTo,
    setTimeRange,
  };
}
