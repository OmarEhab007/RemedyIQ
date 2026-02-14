"use client";

import { useState } from "react";
import type {
  ExceptionsResponse,
  ExceptionEntry,
  JARExceptionsResponse,
  JARAPIError,
  JARExceptionEntry,
} from "@/lib/api";

interface ExceptionsSectionProps {
  data: ExceptionsResponse | JARExceptionsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  headless?: boolean;
}

// Type guard to check if data is JAR-parsed
function isJARExceptions(data: any): data is JARExceptionsResponse {
  return data && data.source === "jar_parsed";
}

export function ExceptionsSection({ data, loading, error, refetch, headless }: ExceptionsSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"api_errors" | "api_exceptions" | "sql_exceptions">("api_errors");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [activeExcTab, setActiveExcTab] = useState("api_errors");

  const getErrorRateColor = (rate: number): string => {
    if (rate < 1) return "bg-green-100 text-green-800 border-green-300";
    if (rate < 5) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const toggleMessageExpansion = (index: number) => {
    const key = `${activeExcTab}:${index}`;
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMessages(newExpanded);
  };

  const isExpanded = (index: number): boolean => {
    return expandedMessages.has(`${activeExcTab}:${index}`);
  };

  const truncateText = (text: string, maxLength: number = 80): { text: string; isTruncated: boolean } => {
    if (text.length <= maxLength) return { text, isTruncated: false };
    return { text: text.substring(0, maxLength) + "...", isTruncated: true };
  };

  if (loading) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}
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

  // Check for JAR-parsed data
  if (data && isJARExceptions(data)) {
    const { api_errors, api_exceptions, sql_exceptions, source } = data;
    const safeApiErrors = api_errors ?? [];
    const safeApiExceptions = api_exceptions ?? [];
    const safeSqlExceptions = sql_exceptions ?? [];
    const totalErrors = safeApiErrors.length + safeApiExceptions.length + safeSqlExceptions.length;

    // Empty state
    if (totalErrors === 0) {
      return (
        <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
          {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}
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
            <span className="text-lg font-medium">No errors detected</span>
          </div>
        </div>
      );
    }

    // Determine available tabs
    const tabs: Array<{ key: "api_errors" | "api_exceptions" | "sql_exceptions"; label: string; count: number }> = [];
    if (safeApiErrors.length > 0) tabs.push({ key: "api_errors", label: "API Errors", count: safeApiErrors.length });
    if (safeApiExceptions.length > 0) tabs.push({ key: "api_exceptions", label: "API Exceptions", count: safeApiExceptions.length });
    if (safeSqlExceptions.length > 0) tabs.push({ key: "sql_exceptions", label: "SQL Exceptions", count: safeSqlExceptions.length });

    // Set default active tab if current tab has no data
    const currentTabHasData = tabs.some(t => t.key === activeTab);
    const defaultTab = tabs[0]?.key || "api_errors";

    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}

        {/* Info banner for computed data */}
        {source === "computed" && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Re-analyze for full data from JAR parser
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 border-b">
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  (currentTabHasData ? activeTab : defaultTab) === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="overflow-x-auto">
          {/* API Errors Tab */}
          {(currentTabHasData ? activeTab : defaultTab) === "api_errors" && safeApiErrors.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Line#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Trace ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Queue</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">API Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Form</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">User</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Start Time</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Error Message</th>
                </tr>
              </thead>
              <tbody>
                {safeApiErrors.map((err, idx) => {
                  const { text: errorText, isTruncated } = truncateText(err.error_message);
                  const expanded = isExpanded(idx);
                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{err.end_line}</td>
                      <td className="px-3 py-2 font-mono text-xs">{err.trace_id}</td>
                      <td className="px-3 py-2">{err.queue}</td>
                      <td className="px-3 py-2">{err.api_type}</td>
                      <td className="px-3 py-2">{err.form}</td>
                      <td className="px-3 py-2">{err.user}</td>
                      <td className="px-3 py-2 text-xs">{err.start_time}</td>
                      <td className="px-3 py-2">
                        {isTruncated && !expanded ? (
                          <>
                            {errorText}
                            <button
                              onClick={() => toggleMessageExpansion(idx)}
                              className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                            >
                              expand
                            </button>
                          </>
                        ) : (
                          <>
                            {err.error_message}
                            {isTruncated && (
                              <button
                                onClick={() => toggleMessageExpansion(idx)}
                                className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                              >
                                collapse
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* API Exceptions Tab */}
          {(currentTabHasData ? activeTab : defaultTab) === "api_exceptions" && safeApiExceptions.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Line#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Trace ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Message</th>
                </tr>
              </thead>
              <tbody>
                {safeApiExceptions.map((exc, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{exc.line_number}</td>
                    <td className="px-3 py-2 font-mono text-xs">{exc.trace_id}</td>
                    <td className="px-3 py-2">{exc.exception_type}</td>
                    <td className="px-3 py-2">{exc.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* SQL Exceptions Tab */}
          {(currentTabHasData ? activeTab : defaultTab) === "sql_exceptions" && safeSqlExceptions.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Line#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Trace ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Message</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">SQL Statement</th>
                </tr>
              </thead>
              <tbody>
                {safeSqlExceptions.map((exc, idx) => {
                  const { text: sqlText, isTruncated } = truncateText(exc.sql_statement, 120);
                  const expanded = isExpanded(idx);
                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{exc.line_number}</td>
                      <td className="px-3 py-2 font-mono text-xs">{exc.trace_id}</td>
                      <td className="px-3 py-2">{exc.message}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {isTruncated && !expanded ? (
                          <>
                            {sqlText}
                            <button
                              onClick={() => toggleMessageExpansion(idx)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              expand
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="max-w-2xl whitespace-pre-wrap">{exc.sql_statement}</div>
                            {isTruncated && (
                              <button
                                onClick={() => toggleMessageExpansion(idx)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                              >
                                collapse
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Handle computed ExceptionsResponse
  if (!data || data.total_count === 0) {
    return (
      <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
        {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}
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
          <span className="text-lg font-medium">No errors detected</span>
        </div>
      </div>
    );
  }

  const { exceptions, error_rates, top_codes } = data;

  return (
    <div className={headless ? "" : "border rounded-lg p-6 bg-card"}>
      {!headless && <h3 className="text-lg font-semibold mb-4">Exceptions</h3>}

      {/* Error Rate Badges */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Error Rates by Log Type
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(error_rates).map(([logType, rate]) => (
            <div
              key={logType}
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getErrorRateColor(
                rate
              )}`}
            >
              {logType}: {rate.toFixed(2)}%
            </div>
          ))}
        </div>
      </div>

      {/* Top Error Codes Summary */}
      {top_codes.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Top Error Codes
          </h4>
          <div className="flex flex-wrap gap-2">
            {top_codes.slice(0, 3).map((code) => (
              <span
                key={code}
                className="px-2 py-1 bg-white border rounded text-sm font-mono"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Exceptions List */}
      <div className="space-y-2">
        {exceptions.map((exception: ExceptionEntry, idx: number) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={idx}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Collapsed View */}
              <div
                className="p-4 cursor-pointer bg-white hover:bg-gray-50"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-medium text-red-600">
                        {exception.error_code}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {exception.log_type}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        × {exception.count}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-2">
                      {exception.message}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>First: {new Date(exception.first_seen).toLocaleString()}</span>
                      <span>Last: {new Date(exception.last_seen).toLocaleString()}</span>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? "transform rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Expanded View */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  {exception.sample_line && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">
                        Sample Line #{exception.sample_line}
                      </h5>
                    </div>
                  )}
                  {exception.sample_trace && (
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">
                        Sample Trace
                      </h5>
                      <pre className="text-xs bg-white p-2 rounded border overflow-x-auto font-mono">
                        {exception.sample_trace}
                      </pre>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {exception.queue && (
                      <div>
                        <span className="text-muted-foreground">Queue:</span>{" "}
                        <span className="font-medium">{exception.queue}</span>
                      </div>
                    )}
                    {exception.form && (
                      <div>
                        <span className="text-muted-foreground">Form:</span>{" "}
                        <span className="font-medium">{exception.form}</span>
                      </div>
                    )}
                    {exception.user && (
                      <div>
                        <span className="text-muted-foreground">User:</span>{" "}
                        <span className="font-medium">{exception.user}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
