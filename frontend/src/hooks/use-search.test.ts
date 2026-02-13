import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSearch } from "@/hooks/use-search";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/explorer"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/lib/api", () => ({
  getApiHeaders: vi.fn(() => ({
    "Content-Type": "application/json",
  })),
}));

describe("useSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns empty query initially", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe("");
    });

    it("returns null results initially", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.results).toBeNull();
    });

    it("returns loading as false initially", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.loading).toBe(false);
    });

    it("returns error as null initially", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.error).toBeNull();
    });

    it("returns page as 1 initially", () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.page).toBe(1);
    });
  });

  describe("executeSearch", () => {
    it("sets results on successful search", async () => {
      const mockResponse = {
        results: [{ id: "1", score: 0.95, fields: { message: "test" } }],
        total: 1,
        page: 1,
        page_size: 25,
        total_pages: 1,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test query");
      });

      await waitFor(
        () => {
          expect(result.current.results).toEqual(mockResponse);
        },
        { timeout: 1000 }
      );
    });

    it("sets error on failed search", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "Search failed" }),
      } as Response);

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test query");
      });

      await waitFor(
        () => {
          expect(result.current.error).toBe("Search failed");
        },
        { timeout: 1000 }
      );
    });

    it("clears results when query is empty", async () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("   ");
      });

      expect(result.current.results).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("updates query state", () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("new query");
      });

      expect(result.current.query).toBe("new query");
    });

    it("resets page to 1 on new search", async () => {
      const mockResponse = {
        results: [],
        total: 0,
        page: 2,
        page_size: 25,
        total_pages: 0,
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test");
      });

      await waitFor(
        () => {
          expect(result.current.page).toBe(1);
        },
        { timeout: 1000 }
      );
    });
  });

  describe("goToPage", () => {
    it("updates page number and executes search", async () => {
      const mockResponse = {
        results: [],
        total: 0,
        page: 2,
        page_size: 25,
        total_pages: 0,
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test");
      });

      await waitFor(
        () => {
          expect(fetch).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      vi.mocked(fetch).mockClear();

      act(() => {
        result.current.goToPage(3);
      });

      await waitFor(
        () => {
          expect(result.current.page).toBe(3);
          expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("page=3"),
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe("setQuery", () => {
    it("updates query without triggering search", () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery("new query");
      });

      expect(result.current.query).toBe("new query");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("filters", () => {
    it("appends filter params to search request", async () => {
      const mockResponse = {
        results: [],
        total: 0,
        page: 1,
        page_size: 25,
        total_pages: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const filters = { log_type: ["API", "SQL"], user: ["Demo"] };
      const { result } = renderHook(() => useSearch("job-1", filters));

      act(() => {
        result.current.search("test");
      });

      await waitFor(
        () => {
          expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("log_type=API"),
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe("error handling", () => {
    it("handles non-JSON error response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error("not json"); },
      } as Response);

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test");
      });

      await waitFor(
        () => {
          expect(result.current.error).toBe("Search failed");
        },
        { timeout: 1000 }
      );
    });

    it("handles non-Error exceptions", async () => {
      vi.mocked(fetch).mockRejectedValueOnce("network down");

      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test");
      });

      await waitFor(
        () => {
          expect(result.current.error).toBe("Search failed");
        },
        { timeout: 1000 }
      );
    });
  });

  describe("debounce", () => {
    it("cleans up debounce timer on unmount", async () => {
      vi.useFakeTimers();

      const { result, unmount } = renderHook(() => useSearch());

      act(() => {
        result.current.search("test");
      });

      // Unmount before debounce fires
      unmount();

      // Should not throw
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      vi.useRealTimers();
    });
  });
});
