"use client";

import { AlertCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Anomaly {
  id: string;
  type: string;       // "slow_api", "slow_sql", "high_error_rate", etc.
  severity: string;   // "low", "medium", "high", "critical"
  title: string;
  description: string;
  metric: string;
  value: number;
  baseline: number;
  sigma: number;
  detected_at: string;
}

interface AnomalyAlertsProps {
  anomalies: Anomaly[];
  jobId: string;
}

/**
 * AnomalyAlerts - Displays detected anomalies with severity-based styling
 *
 * Usage:
 * <AnomalyAlerts anomalies={anomalies} jobId={jobId} />
 *
 * Accessibility:
 * - Semantic HTML with role="alert" for screen readers
 * - Color-coded badges with text labels
 * - Keyboard navigable link to AI assistant
 */
export function AnomalyAlerts({ anomalies, jobId }: AnomalyAlertsProps) {
  if (!anomalies || anomalies.length === 0) {
    return null;
  }

  // Count by severity
  const counts = anomalies.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-50 border-red-200 text-red-900";
      case "high":
        return "bg-orange-50 border-orange-200 text-orange-900";
      case "medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "low":
        return "bg-blue-50 border-blue-200 text-blue-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const getSeverityBadgeColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="space-y-4" role="alert" aria-live="polite">
      {/* Summary banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {counts.critical && (
                <span className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-800 border border-red-300">
                  {counts.critical} Critical
                </span>
              )}
              {counts.high && (
                <span className="text-xs px-2 py-1 rounded-md bg-orange-100 text-orange-800 border border-orange-300">
                  {counts.high} High
                </span>
              )}
              {counts.medium && (
                <span className="text-xs px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300">
                  {counts.medium} Medium
                </span>
              )}
              {counts.low && (
                <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                  {counts.low} Low
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/ai?job_id=${jobId}&context=anomaly`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            aria-label="Ask AI about detected anomalies"
          >
            Ask AI
          </Link>
        </div>
      </div>

      {/* Anomaly cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className={`border rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm">{anomaly.title}</h4>
              <span
                className={`text-xs px-2 py-0.5 rounded-md border ${getSeverityBadgeColor(anomaly.severity)}`}
                aria-label={`Severity: ${anomaly.severity}`}
              >
                {anomaly.severity}
              </span>
            </div>
            <p className="text-sm mb-3 opacity-90">{anomaly.description}</p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                <span className="font-medium">{anomaly.metric}:</span>
                <span>{(anomaly.value ?? 0).toLocaleString()}</span>
                <span className="opacity-75">
                  (baseline: {(anomaly.baseline ?? 0).toLocaleString()})
                </span>
              </div>
              <div>
                <span className="font-medium">Sigma:</span> {(anomaly.sigma ?? 0).toFixed(2)}σ
              </div>
              <div className="opacity-75">
                Detected: {new Date(anomaly.detected_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
