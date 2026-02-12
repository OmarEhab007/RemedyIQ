"use client";

import { useState } from "react";
import type { ThreadStatsResponse, ThreadStatsEntry } from "@/lib/api";

interface ThreadsSectionProps {
  data: ThreadStatsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

type SortField = "thread_id" | "total_calls" | "total_ms" | "avg_ms" | "max_ms" | "error_count" | "busy_pct";
type SortDirection = "asc" | "desc";

export function ThreadsSection({ data, loading, error, refetch }: ThreadsSectionProps) {
  const [sortField, setSortField] = useState<SortField>("busy_pct");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortThreads = (threads: ThreadStatsEntry[]): ThreadStatsEntry[] => {
    return [...threads].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "thread_id") {
        aVal = aVal as string;
        bVal = bVal as string;
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      aVal = aVal as number;
      bVal = bVal as number;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  };

  const getBusyColor = (busyPct: number): string => {
    if (busyPct >= 90) return "bg-red-500";
    if (busyPct >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Thread Statistics</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Thread Statistics</h3>
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

  if (!data || data.threads.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Thread Statistics</h3>
        <div className="text-center py-8 text-muted-foreground">
          No thread data available
        </div>
      </div>
    );
  }

  const { threads, total_threads } = data;
  const sortedThreads = sortThreads(threads);

  const renderHeader = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/60"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Thread Statistics</h3>
        <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          {total_threads} threads detected
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              {renderHeader("thread_id", "Thread ID")}
              {renderHeader("total_calls", "Total Calls")}
              {renderHeader("total_ms", "Total Time(ms)")}
              {renderHeader("avg_ms", "Avg Time(ms)")}
              {renderHeader("max_ms", "Max Time(ms)")}
              {renderHeader("error_count", "Errors")}
              {renderHeader("busy_pct", "Busy%")}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedThreads.map((thread: ThreadStatsEntry, idx: number) => {
              const isWarning = thread.busy_pct > 90;
              return (
                <tr
                  key={idx}
                  className={`hover:bg-muted/60 ${
                    isWarning ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-foreground">
                    {thread.thread_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {thread.total_calls.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {thread.total_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {thread.avg_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {thread.max_ms.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-destructive">
                    {thread.error_count}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full ${getBusyColor(
                            thread.busy_pct
                          )} transition-all`}
                          style={{ width: `${Math.min(thread.busy_pct, 100)}%` }}
                        ></div>
                      </div>
                      <span
                        className={`font-medium ${
                          isWarning ? "text-amber-700" : "text-foreground"
                        }`}
                      >
                        {thread.busy_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
