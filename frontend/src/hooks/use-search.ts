"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export interface SearchHit {
  id: string;
  score: number;
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
}

export function useSearch(jobId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [pageSize] = useState(25);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const executeSearch = useCallback(async (q: string, p: number) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q,
        page: String(p),
        page_size: String(pageSize),
      });

      const res = await fetch(`${API_BASE}/search?${params}`, {
        headers: {
          "X-Dev-User-ID": "dev-user",
          "X-Dev-Tenant-ID": "dev-tenant",
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Search failed");
      }

      const data: SearchResponse = await res.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  const search = useCallback((q: string) => {
    setQuery(q);
    setPage(1);

    // Update URL
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.replace(`${pathname}?${params.toString()}`);

    // Debounce the actual search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(q, 1);
    }, 300);
  }, [executeSearch, router, pathname]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
    executeSearch(query, p);
  }, [query, executeSearch]);

  // Initial search from URL params
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      executeSearch(q, page);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { query, results, loading, error, search, page, goToPage, setQuery };
}
