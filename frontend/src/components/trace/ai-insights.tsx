"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Loader2, X, AlertCircle, RefreshCw } from "lucide-react";
import { getApiHeaders } from "@/lib/api";

interface AIInsightsProps {
  jobId: string;
  traceId: string;
  defaultOpen?: boolean;
  onClose?: () => void;
}

type FocusMode = "bottleneck" | "errors" | "flow" | "optimization";

const FOCUS_OPTIONS: { value: FocusMode; label: string }[] = [
  { value: "bottleneck", label: "Bottleneck" },
  { value: "errors", label: "Errors" },
  { value: "flow", label: "Flow" },
  { value: "optimization", label: "Optimization" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export function AIInsights({ jobId, traceId, defaultOpen = false, onClose }: AIInsightsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [focus, setFocus] = useState<FocusMode>("bottleneck");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyzeTrace = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    setInsights(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE}/analysis/${jobId}/trace/ai-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getApiHeaders(),
        },
        body: JSON.stringify({
          trace_id: traceId,
          focus,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Analysis failed" }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let accumulatedInsights = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                accumulatedInsights += parsed.text;
                setInsights(accumulatedInsights);
              }
            } catch {
              // If not JSON, treat as plain text
              if (data) {
                accumulatedInsights += data;
                setInsights(accumulatedInsights);
              }
            }
          } else if (line.trim() && !line.startsWith(":")) {
            // Plain text response (not SSE)
            accumulatedInsights += line;
            setInsights(accumulatedInsights);
          }
        }
      }

      if (!accumulatedInsights) {
        setInsights("Analysis complete. No insights were generated.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [jobId, traceId, focus, loading]);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  }, []);

  const handleClose = () => {
    cancelAnalysis();
    setIsOpen(false);
    setInsights(null);
    setError(null);
    onClose?.();
  };

  const handleRetry = () => {
    setError(null);
    setInsights(null);
    analyzeTrace();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded hover:bg-muted"
      >
        <Sparkles className="w-4 h-4" />
        Analyze with AI
      </button>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI Insights</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Focus:</span>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as FocusMode)}
              className="px-2 py-1 text-xs border rounded bg-background"
              disabled={loading}
            >
              {FOCUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={analyzeTrace}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Analyze
              </>
            )}
          </button>

          {loading && (
            <button
              onClick={cancelAnalysis}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 mt-2 text-xs font-medium hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          </div>
        )}

        {loading && !insights && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Analyzing trace...</p>
            </div>
          </div>
        )}

        {insights && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="p-3 bg-muted/30 rounded-md text-sm whitespace-pre-wrap">
              {insights}
            </div>
          </div>
        )}

        {!loading && !insights && !error && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Select a focus mode and click &quot;Analyze&quot; to get AI-powered insights about this trace.
          </div>
        )}
      </div>
    </div>
  );
}
