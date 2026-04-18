import { describe, it, expect } from "vitest";

import { buildSearchLogsQueryString } from "./api";
import type { SearchLogsParams } from "./api-types";

describe("buildSearchLogsQueryString", () => {
  it("emits repeated keys for array log_type", () => {
    const p: SearchLogsParams = {
      page: 1,
      page_size: 50,
      log_type: ["API", "SQL"],
      q: "user:test",
    };
    const qs = buildSearchLogsQueryString(p);
    expect(qs.startsWith("?")).toBe(true);
    expect(qs).toContain("log_type=API");
    expect(qs).toContain("log_type=SQL");
    expect(qs).toContain("q=user%3Atest");
  });

  it("serializes booleans", () => {
    const p: SearchLogsParams = {
      page: 1,
      page_size: 50,
      error_only: true,
      include_histogram: true,
    };
    const qs = buildSearchLogsQueryString(p);
    expect(qs).toContain("error_only=true");
    expect(qs).toContain("include_histogram=true");
  });

  it("omits pagination and sort fields in export mode", () => {
    const p: SearchLogsParams = {
      page: 3,
      page_size: 200,
      sort_by: "timestamp",
      sort_order: "desc",
      q: "*",
      format: "csv",
    };
    const qs = buildSearchLogsQueryString(p, { forExport: true });
    expect(qs).not.toContain("page=");
    expect(qs).not.toContain("page_size=");
    expect(qs).not.toContain("sort_by=");
    expect(qs).not.toContain("sort_order=");
    expect(qs).not.toContain("include_histogram=");
    expect(qs).toContain("format=csv");
    expect(qs).toMatch(/q=\*/);
  });
});
