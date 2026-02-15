import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  getApiHeaders,
  uploadFile,
  listFiles,
  createAnalysis,
  listAnalyses,
  getAnalysis,
  getDashboard,
  getDashboardAggregates,
  getDashboardExceptions,
  getDashboardGaps,
  getDashboardThreads,
  getDashboardFilters,
  generateReport,
} from "@/lib/api";

const API_BASE = "http://localhost:8080/api/v1";

describe("api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("ApiError", () => {
    it("creates an error with status, code, and message", () => {
      const error = new ApiError(404, "not_found", "Resource not found");
      expect(error.status).toBe(404);
      expect(error.code).toBe("not_found");
      expect(error.message).toBe("Resource not found");
      expect(error.name).toBe("ApiError");
    });
  });

  describe("getApiHeaders", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("returns dev headers in development mode", () => {
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_DEV_MODE = "true";

      const headers = getApiHeaders();
      expect(headers["X-Dev-User-ID"]).toBe("00000000-0000-0000-0000-000000000001");
      expect(headers["X-Dev-Tenant-ID"]).toBe("00000000-0000-0000-0000-000000000001");
    });

    it("returns dev headers when dev mode is not explicitly disabled", () => {
      process.env.NODE_ENV = "development";
      delete process.env.NEXT_PUBLIC_DEV_MODE;

      const headers = getApiHeaders();
      expect(headers["X-Dev-User-ID"]).toBe("00000000-0000-0000-0000-000000000001");
      expect(headers["X-Dev-Tenant-ID"]).toBe("00000000-0000-0000-0000-000000000001");
    });

    it("does not return dev headers in production", () => {
      process.env.NODE_ENV = "production";

      const headers = getApiHeaders();
      expect(headers["X-Dev-User-ID"]).toBeUndefined();
      expect(headers["X-Dev-Tenant-ID"]).toBeUndefined();
    });

    it("merges additional headers", () => {
      process.env.NODE_ENV = "development";

      const headers = getApiHeaders({ "Content-Type": "application/json" });
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Dev-User-ID"]).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  describe("uploadFile", () => {
    // uploadFile uses XMLHttpRequest, not fetch - need XHR mock
    let xhrMock: {
      open: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      setRequestHeader: ReturnType<typeof vi.fn>;
      upload: { onprogress: ((event: ProgressEvent) => void) | null };
      onload: (() => void) | null;
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      status: number;
      statusText: string;
      responseText: string;
    };

    beforeEach(() => {
      xhrMock = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        upload: { onprogress: null },
        onload: null,
        onerror: null,
        onabort: null,
        status: 200,
        statusText: "OK",
        responseText: "",
      };
      vi.stubGlobal("XMLHttpRequest", vi.fn(() => xhrMock));
    });

    it("uploads a file successfully", async () => {
      const mockFile = new File(["content"], "test.log", { type: "text/plain" });
      const mockResponse = {
        id: "file-1",
        filename: "test.log",
        size_bytes: 7,
        detected_types: ["api"],
        uploaded_at: "2026-02-12T00:00:00Z",
      };

      xhrMock.status = 200;
      xhrMock.responseText = JSON.stringify(mockResponse);

      const promise = uploadFile(mockFile);
      xhrMock.onload!();

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(xhrMock.open).toHaveBeenCalledWith("POST", `${API_BASE}/files/upload`);
      expect(xhrMock.send).toHaveBeenCalled();
    });

    it("uploads a file with token", async () => {
      const mockFile = new File(["content"], "test.log", { type: "text/plain" });
      const mockResponse = {
        id: "file-1",
        filename: "test.log",
        size_bytes: 7,
        detected_types: ["api"],
        uploaded_at: "2026-02-12T00:00:00Z",
      };

      xhrMock.status = 200;
      xhrMock.responseText = JSON.stringify(mockResponse);

      const promise = uploadFile(mockFile, "test-token");
      xhrMock.onload!();

      await promise;
      expect(xhrMock.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer test-token");
    });

    it("throws ApiError on failure", async () => {
      const mockFile = new File(["content"], "test.log", { type: "text/plain" });

      xhrMock.status = 400;
      xhrMock.statusText = "Bad Request";
      xhrMock.responseText = JSON.stringify({ code: "invalid_file", message: "Invalid file format" });

      const promise = uploadFile(mockFile);
      xhrMock.onload!();

      await expect(promise).rejects.toThrow("Invalid file format");
    });
  });

  describe("listFiles", () => {
    it("lists files with default pagination", async () => {
      const mockResponse = {
        files: [
          {
            id: "file-1",
            filename: "test.log",
            size_bytes: 100,
            detected_types: ["api"],
            uploaded_at: "2026-02-12T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 20, total_count: 1, total_pages: 1 },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await listFiles();
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/files?page=1&page_size=20`,
        expect.any(Object)
      );
    });

    it("lists files with custom pagination", async () => {
      const mockResponse = {
        files: [],
        pagination: { page: 2, page_size: 10, total_count: 25, total_pages: 3 },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await listFiles(2, 10);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/files?page=2&page_size=10`,
        expect.any(Object)
      );
    });
  });

  describe("createAnalysis", () => {
    it("creates analysis job without flags", async () => {
      const mockResponse = {
        id: "job-1",
        file_id: "file-1",
        status: "queued",
        progress_pct: 0,
        created_at: "2026-02-12T00:00:00Z",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await createAnalysis("file-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ file_id: "file-1", jar_flags: undefined }),
        })
      );
    });

    it("creates analysis job with flags", async () => {
      const mockResponse = {
        id: "job-1",
        file_id: "file-1",
        status: "queued",
        progress_pct: 0,
        created_at: "2026-02-12T00:00:00Z",
      };

      const flags = { top_n: 10, skip_api: true };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await createAnalysis("file-1", flags);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis`,
        expect.objectContaining({
          body: JSON.stringify({ file_id: "file-1", jar_flags: flags }),
        })
      );
    });
  });

  describe("listAnalyses", () => {
    it("lists analysis jobs", async () => {
      const mockResponse = {
        jobs: [
          {
            id: "job-1",
            file_id: "file-1",
            status: "complete",
            progress_pct: 100,
            created_at: "2026-02-12T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 20, total_count: 1, total_pages: 1 },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await listAnalyses();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getAnalysis", () => {
    it("gets analysis job by id", async () => {
      const mockResponse = {
        id: "job-1",
        file_id: "file-1",
        status: "complete",
        progress_pct: 100,
        created_at: "2026-02-12T00:00:00Z",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getAnalysis("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1`,
        expect.any(Object)
      );
    });

    it("encodes job id in URL", async () => {
      const mockResponse = {
        id: "job/special",
        file_id: "file-1",
        status: "complete",
        progress_pct: 100,
        created_at: "2026-02-12T00:00:00Z",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getAnalysis("job/special");
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job%2Fspecial`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboard", () => {
    it("gets dashboard data", async () => {
      const mockResponse = {
        general_stats: {
          total_lines: 1000,
          api_count: 100,
          sql_count: 200,
          filter_count: 50,
          esc_count: 10,
          unique_users: 5,
          unique_forms: 3,
          unique_tables: 10,
          log_start: "2026-02-12T00:00:00Z",
          log_end: "2026-02-12T01:00:00Z",
          log_duration: "1h",
        },
        top_api_calls: [],
        top_sql_statements: [],
        top_filters: [],
        top_escalations: [],
        time_series: [],
        distribution: {},
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboard("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboardAggregates", () => {
    it("gets aggregates without type filter", async () => {
      const mockResponse = {
        api: { groups: [], grand_total: undefined },
        sql: { groups: [], grand_total: undefined },
        filter: { groups: [], grand_total: undefined },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboardAggregates("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/aggregates`,
        expect.any(Object)
      );
    });

    it("gets aggregates with type filter", async () => {
      const mockResponse = {
        api: { groups: [], grand_total: undefined },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await getDashboardAggregates("job-1", "api");
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/aggregates?type=api`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboardExceptions", () => {
    it("gets exceptions data", async () => {
      const mockResponse = {
        exceptions: [],
        total_count: 0,
        error_rates: {},
        top_codes: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboardExceptions("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/exceptions`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboardGaps", () => {
    it("gets gaps data", async () => {
      const mockResponse = {
        gaps: [],
        queue_health: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboardGaps("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/gaps`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboardThreads", () => {
    it("gets thread stats", async () => {
      const mockResponse = {
        threads: [],
        total_threads: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboardThreads("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/threads`,
        expect.any(Object)
      );
    });
  });

  describe("getDashboardFilters", () => {
    it("gets filter complexity data", async () => {
      const mockResponse = {
        most_executed: [],
        per_transaction: [],
        total_filter_time_ms: 0,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getDashboardFilters("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/dashboard/filters`,
        expect.any(Object)
      );
    });
  });

  describe("generateReport", () => {
    it("generates report with default format", async () => {
      const mockResponse = {
        job_id: "job-1",
        format: "html",
        content: "<html>report</html>",
        generated_at: "2026-02-12T00:00:00Z",
        skill_used: "report",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await generateReport("job-1");
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/report`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ format: "html" }),
        })
      );
    });

    it("generates report with custom format", async () => {
      const mockResponse = {
        job_id: "job-1",
        format: "markdown",
        content: "# Report",
        generated_at: "2026-02-12T00:00:00Z",
        skill_used: "report",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await generateReport("job-1", "markdown");
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/analysis/job-1/report`,
        expect.objectContaining({
          body: JSON.stringify({ format: "markdown" }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("handles non-JSON error responses", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers({ "content-type": "text/plain" }),
        json: async () => {
          throw new Error("Not JSON");
        },
      } as Response);

      await expect(listFiles()).rejects.toThrow(ApiError);
    });

    it("handles network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      await expect(listFiles()).rejects.toThrow("Network error");
    });

    it("includes error code and message from response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ code: "not_found", message: "Job not found" }),
      } as Response);

      try {
        await getAnalysis("nonexistent");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).code).toBe("not_found");
        expect((error as ApiError).message).toBe("Job not found");
      }
    });
  });
});
