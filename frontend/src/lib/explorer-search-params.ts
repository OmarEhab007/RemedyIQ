import type { ExplorerFilter, ExplorerTimeRange } from "@/stores/explorer-store";
import type { SearchLogsParams, SearchLogsSortField } from "./api-types";

export type ExplorerSearchInputs = {
  debouncedQuery: string;
  filters: ExplorerFilter[];
  timeRange: ExplorerTimeRange | null;
  sortBy: SearchLogsSortField;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
  includeHistogram: boolean;
};

function normalizeTimeParam(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toISOString();
}

/**
 * Maps explorer UI state to GET /analysis/{job_id}/search query params.
 */
export function buildExplorerSearchParams(input: ExplorerSearchInputs): SearchLogsParams {
  const p: SearchLogsParams = {
    page: input.page,
    page_size: input.pageSize,
    sort_by: input.sortBy,
    sort_order: input.sortOrder,
    include_histogram: input.includeHistogram,
  };

  const q = input.debouncedQuery.trim();
  if (q) p.q = q;

  if (input.timeRange?.start) {
    p.time_from = normalizeTimeParam(input.timeRange.start);
  }
  if (input.timeRange?.end) {
    p.time_to = normalizeTimeParam(input.timeRange.end);
  }

  const logTypes: string[] = [];
  const users: string[] = [];
  const queues: string[] = [];
  let form: string | undefined;

  for (const filter of input.filters) {
    switch (filter.field) {
      case "log_type":
        logTypes.push(filter.value);
        break;
      case "user":
        users.push(filter.value);
        break;
      case "form":
        form = filter.value;
        break;
      case "queue":
        queues.push(filter.value);
        break;
      case "error_only":
        p.error_only = true;
        break;
      case "min_duration": {
        const n = parseInt(filter.value, 10);
        if (!Number.isNaN(n)) p.min_duration = n;
        break;
      }
      case "max_duration": {
        const n = parseInt(filter.value, 10);
        if (!Number.isNaN(n)) p.max_duration = n;
        break;
      }
      default:
        break;
    }
  }

  if (logTypes.length === 1) p.log_type = logTypes[0];
  else if (logTypes.length > 1) p.log_type = logTypes;

  if (users.length === 1) p.user = users[0];
  else if (users.length > 1) p.user = users;

  if (queues.length === 1) p.queue = queues[0];
  else if (queues.length > 1) p.queue = queues;

  if (form) p.form = form;

  return p;
}
