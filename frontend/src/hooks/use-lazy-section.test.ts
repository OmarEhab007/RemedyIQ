import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { useLazySection } from "@/hooks/use-lazy-section";

describe("useLazySection", () => {
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let capturedCallback: IntersectionObserverCallback | null;

  beforeEach(() => {
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();
    capturedCallback = null;

    class MockIntersectionObserver {
      observe = mockObserve;
      unobserve = vi.fn();
      disconnect = mockDisconnect;
      constructor(cb: IntersectionObserverCallback) {
        capturedCallback = cb;
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    it("returns null data initially", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });
      const { result } = renderHook(() => useLazySection(fetchFn));

      expect(result.current.data).toBeNull();
    });

    it("returns loading as false initially", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });
      const { result } = renderHook(() => useLazySection(fetchFn));

      expect(result.current.loading).toBe(false);
    });

    it("returns error as null initially", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });
      const { result } = renderHook(() => useLazySection(fetchFn));

      expect(result.current.error).toBeNull();
    });

    it("returns a ref object", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });
      const { result } = renderHook(() => useLazySection(fetchFn));

      expect(result.current.ref).toBeDefined();
      expect(result.current.ref.current).toBeNull();
    });
  });

  describe("IntersectionObserver", () => {
    it("provides a ref for lazy loading", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });
      const { result } = renderHook(() => useLazySection(fetchFn));

      expect(result.current.ref).toBeDefined();
    });

    it("creates observer and fetches data when element intersects", async () => {
      const mockData = { value: "lazy data" };
      const fetchFn = vi.fn().mockResolvedValue(mockData);

      // Use a real component to attach the ref to a DOM element
      function TestComponent() {
        const { data, loading, ref } = useLazySection(fetchFn);
        return React.createElement("div", { ref, "data-testid": "lazy-div" },
          loading ? "loading" : data ? JSON.stringify(data) : "idle"
        );
      }

      render(React.createElement(TestComponent));

      // Observer should have been created and observe called
      expect(mockObserve).toHaveBeenCalled();
      expect(capturedCallback).not.toBeNull();

      // Simulate intersection
      await act(async () => {
        capturedCallback!(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      });

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledTimes(1);
      });
    });

    it("does not fetch when not intersecting", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });

      function TestComponent() {
        const { ref } = useLazySection(fetchFn);
        return React.createElement("div", { ref, "data-testid": "lazy-div" });
      }

      render(React.createElement(TestComponent));

      // Simulate non-intersection
      await act(async () => {
        capturedCallback!(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      });

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("disconnects observer on unmount", () => {
      const fetchFn = vi.fn().mockResolvedValue({ value: "test" });

      function TestComponent() {
        const { ref } = useLazySection(fetchFn);
        return React.createElement("div", { ref });
      }

      const { unmount } = render(React.createElement(TestComponent));
      expect(mockObserve).toHaveBeenCalled();

      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("refetch", () => {
    it("refetch function triggers data fetch", async () => {
      const mockData = { value: "test data" };
      const fetchFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useLazySection(fetchFn));

      await act(async () => {
        await result.current.refetch();
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockData);
    });

    it("sets loading state during refetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchFn = vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const { result } = renderHook(() => useLazySection(fetchFn));

      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!({ value: "data" });
      });

      expect(result.current.loading).toBe(false);
    });

    it("sets error on refetch failure", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("Fetch failed"));

      const { result } = renderHook(() => useLazySection(fetchFn));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe("Fetch failed");
    });

    it("sets generic error for non-Error failures", async () => {
      const fetchFn = vi.fn().mockRejectedValue("Unknown error");

      const { result } = renderHook(() => useLazySection(fetchFn));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe("Failed to load data");
    });

    it("refetch can be called multiple times", async () => {
      const mockData1 = { value: "first" };
      const mockData2 = { value: "second" };
      const fetchFn = vi.fn().mockResolvedValueOnce(mockData1).mockResolvedValueOnce(mockData2);

      const { result } = renderHook(() => useLazySection(fetchFn));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toEqual(mockData1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toEqual(mockData2);
    });

    it("clears error on successful refetch after failure", async () => {
      const mockData = { value: "success" };
      const fetchFn = vi.fn()
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useLazySection(fetchFn));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe("Failed");

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockData);
    });
  });
});
