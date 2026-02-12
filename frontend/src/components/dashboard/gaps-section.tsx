"use client";

import { useState } from "react";
import type { GapsResponse, GapEntry } from "@/lib/api";

interface GapsSectionProps {
  data: GapsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function GapsSection({ data, loading, error, refetch }: GapsSectionProps) {
  const [activeTab, setActiveTab] = useState<"line" | "thread">("line");

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
  };

  const isCritical = (ms: number): boolean => ms > 60000;

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 mb-3">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.gaps.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>
        <div className="flex items-center justify-center py-8 text-green-600">
          <svg
            className="w-12 h-12 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-medium">No significant gaps detected</span>
        </div>
      </div>
    );
  }

  const { gaps } = data;
  const lineGaps = gaps.filter((gap) => !gap.thread_id);
  const threadGaps = gaps.filter((gap) => gap.thread_id);

  const currentGaps = activeTab === "line" ? lineGaps : threadGaps;

  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab("line")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "line"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Line Gaps ({lineGaps.length})
        </button>
        <button
          onClick={() => setActiveTab("thread")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === "thread"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Thread Gaps ({threadGaps.length})
        </button>
      </div>

      {/* Table */}
      {currentGaps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {activeTab} gaps detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Gap Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  End Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Before Line
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  After Line
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Log Type
                </th>
                {activeTab === "thread" && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Thread ID
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentGaps.map((gap: GapEntry, idx: number) => {
                const critical = isCritical(gap.duration_ms);
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50 ${
                      critical ? "border-l-4 border-l-red-500 bg-red-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        {critical && (
                          <svg
                            className="w-4 h-4 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        )}
                        {idx + 1}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium ${
                        critical ? "text-red-600" : "text-foreground"
                      }`}
                    >
                      {formatDuration(gap.duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(gap.start_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {new Date(gap.end_time).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {gap.before_line}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {gap.after_line}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {gap.log_type}
                      </span>
                    </td>
                    {activeTab === "thread" && (
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {gap.thread_id}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
