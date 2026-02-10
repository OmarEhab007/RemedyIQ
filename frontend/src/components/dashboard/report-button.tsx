"use client";

import { useState } from "react";
import { FileText, Download, ChevronDown } from "lucide-react";
import { generateReport } from "@/lib/api";
import DOMPurify from "dompurify";

interface ReportButtonProps {
  jobId: string;
}

/**
 * ReportButton - Generate and download analysis reports in various formats
 *
 * Usage:
 * <ReportButton jobId={jobId} />
 *
 * Features:
 * - HTML and JSON format selection
 * - Loading state during generation
 * - Error handling with user feedback
 * - Opens HTML reports in new tab
 * - Downloads JSON reports
 *
 * Accessibility:
 * - Keyboard navigable dropdown
 * - ARIA labels for screen readers
 * - Focus management
 */
export function ReportButton({ jobId }: ReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"html" | "json">("html");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const report = await generateReport(jobId, format);

      if (format === "html") {
        // Sanitize HTML content before rendering
        const sanitizedHTML = DOMPurify.sanitize(report.content);

        // Create a blob with the sanitized HTML
        const blob = new Blob([sanitizedHTML], { type: "text/html" });
        const url = URL.createObjectURL(blob);

        // Open in new tab using URL
        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          setError("Popup blocked. Please allow popups for this site.");
        }

        // Clean up the blob URL after a delay (60 seconds for new tab to load)
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Download JSON
        const blob = new Blob([report.content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${jobId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setShowDropdown(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to generate report. API may not be running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-1">
        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-l-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label={`Generate ${format.toUpperCase()} report`}
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>Generate Report</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={loading}
          className="px-2 py-2 bg-primary text-primary-foreground rounded-r-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed border-l border-primary-foreground/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Select report format"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {showDropdown && (
        <div
          className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10"
          role="menu"
          aria-orientation="vertical"
        >
          <button
            onClick={() => {
              setFormat("html");
              setShowDropdown(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
              format === "html" ? "bg-gray-50 font-medium" : ""
            }`}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>HTML</span>
              {format === "html" && <span className="ml-auto text-primary">✓</span>}
            </div>
          </button>
          <button
            onClick={() => {
              setFormat("json");
              setShowDropdown(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
              format === "json" ? "bg-gray-50 font-medium" : ""
            }`}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>JSON</span>
              {format === "json" && <span className="ml-auto text-primary">✓</span>}
            </div>
          </button>
        </div>
      )}

      {error && (
        <div className="absolute right-0 mt-2 p-3 bg-red-50 border border-red-200 text-red-900 rounded-md shadow-md text-sm max-w-xs z-10" role="alert">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-700 hover:text-red-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
