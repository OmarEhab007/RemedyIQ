"use client";

import { useState } from "react";
import type { GapsResponse, GapEntry, JARGapsResponse, JARGapEntry } from "@/lib/api";

interface GapsSectionProps {
  data: GapsResponse | JARGapsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  headless?: boolean;
}

// Type guard to detect JAR-parsed response
function isJARGaps(data: any): data is JARGapsResponse {
  return data && data.source === "jar_parsed";
}

export function GapsSection({ data, loading, error, refetch, headless }: GapsSectionProps) {
  const [activeTab, setActiveTab] = useState<"line" | "thread">("line");
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
  };

  const formatJARDuration = (seconds: number): string => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    return `${(seconds / 60).toFixed(2)}min`;
  };

  const isCritical = (ms: number): boolean => ms > 60000;
  const isJARCritical = (seconds: number): boolean => seconds > 1;

  const toggleDetails = (index: number) => {
    const newExpanded = new Set(expandedDetails);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedDetails(newExpanded);
  };

  if (loading) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>}
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>}
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

  // Check if data exists and determine type
  const isJAR = data && isJARGaps(data);

  // Handle empty data
  if (!data) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>}
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

  // Determine gaps arrays based on data type
  let lineGaps: GapEntry[] | JARGapEntry[] = [];
  let threadGaps: GapEntry[] | JARGapEntry[] = [];

  if (isJAR) {
    lineGaps = data.line_gaps;
    threadGaps = data.thread_gaps;
  } else {
    const computedData = data as GapsResponse;
    lineGaps = computedData.gaps.filter((gap) => !gap.thread_id);
    threadGaps = computedData.gaps.filter((gap) => gap.thread_id);
  }

  // Check if all gaps are empty
  if (lineGaps.length === 0 && threadGaps.length === 0) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>}
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

  const currentGaps = activeTab === "line" ? lineGaps : threadGaps;

  return (
    <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
      {!headless && <h3 className="text-lg font-semibold mb-4">Gap Analysis</h3>}

      {/* Re-analyze banner for computed data */}
      {!isJAR && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Computed data - Re-analyze for full JAR-parsed gap details</span>
          </div>
        </div>
      )}

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
      ) : isJAR ? (
        // JAR-parsed data table
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
                  Line #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Trace ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(currentGaps as JARGapEntry[]).map((gap: JARGapEntry, idx: number) => {
                const critical = isJARCritical(gap.gap_duration);
                const isExpanded = expandedDetails.has(idx);
                const shouldTruncate = gap.details.length > 100;
                const displayDetails = isExpanded || !shouldTruncate
                  ? gap.details
                  : gap.details.substring(0, 100) + "...";

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
                      {formatJARDuration(gap.gap_duration)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-mono">
                      {gap.line_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground font-mono">
                      {gap.trace_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {gap.timestamp}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="max-w-md">
                        <span className="break-words">{displayDetails}</span>
                        {shouldTruncate && (
                          <button
                            onClick={() => toggleDetails(idx)}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // Computed data table (existing format)
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
              {(currentGaps as GapEntry[]).map((gap: GapEntry, idx: number) => {
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
