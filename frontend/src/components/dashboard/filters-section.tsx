"use client";

import { useState, useEffect } from "react";
import type {
  FilterComplexityResponse,
  MostExecutedFilter,
  FilterPerTransaction,
  JARFilterComplexityResponse,
  JARFilterMostExecuted,
  JARFilterPerTransaction,
  JARFilterExecutedPerTxn,
  JARFilterLevel,
  TopNEntry,
} from "@/lib/api";

interface FiltersSectionProps {
  data: FilterComplexityResponse | JARFilterComplexityResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  headless?: boolean;
}

// Type guard to distinguish JAR-parsed from computed data
function isJARFilters(data: any): data is JARFilterComplexityResponse {
  return data && data.source === "jar_parsed";
}

type JARTabType = "longest_running" | "most_executed" | "per_transaction" | "executed_per_txn" | "filter_levels";
type ComputedTabType = "most_executed" | "per_transaction";

export function FiltersSection({ data, loading, error, refetch, headless }: FiltersSectionProps) {
  const [activeTab, setActiveTab] = useState<JARTabType | ComputedTabType>("most_executed");

  if (loading) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>}
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>}
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive mb-3">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if data is empty
  if (!data) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>}
        <div className="text-center py-8 text-muted-foreground">
          No filter activity detected
        </div>
      </div>
    );
  }

  const isJAR = isJARFilters(data);

  // Empty check for computed data
  if (!isJAR && data.most_executed.length === 0 && data.per_transaction.length === 0) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>}
        <div className="text-center py-8 text-muted-foreground">
          No filter activity detected
        </div>
      </div>
    );
  }

  // Empty check for JAR data
  if (
    isJAR &&
    data.longest_running.length === 0 &&
    data.most_executed.length === 0 &&
    data.per_transaction.length === 0 &&
    data.executed_per_txn.length === 0 &&
    data.filter_levels.length === 0
  ) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Filter Complexity</h3>}
        <div className="text-center py-8 text-muted-foreground">
          No filter activity detected
        </div>
      </div>
    );
  }

  if (isJAR) {
    // JAR-parsed data: 5 tabs
    const jarData = data as JARFilterComplexityResponse;

    // Build available tabs (hide empty ones)
    const availableTabs: { key: JARTabType; label: string; count: number }[] = [];
    if (jarData.longest_running.length > 0) {
      availableTabs.push({ key: "longest_running", label: "Longest Running", count: jarData.longest_running.length });
    }
    if (jarData.most_executed.length > 0) {
      availableTabs.push({ key: "most_executed", label: "Most Executed", count: jarData.most_executed.length });
    }
    if (jarData.per_transaction.length > 0) {
      availableTabs.push({ key: "per_transaction", label: "Per Transaction", count: jarData.per_transaction.length });
    }
    if (jarData.executed_per_txn.length > 0) {
      availableTabs.push({ key: "executed_per_txn", label: "Executed Per Txn", count: jarData.executed_per_txn.length });
    }
    if (jarData.filter_levels.length > 0) {
      availableTabs.push({ key: "filter_levels", label: "Filter Levels", count: jarData.filter_levels.length });
    }

    // Sync tab selection when available tabs change (via effect to avoid render-loop).
    const needsTabSync = availableTabs.length > 0 && !availableTabs.find(t => t.key === activeTab);
    const syncTarget = needsTabSync ? availableTabs[0].key : null;
    useEffect(() => {
      if (syncTarget) {
        setActiveTab(syncTarget);
      }
    }, [syncTarget]);

    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Filter Complexity</h3>
            <div className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm font-medium">
              JAR Parsed
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b flex-wrap">
          {availableTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Longest Running Tab */}
        {activeTab === "longest_running" && (
          <div className="overflow-x-auto">
            {jarData.longest_running.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Line#
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Identifier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Duration (ms)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Queue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Form
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jarData.longest_running.map((entry: TopNEntry) => (
                    <tr key={`${entry.line_number}-${entry.rank}`} className="hover:bg-muted/60">
                      <td className="px-4 py-3 text-sm text-foreground">{entry.rank}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.line_number}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.trace_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.identifier}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.duration_ms.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.queue || "-"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.form || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Most Executed Tab (JAR) */}
        {activeTab === "most_executed" && (
          <div className="overflow-x-auto">
            {jarData.most_executed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pass Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Fail Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jarData.most_executed.map((filter: JARFilterMostExecuted, idx: number) => {
                    const total = filter.pass_count + filter.fail_count;
                    return (
                      <tr key={idx} className="hover:bg-muted/60">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{filter.filter_name}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{filter.pass_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{filter.fail_count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{total.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Per Transaction Tab (JAR) */}
        {activeTab === "per_transaction" && (
          <div className="overflow-x-auto">
            {jarData.per_transaction.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Line#
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Form
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Request ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filters/sec
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jarData.per_transaction.map((txn: JARFilterPerTransaction, idx: number) => {
                    const isHighRate = txn.filters_per_sec > 10;
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-muted/60 ${isHighRate ? "bg-amber-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{txn.line_number}</td>
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{txn.trace_id}</td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isHighRate ? "font-bold text-amber-700" : "text-foreground"
                          }`}
                        >
                          {txn.filter_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{txn.operation}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{txn.form}</td>
                        <td className="px-4 py-3 text-sm font-mono text-foreground">{txn.request_id}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{txn.filters_per_sec.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Executed Per Txn Tab */}
        {activeTab === "executed_per_txn" && (
          <div className="overflow-x-auto">
            {jarData.executed_per_txn.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Line#
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pass Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Fail Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jarData.executed_per_txn.map((entry: JARFilterExecutedPerTxn, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/60">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.line_number}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.trace_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.filter_name}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.pass_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.fail_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Filter Levels Tab */}
        {activeTab === "filter_levels" && (
          <div className="overflow-x-auto">
            {jarData.filter_levels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No data available</div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Line#
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Form
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Request ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jarData.filter_levels.map((entry: JARFilterLevel, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/60">
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.line_number}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.trace_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{entry.filter_level}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.operation}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.form}</td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">{entry.request_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  } else {
    // Computed data: original 2 tabs
    const computedData = data as FilterComplexityResponse;
    const { most_executed, per_transaction, total_filter_time_ms } = computedData;

    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Filter Complexity</h3>
            <div className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm font-medium">
              Total: {total_filter_time_ms.toFixed(2)} ms
            </div>
          </div>
        )}

        {/* Re-analyze banner for computed data */}
        <div className="mb-4 p-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground">
          Re-analyze with JAR parser for detailed filter breakdown (pass/fail counts, levels, per-transaction details)
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b">
          <button
            onClick={() => setActiveTab("most_executed")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === "most_executed"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Most Executed
          </button>
          <button
            onClick={() => setActiveTab("per_transaction")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === "per_transaction"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Per Transaction
          </button>
        </div>

        {/* Most Executed Tab */}
        {activeTab === "most_executed" && (
          <div className="overflow-x-auto">
            {most_executed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data available
              </div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Time(ms)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {most_executed.map((filter: MostExecutedFilter, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/60">
                      <td className="px-4 py-3 text-sm text-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {filter.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {filter.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {filter.total_ms.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Per Transaction Tab */}
        {activeTab === "per_transaction" && (
          <div className="overflow-x-auto">
            {per_transaction.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data available
              </div>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Filter Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total(ms)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Avg(ms)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Max(ms)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {per_transaction.map((txn: FilterPerTransaction, idx: number) => {
                    const isHighExecution = txn.execution_count > 100;
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-muted/60 ${
                          isHighExecution ? "bg-amber-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-foreground">
                          {txn.transaction_id}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {txn.filter_name}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isHighExecution
                              ? "font-bold text-amber-700"
                              : "text-foreground"
                          }`}
                        >
                          {txn.execution_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {txn.total_ms.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {txn.avg_ms.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {txn.max_ms.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }
}
