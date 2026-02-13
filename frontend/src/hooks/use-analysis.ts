"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAnalysis, type AnalysisJob } from "@/lib/api";
import { getWSClient } from "@/lib/websocket";

export function useAnalysisProgress(jobId: string | null) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchJob = useCallback(async () => {
    if (!jobId || isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      setLoading(true);
      const data = await getAnalysis(jobId);
      setJob(data);
      if (data.status === "complete" || data.status === "failed") {
        // Stop polling.
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    fetchJob();

    // Poll every 3 seconds until complete.
    intervalRef.current = setInterval(fetchJob, 3000);

    // Try WebSocket for real-time updates.
    const ws = getWSClient();
    // Ensure the WebSocket is connected (uses dev token in development).
    ws.connect("dev");
    const unsubscribe = ws.subscribeJobProgress(jobId, (progress) => {
      setJob((prev) =>
        prev
          ? {
              ...prev,
              progress_pct: progress.progress_pct,
              status: progress.status as AnalysisJob["status"],
            }
          : prev,
      );

      if (progress.status === "complete" || progress.status === "failed") {
        fetchJob(); // Get final state.
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      ws.disconnect();
    };
  }, [jobId, fetchJob]);

  return { job, loading, error, refetch: fetchJob };
}
