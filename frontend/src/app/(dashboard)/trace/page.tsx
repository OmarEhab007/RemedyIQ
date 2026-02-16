"use client";

import { Suspense, useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTrace, RecentTrace, TraceFilters } from "@/hooks/use-trace";
import { Waterfall } from "@/components/trace/waterfall";
import { SpanDetailSidebar } from "@/components/trace/span-detail-sidebar";
import { TraceSearch, SearchParams } from "@/components/trace/trace-search";
import { TraceSummaryHeader } from "@/components/trace/trace-summary-header";
import { TraceFilters as TraceFiltersComponent } from "@/components/trace/trace-filters";
import { ViewSwitcher } from "@/components/trace/view-switcher";
import { FlameGraph } from "@/components/trace/flame-graph";
import { SpanList } from "@/components/trace/span-list";
import { TraceComparison } from "@/components/trace/trace-comparison";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { AIInsights } from "@/components/trace/ai-insights";
import { TransactionSummary, getWaterfall, exportTrace } from "@/lib/api";
import { AlertCircle, Loader2, FileWarning, GitCompare, Download, FileJson, FileSpreadsheet } from "lucide-react";

function TracePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const jobIdParam = searchParams.get("job_id");
  const traceIdParam = searchParams.get("trace_id");
  const viewParam = searchParams.get("view");
  const jobId = jobIdParam;
  
  const {
    waterfall,
    selectedSpanId,
    loading,
    error,
    filters,
    filteredSpans,
    activeView,
    fetchWaterfall,
    setSelectedSpan,
    clearTrace,
    searchTransactions,
    recentTraces: hookRecentTraces,
    applyFilters,
    clearFilters,
    switchView,
    comparisonTrace,
    setComparisonTrace,
  } = useTrace();

  const loadedRef = useRef<string | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [comparisonSearchOpen, setComparisonSearchOpen] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedSpan = useMemo(() => {
    if (!waterfall || !selectedSpanId) return null;
    return waterfall.flat_spans.find(s => s.id === selectedSpanId) || null;
  }, [waterfall, selectedSpanId]);

  const recentTracesAsSummaries = useMemo((): TransactionSummary[] => {
    return hookRecentTraces.map((t: RecentTrace): TransactionSummary => ({
      trace_id: t.traceId,
      correlation_type: "trace_id",
      primary_user: t.user,
      primary_form: "",
      primary_operation: "",
      total_duration_ms: t.duration,
      span_count: 0,
      error_count: 0,
      first_timestamp: t.timestamp,
      last_timestamp: t.timestamp,
    }));
  }, [hookRecentTraces]);

  const breadcrumbs = useMemo(() => {
    const items: { label: string; href?: string }[] = [];
    
    if (jobId) {
      items.push({
        label: "Analysis",
        href: `/analysis`,
      });
      items.push({
        label: `Job ${jobId.slice(0, 8)}...`,
        href: `/analysis/${jobId}`,
      });
    }
    
    if (waterfall) {
      items.push({
        label: `Trace ${waterfall.trace_id.slice(0, 8)}...`,
      });
    } else {
      items.push({
        label: "Trace",
      });
    }
    
    return items;
  }, [jobId, waterfall]);

  const handleFiltersChange = useCallback((newFilters: Partial<TraceFilters>) => {
    applyFilters(newFilters);
  }, [applyFilters]);

  const filteredSpanIds = useMemo(() => {
    if (!waterfall) return undefined;
    return new Set(filteredSpans.map(s => s.id));
  }, [waterfall, filteredSpans]);

  const handleToggleCriticalPath = useCallback(() => {
    setShowCriticalPath(prev => !prev);
  }, []);

  const handleOpenComparison = useCallback(() => {
    setComparisonSearchOpen(true);
  }, []);

  const handleCloseComparison = useCallback(() => {
    setComparisonTrace(null);
    setComparisonSearchOpen(false);
  }, [setComparisonTrace]);

  const handleSelectComparisonTrace = useCallback(async (traceId: string, traceJobId: string) => {
    if (!traceJobId) return;
    setComparisonLoading(true);
    try {
      const trace = await getWaterfall(traceJobId, traceId);
      setComparisonTrace(trace);
      setComparisonSearchOpen(false);
    } catch (err) {
      console.error("Failed to load comparison trace:", err);
    } finally {
      setComparisonLoading(false);
    }
  }, [setComparisonTrace]);

  const handleViewChange = useCallback((view: string) => {
    switchView(view as "waterfall" | "flamegraph" | "spanlist");
    if (waterfall && jobId) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      router.replace(url.toString(), { scroll: false });
    }
  }, [switchView, waterfall, jobId, router]);

  const handleExport = useCallback(async (format: "json" | "csv") => {
    if (!jobId || !waterfall) return;
    
    setExporting(true);
    try {
      const blob = await exportTrace(jobId, waterfall.trace_id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-${waterfall.trace_id.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [jobId, waterfall]);

  useEffect(() => {
    if (traceIdParam && jobIdParam) {
      const loadKey = `${jobIdParam}:${traceIdParam}`;
      if (loadedRef.current !== loadKey) {
        loadedRef.current = loadKey;
        fetchWaterfall(jobIdParam, traceIdParam);
      }
    }
  }, [traceIdParam, jobIdParam, fetchWaterfall]);

  useEffect(() => {
    if (viewParam && ["waterfall", "flamegraph", "spanlist"].includes(viewParam)) {
      switchView(viewParam as "waterfall" | "flamegraph" | "spanlist");
    }
  }, [viewParam, switchView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSpanId) {
        setSelectedSpan(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSpanId, setSelectedSpan]);

  const handleTraceSelected = useCallback((traceId: string, traceJobId: string) => {
    const loadKey = `${traceJobId}:${traceId}`;
    loadedRef.current = loadKey;
    const url = new URL(window.location.href);
    url.searchParams.set("job_id", traceJobId);
    url.searchParams.set("trace_id", traceId);
    router.push(url.toString());
    fetchWaterfall(traceJobId, traceId);
  }, [router, fetchWaterfall]);

  const handleSearch = useCallback(async (params: SearchParams): Promise<TransactionSummary[]> => {
    if (!jobId) return [];
    return searchTransactions(jobId, params);
  }, [jobId, searchTransactions]);

  const handleClear = () => {
    loadedRef.current = null;
    clearTrace();
    setComparisonTrace(null);
    setShowCriticalPath(false);
    if (jobId) {
      router.push(`/trace?job_id=${jobId}`);
    }
  };

  const renderView = () => {
    if (!waterfall) return null;

    if (comparisonTrace) {
      return (
        <TraceComparison
          traceA={waterfall}
          traceB={comparisonTrace}
          selectedSpanId={selectedSpanId}
          onSelectSpan={setSelectedSpan}
          onClose={handleCloseComparison}
        />
      );
    }

    switch (activeView) {
      case "flamegraph":
        return (
          <FlameGraph
            spans={waterfall.spans}
            totalDurationMs={waterfall.total_duration_ms}
            selectedSpanId={selectedSpanId}
            onSelectSpan={setSelectedSpan}
          />
        );
      case "spanlist":
        return (
          <SpanList
            spans={filteredSpans}
            selectedSpanId={selectedSpanId}
            onSelectSpan={setSelectedSpan}
          />
        );
      case "waterfall":
      default:
        return (
          <Waterfall
            data={waterfall}
            selectedSpanId={selectedSpanId}
            onSelectSpan={setSelectedSpan}
            filters={{
              searchText: filters.searchText,
              logTypes: filters.logTypes,
              errorsOnly: filters.errorsOnly,
            }}
            filteredSpanIds={filteredSpanIds}
            showCriticalPath={showCriticalPath}
          />
        );
    }
  };

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <FileWarning className="w-12 h-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">No Job Selected</h2>
          <p className="text-sm text-muted-foreground">
            Please select an analysis job first to view traces.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Go to <Link href="/analysis" className="text-primary hover:underline">Analysis</Link> and select a job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b bg-card p-4">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Transaction Tracer</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Job: {jobId.slice(0, 8)}...</span>
            {waterfall && (
              <div className="relative">
                <button
                  disabled={exporting}
                  className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted disabled:opacity-50"
                  onClick={() => {
                    const dropdown = document.getElementById("export-dropdown");
                    if (dropdown) {
                      dropdown.classList.toggle("hidden");
                    }
                  }}
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
                <div
                  id="export-dropdown"
                  className="hidden absolute right-0 top-full mt-1 bg-card border rounded shadow-lg z-50"
                >
                  <button
                    onClick={() => {
                      handleExport("json");
                      document.getElementById("export-dropdown")?.classList.add("hidden");
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-left"
                  >
                    <FileJson className="w-3 h-3" />
                    JSON
                  </button>
                  <button
                    onClick={() => {
                      handleExport("csv");
                      document.getElementById("export-dropdown")?.classList.add("hidden");
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted text-left"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <TraceSearch
          jobId={jobId}
          recentTraces={recentTracesAsSummaries}
          onTraceSelected={handleTraceSelected}
          onSearch={handleSearch}
        />
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {waterfall && waterfall.correlation_type === "rpc_id" && !error && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Using RPC ID fallback (pre-19.x AR Server). Trace correlation may be incomplete.
          </span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {waterfall ? (
            <>
              <TraceSummaryHeader data={waterfall} onClear={handleClear} />
              <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
                <TraceFiltersComponent
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onClearFilters={clearFilters}
                  totalSpans={waterfall.span_count}
                  filteredCount={filteredSpans.length}
                  showCriticalPath={showCriticalPath}
                  onToggleCriticalPath={handleToggleCriticalPath}
                />
                <div className="flex items-center gap-2">
                  {!comparisonTrace && (
                    <>
                      <AIInsights jobId={jobId} traceId={waterfall.trace_id} />
                      <button
                        onClick={handleOpenComparison}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded hover:bg-muted"
                      >
                        <GitCompare className="w-4 h-4" />
                        Compare
                      </button>
                    </>
                  )}
                  <ViewSwitcher activeView={activeView} onViewChange={handleViewChange} />
                </div>
              </div>

              {comparisonSearchOpen && (
                <div className="border-b p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium">Select trace to compare:</span>
                    <button
                      onClick={() => setComparisonSearchOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <TraceSearch
                    jobId={jobId}
                    recentTraces={recentTracesAsSummaries}
                    onTraceSelected={handleSelectComparisonTrace}
                    onSearch={handleSearch}
                  />
                  {comparisonLoading && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading comparison trace...
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                {renderView()}
              </div>
            </>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading trace...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Search for a Trace ID, RPC ID, Thread ID, or User to view the transaction trace
                </p>
                <p className="text-xs text-muted-foreground">
                  Recent traces appear when you click the search box
                </p>
              </div>
            </div>
          )}
        </div>

        {waterfall && (
          <SpanDetailSidebar
            selectedSpan={selectedSpan}
            totalDuration={waterfall.total_duration_ms}
            traceId={waterfall.trace_id}
            jobId={jobId}
            onClose={() => setSelectedSpan(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function TracePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <TracePageContent />
    </Suspense>
  );
}
