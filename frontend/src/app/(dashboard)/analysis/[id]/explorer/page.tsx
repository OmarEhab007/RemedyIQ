"use client";

import { useSearch } from "@/hooks/use-search";
import { SearchBar } from "@/components/explorer/search-bar";
import { FilterPanel } from "@/components/explorer/filter-panel";
import { LogTable } from "@/components/explorer/log-table";
import { DetailPanel } from "@/components/explorer/detail-panel";
import { TimeRangePicker, TimeRange, timeRangeToQueryParams } from "@/components/explorer/time-range-picker";
import { TimelineHistogram } from "@/components/explorer/timeline-histogram";
import { SavedSearches } from "@/components/explorer/saved-searches";
import { ExportButton } from "@/components/explorer/export-button";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { SearchHit } from "@/hooks/use-search";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getApiHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface JobMetadata {
  id: string;
  status: string;
  log_start?: string;
  log_end?: string;
  total_lines?: number;
}

export default function ExplorerPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  if (!jobId) {
    return <NoJobSelected />;
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">Loading explorer...</div>}>
      <ExplorerContent jobId={jobId} />
    </Suspense>
  );
}

function NoJobSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">
      <p className="text-lg mb-4">Select an analysis job to explore logs</p>
      <Link href="/analysis">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go to Analysis List
        </Button>
      </Link>
    </div>
  );
}

function ExplorerContent({ jobId }: { jobId: string }) {
  const urlSearchParams = useSearchParams();
  const [selectedEntry, setSelectedEntry] = useState<SearchHit | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [jobMetadata, setJobMetadata] = useState<JobMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [timeRange, setTimeRangeState] = useState<TimeRange>({ type: "all" });
  const [initialLineHandled, setInitialLineHandled] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const logTableRef = useRef<HTMLDivElement>(null);

  const {
    query,
    results,
    loading,
    error,
    search,
    page,
    goToPage: rawGoToPage,
    sortBy,
    sortOrder,
    setSort: rawSetSort,
    setTimeRange,
    timeFrom,
    timeTo,
  } = useSearch({ jobId, filters });

  // Clear stale detail panel when results change via pagination or sorting
  const goToPage = useCallback((p: number) => {
    setSelectedEntry(null);
    setFocusedRowIndex(null);
    rawGoToPage(p);
  }, [rawGoToPage]);

  const setSort = useCallback((field: string, order: "asc" | "desc") => {
    setSelectedEntry(null);
    setFocusedRowIndex(null);
    rawSetSort(field, order);
  }, [rawSetSort]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (selectedEntry) {
          setSelectedEntry(null);
          if (focusedRowIndex !== null && logTableRef.current) {
            setTimeout(() => {
              const row = logTableRef.current?.querySelector(`[data-row-index="${focusedRowIndex}"]`) as HTMLElement;
              row?.focus();
            }, 0);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEntry, focusedRowIndex]);

  useEffect(() => {
    if (!initialLineHandled && urlSearchParams) {
      const lineParam = urlSearchParams.get("line");
      if (lineParam) {
        setInitialLineHandled(true);
        search(`line_number:${lineParam}`);
      }
    }
  }, [urlSearchParams, initialLineHandled, search]);

  useEffect(() => {
    async function fetchJobMetadata() {
      try {
        setMetadataLoading(true);
        setMetadataError(null);
        const res = await fetch(`${API_BASE}/analysis/${jobId}`, {
          headers: getApiHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setJobMetadata(data);
        } else if (res.status === 404) {
          setMetadataError("Analysis job not found. It may have been deleted or expired.");
        } else {
          setMetadataError(`Failed to load analysis job (${res.status})`);
        }
      } catch (err) {
        console.error("Failed to fetch job metadata:", err);
        setMetadataError("Unable to connect to the server. Please try again.");
      } finally {
        setMetadataLoading(false);
      }
    }

    if (jobId) {
      fetchJobMetadata();
    }
  }, [jobId]);

  const queryRef = useRef(query);
  const searchRef = useRef(search);
  queryRef.current = query;
  searchRef.current = search;

  useEffect(() => {
    if (queryRef.current.trim()) {
      searchRef.current(queryRef.current);
    }
  }, [filters]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRangeState(range);
    const params = timeRangeToQueryParams(range, logEnd);
    setTimeRange(params.time_from || null, params.time_to || null);
  };

  const handleSearchRelated = (field: string, value: string) => {
    const newQuery = `${field}:${value.includes(" ") || value.includes(":") ? `"${value}"` : value}`;
    search(newQuery);
    setSelectedEntry(null);
  };

  const logStart = jobMetadata?.log_start ? new Date(jobMetadata.log_start) : undefined;
  const logEnd = jobMetadata?.log_end ? new Date(jobMetadata.log_end) : undefined;

  const hasActiveTimeRange = timeRange.type !== "all";
  const isEmptyWithTimeRange = results && results.total === 0 && hasActiveTimeRange;

  if (metadataError) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 text-destructive/60" />
        <p className="text-lg font-medium text-destructive">{metadataError}</p>
        <div className="flex gap-3 mt-6">
          <Link href="/analysis">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Analysis List
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-44 border-r p-2.5 overflow-y-auto hidden lg:block space-y-3 text-xs">
        <FilterPanel
          facets={results?.facets || {}}
          activeFilters={filters}
          onFilterChange={setFilters}
        />
        <SavedSearches
          jobId={jobId}
          onLoadSearch={(q) => {
            search(q);
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b flex items-center gap-3">
          <Link href={`/analysis/${jobId}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <SearchBar value={query} onChange={search} jobId={jobId} inputRef={searchInputRef} />
          </div>
          <TimeRangePicker
            value={timeRange}
            onChange={handleTimeRangeChange}
            logStart={logStart}
            logEnd={logEnd}
          />
        </div>

        {logStart && logEnd && !metadataLoading && (
          <div className="px-4 py-1 text-xs text-muted-foreground border-b bg-muted/30">
            Data time span: {formatDateTime(logStart)} to {formatDateTime(logEnd)}
          </div>
        )}

        {results?.histogram && results.histogram.length > 0 && (
          <div className="px-4 py-0.5 border-b hidden md:block">
            <TimelineHistogram
              data={results.histogram}
              height={100}
              onRangeSelect={(start, end) => {
                handleTimeRangeChange({
                  type: "absolute",
                  start,
                  end,
                });
              }}
              timeFrom={timeFrom || undefined}
              timeTo={timeTo || undefined}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {error && (
            <div className="p-4 m-4 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Searching...
            </div>
          )}

          {isEmptyWithTimeRange && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No results in selected time range</p>
              <p className="text-sm mt-1">
                Try adjusting the time range or clearing the filter
              </p>
              {logStart && logEnd && (
                <p className="text-xs mt-2 text-muted-foreground">
                  Available data: {formatDateTime(logStart)} to {formatDateTime(logEnd)}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => handleTimeRangeChange({ type: "all" })}
              >
                Clear time range
              </Button>
            </div>
          )}

          {results && !loading && !isEmptyWithTimeRange && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="px-4 py-1.5 text-xs text-muted-foreground border-b flex items-center justify-between shrink-0 bg-muted/30">
                <span>
                  {results.total.toLocaleString()} results
                  {results.total_pages > 1 && ` (page ${results.page} of ${results.total_pages})`}
                  {results.took_ms && ` • ${results.took_ms}ms`}
                </span>
                <div className="flex items-center gap-2">
                  <ExportButton
                    jobId={jobId}
                    query={query}
                    timeFrom={timeFrom}
                    timeTo={timeTo}
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSort(e.target.value, sortOrder)}
                    className="text-xs border rounded px-2 py-1"
                    aria-label="Sort field"
                  >
                    <option value="timestamp">Timestamp</option>
                    <option value="duration_ms">Duration</option>
                    <option value="line_number">Line Number</option>
                    <option value="user">User</option>
                    <option value="log_type">Log Type</option>
                  </select>
                  <button
                    onClick={() => setSort(sortBy, sortOrder === "asc" ? "desc" : "asc")}
                    className="text-xs border rounded px-2 py-1"
                    aria-label={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
                  >
                    {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <LogTable
                  hits={results.results}
                  onSelect={setSelectedEntry}
                  selectedId={selectedEntry?.id}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={(field: string) => {
                    if (field === sortBy) {
                      setSort(field, sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSort(field, "desc");
                    }
                  }}
                  focusedRowIndex={focusedRowIndex}
                  onFocusedRowChange={setFocusedRowIndex}
                  tableRef={logTableRef}
                />
              </div>
              {results.total_pages > 1 && (
                <nav className="flex items-center justify-center gap-2 px-3 py-1.5 border-t shrink-0 bg-muted/30" aria-label="Search results pagination">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-2.5 py-0.5 text-xs border rounded disabled:opacity-50 hover:bg-accent transition-colors"
                    aria-label="Go to previous page"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                    {page} / {results.total_pages}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= results.total_pages}
                    className="px-2.5 py-0.5 text-xs border rounded disabled:opacity-50 hover:bg-accent transition-colors"
                    aria-label="Go to next page"
                  >
                    Next
                  </button>
                </nav>
              )}
            </div>
          )}

          {!results && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>Enter a search query to explore log entries</p>
              {logStart && logEnd && (
                <p className="text-xs mt-2">
                  Data available from {formatDateTime(logStart)} to {formatDateTime(logEnd)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedEntry && (
        <DetailPanel
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          jobId={jobId}
          onSearchRelated={handleSearchRelated}
        />
      )}
    </div>
  );
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
