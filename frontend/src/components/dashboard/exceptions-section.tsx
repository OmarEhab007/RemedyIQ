"use client";

import { useState } from "react";
import type { ExceptionsResponse, ExceptionEntry } from "@/lib/api";

interface ExceptionsSectionProps {
  data: ExceptionsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function ExceptionsSection({ data, loading, error, refetch }: ExceptionsSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getErrorRateColor = (rate: number): string => {
    if (rate < 1) return "bg-green-100 text-green-800 border-green-300";
    if (rate < 5) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Exceptions</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Exceptions</h3>
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

  if (!data || data.total_count === 0) {
    return (
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="text-lg font-semibold mb-4">Exceptions</h3>
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
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Exceptions</h3>

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
