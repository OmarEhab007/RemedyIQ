import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAI } from "@/hooks/use-ai";

vi.mock("@/lib/api", () => ({
  getApiHeaders: vi.fn(() => ({
    "Content-Type": "application/json",
    "X-Dev-User-ID": "test-user",
    "X-Dev-Tenant-ID": "test-tenant",
  })),
}));

describe("useAI", () => {
  const jobId = "test-job-123";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns empty messages array", () => {
      const { result } = renderHook(() => useAI(jobId));
      expect(result.current.messages).toEqual([]);
    });

    it("returns loading as false", () => {
      const { result } = renderHook(() => useAI(jobId));
      expect(result.current.loading).toBe(false);
    });

    it("returns error as null", () => {
      const { result } = renderHook(() => useAI(jobId));
      expect(result.current.error).toBeNull();
    });

    it("returns empty skills array", () => {
      const { result } = renderHook(() => useAI(jobId));
      expect(result.current.skills).toEqual([]);
    });
  });

  describe("fetchSkills", () => {
    it("populates skills list on successful fetch", async () => {
      const mockSkills = [
        { name: "summarizer", description: "Summarize logs", examples: ["Summarize this log"] },
        { name: "error_explainer", description: "Explain errors", examples: ["Explain this error"] },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ skills: mockSkills }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.fetchSkills();
      });

      expect(result.current.skills).toEqual(mockSkills);
    });

    it("handles empty skills response gracefully", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.fetchSkills();
      });

      expect(result.current.skills).toEqual([]);
    });

    it("handles fetch errors silently", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.fetchSkills();
      });

      expect(result.current.skills).toEqual([]);
    });
  });

  describe("sendMessage", () => {
    it("adds user message to messages", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "AI response",
          skill_name: "nl_query",
        }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("What are the top errors?");
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("What are the top errors?");
    });

    it("adds AI response message after successful query", async () => {
      const mockResponse = {
        answer: "The top errors are...",
        skill_name: "nl_query",
        references: [{ entry_id: "1", line_number: 100, log_type: "api", summary: "Timeout error" }],
        follow_ups: ["Show me more details", "Explain this error"],
        confidence: 0.95,
        tokens_used: 150,
        latency_ms: 500,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("What are the top errors?");
      });

      expect(result.current.messages).toHaveLength(2);
      const aiMsg = result.current.messages[1];
      expect(aiMsg.role).toBe("assistant");
      expect(aiMsg.content).toBe(mockResponse.answer);
      expect(aiMsg.skillName).toBe(mockResponse.skill_name);
      expect(aiMsg.references).toEqual(mockResponse.references);
      expect(aiMsg.followUps).toEqual(mockResponse.follow_ups);
      expect(aiMsg.confidence).toBe(mockResponse.confidence);
      expect(aiMsg.tokensUsed).toBe(mockResponse.tokens_used);
      expect(aiMsg.latencyMs).toBe(mockResponse.latency_ms);
    });

    it("sets loading state during API call", async () => {
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useAI(jobId));

      act(() => {
        result.current.sendMessage("Test query");
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ answer: "Response" }),
        } as Response);
        await pendingPromise;
      });

      expect(result.current.loading).toBe(false);
    });

    it("sets error state on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(result.current.error).toBe("Internal server error");
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("user");
    });

    it("handles non-JSON error responses", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error("Not JSON");
        },
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(result.current.error).toBe("AI query failed (HTTP 503)");
    });

    it("uses default skill name when not provided", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Response" }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/analysis/${jobId}/ai`),
        expect.objectContaining({
          body: JSON.stringify({ query: "Test query", skill_name: "nl_query" }),
        })
      );
    });

    it("uses provided skill name", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Response" }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query", "summarizer");
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/analysis/${jobId}/ai`),
        expect.objectContaining({
          body: JSON.stringify({ query: "Test query", skill_name: "summarizer" }),
        })
      );
    });

    it("handles network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.loading).toBe(false);
    });
  });

  describe("clearMessages", () => {
    it("clears all messages", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: "Response" }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it("clears error state", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Error" }),
      } as Response);

      const { result } = renderHook(() => useAI(jobId));

      await act(async () => {
        await result.current.sendMessage("Test query");
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
