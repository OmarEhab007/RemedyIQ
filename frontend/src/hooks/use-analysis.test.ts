import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnalysisProgress } from "@/hooks/use-analysis";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAnalysis: vi.fn(),
}));

const mockUnsubscribe = vi.fn();
vi.mock("@/lib/websocket", () => ({
  getWSClient: vi.fn(() => ({
    subscribeJobProgress: vi.fn(() => mockUnsubscribe),
  })),
}));

describe("useAnalysis", () => {
  const mockJob = {
    id: "job-123",
    file_id: "file-1",
    status: "parsing" as const,
    progress_pct: 50,
    created_at: "2026-02-12T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns null job when jobId is null", () => {
      const { result } = renderHook(() => useAnalysisProgress(null));

      expect(result.current.job).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe("data fetching", () => {
    it("fetches job data on mount", async () => {
      vi.mocked(api.getAnalysis).mockResolvedValueOnce(mockJob);

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.job).toEqual(mockJob);
      });

      expect(api.getAnalysis).toHaveBeenCalledWith("job-123");
      expect(result.current.loading).toBe(false);
    });

    it("sets error on fetch failure", async () => {
      vi.mocked(api.getAnalysis).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.error).toBe("Network error");
      });

      expect(result.current.loading).toBe(false);
    });

    it("sets generic error message for non-Error failures", async () => {
      vi.mocked(api.getAnalysis).mockRejectedValueOnce("Unknown error");

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to fetch job");
      });
    });
  });

  describe("refetch", () => {
    it("refetch function triggers new data fetch", async () => {
      vi.mocked(api.getAnalysis).mockResolvedValueOnce(mockJob);

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.job).toEqual(mockJob);
      });

      const updatedJob = { ...mockJob, progress_pct: 75 };
      vi.mocked(api.getAnalysis).mockResolvedValueOnce(updatedJob);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.job).toEqual(updatedJob);
    });

    it("refetch returns early when jobId is null", async () => {
      const { result } = renderHook(() => useAnalysisProgress(null));

      await act(async () => {
        await result.current.refetch();
      });

      expect(api.getAnalysis).not.toHaveBeenCalled();
    });
  });

  describe("polling stops on terminal status", () => {
    it("stops polling when status is complete", async () => {
      vi.useFakeTimers();
      const completeJob = { ...mockJob, status: "complete" as const };
      vi.mocked(api.getAnalysis).mockResolvedValue(completeJob);

      renderHook(() => useAnalysisProgress("job-123"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.getAnalysis).toHaveBeenCalledTimes(1);

      // Advance past polling interval - should NOT call again since complete
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      // Only 1 call, no additional polling
      expect(api.getAnalysis).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("stops polling when status is failed", async () => {
      vi.useFakeTimers();
      const failedJob = { ...mockJob, status: "failed" as const };
      vi.mocked(api.getAnalysis).mockResolvedValue(failedJob);

      renderHook(() => useAnalysisProgress("job-123"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(api.getAnalysis).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(api.getAnalysis).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("WebSocket progress updates", () => {
    it("updates job progress from WebSocket callback", async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue(mockJob);

      let wsCallback: (progress: any) => void = () => {};
      const { getWSClient } = await import("@/lib/websocket");
      vi.mocked(getWSClient).mockReturnValue({
        subscribeJobProgress: vi.fn((_id: string, cb: any) => {
          wsCallback = cb;
          return mockUnsubscribe;
        }),
      } as any);

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.job).toEqual(mockJob);
      });

      // Simulate WS progress update
      act(() => {
        wsCallback({ progress_pct: 80, status: "parsing" });
      });

      expect(result.current.job?.progress_pct).toBe(80);
    });

    it("refetches on complete status from WebSocket", async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue(mockJob);

      let wsCallback: (progress: any) => void = () => {};
      const { getWSClient } = await import("@/lib/websocket");
      vi.mocked(getWSClient).mockReturnValue({
        subscribeJobProgress: vi.fn((_id: string, cb: any) => {
          wsCallback = cb;
          return mockUnsubscribe;
        }),
      } as any);

      const { result } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(result.current.job).toBeDefined();
      });

      const completeJob = { ...mockJob, status: "complete" as const, progress_pct: 100 };
      vi.mocked(api.getAnalysis).mockResolvedValue(completeJob);

      await act(async () => {
        wsCallback({ progress_pct: 100, status: "complete" });
      });

      await waitFor(() => {
        expect(api.getAnalysis).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("cleanup", () => {
    it("unsubscribes from WebSocket on unmount", async () => {
      vi.mocked(api.getAnalysis).mockResolvedValue(mockJob);

      const { unmount } = renderHook(() => useAnalysisProgress("job-123"));

      await waitFor(() => {
        expect(api.getAnalysis).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
