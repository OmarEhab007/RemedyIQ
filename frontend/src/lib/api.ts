/**
 * API client for the RemedyIQ backend.
 *
 * All requests target `NEXT_PUBLIC_API_URL` (default: http://localhost:8080/api/v1).
 * In dev mode (`NEXT_PUBLIC_DEV_MODE=true`) auth headers are injected automatically.
 * In production a Clerk Bearer token must be supplied per-call.
 *
 * @module api
 */

import type {
  AnalysisJob,
  AggregatesResponse,
  AIQueryResponse,
  AISkill,
  AIStreamRequest,
  AutocompleteResponse,
  Conversation,
  CreateAnalysisRequest,
  CreateConversationRequest,
  CreateSavedSearchRequest,
  DashboardData,
  DelayedEscalationsResponse,
  ExceptionsResponse,
  FileMetadataResponse,
  FilterComplexityResponse,
  GapsResponse,
  LoggingActivityResponse,
  HealthResponse,
  ListAnalysesResponse,
  ListConversationsResponse,
  ListFilesResponse,
  ListSavedSearchesResponse,
  LogFile,
  ListSkillsResponse,
  LogEntry,
  LogEntryContext,
  LogType,
  Pagination,
  QueuedCallsResponse,
  RecentTracesResponse,
  ReportFormat,
  ReportResponse,
  SavedSearch,
  SearchHistoryResponse,
  SearchLogsParams,
  SearchLogsResponse,
  SpanNode,
  ThreadStatsResponse,
  TraceAIAnalyzeResponse,
  TransactionSearchParams,
  TransactionSearchResponse,
  TransactionSummary,
  TypeBreakdown,
  WaterfallResponse,
} from "./api-types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const IS_DEV_MODE: boolean =
  process.env.NEXT_PUBLIC_DEV_MODE === "true";

const DEV_USER_ID: string =
  process.env.NEXT_PUBLIC_DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

const DEV_TENANT_ID: string =
  process.env.NEXT_PUBLIC_DEV_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/** Typed API error with HTTP status, backend error code, and message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    // Restore prototype chain (required when extending built-ins in ES5 targets)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

/**
 * Returns auth headers appropriate for the current environment.
 *
 * - Dev mode: X-Dev-User-Id + X-Dev-Tenant-Id (no token required)
 * - Production: empty object (caller must provide Bearer token)
 */
export function getAuthHeaders(): Record<string, string> {
  if (IS_DEV_MODE) {
    return {
      "X-Dev-User-Id": DEV_USER_ID,
      "X-Dev-Tenant-Id": DEV_TENANT_ID,
    };
  }
  return {};
}

/** Builds Authorization header when a token is provided. */
function bearerHeader(token?: string): Record<string, string> {
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Base fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Performs an authenticated fetch request against the API.
 *
 * @param path    - Path relative to `API_BASE` (must begin with `/`).
 * @param options - Standard `RequestInit` options (method, body, headers, etc.).
 * @param token   - Optional Clerk Bearer token; used in production.
 * @returns       Parsed JSON response of type `T`.
 * @throws        `ApiError` on non-2xx responses.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...bearerHeader(token),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let code = "UNKNOWN_ERROR";
    let message = response.statusText;
    try {
      const body = (await response.json()) as {
        code?: string;
        error?: string;
        message?: string;
      };
      code = body.code ?? code;
      message = body.error ?? body.message ?? message;
    } catch {
      // Body was not JSON — keep statusText
    }
    throw new ApiError(response.status, code, message);
  }

  // 204 No Content — return empty object cast to T
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Query-string helper
// ---------------------------------------------------------------------------

function toQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return `?${qs}`;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/** GET /health */
export async function checkHealth(token?: string): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", {}, token);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * POST /files/upload — uploads a log file with optional progress tracking.
 *
 * Uses XMLHttpRequest so that upload progress events are available.
 *
 * @param file         - File selected by the user.
 * @param onProgress   - Callback receiving upload percentage (0–100).
 * @param token        - Optional Bearer token.
 */
export function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
  token?: string,
): Promise<{ file: LogFile }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${API_BASE}/files/upload`;

    xhr.open("POST", url);

    // Auth headers
    const authHeaders: Record<string, string> = {
      ...getAuthHeaders(),
      ...bearerHeader(token),
    };
    Object.entries(authHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          // Backend returns flat LogFile JSON — wrap to match expected shape
          resolve(parsed.file ? (parsed as { file: LogFile }) : { file: parsed as LogFile });
        } catch {
          reject(new ApiError(xhr.status, "PARSE_ERROR", "Failed to parse upload response"));
        }
      } else {
        let code = "UPLOAD_ERROR";
        let message = xhr.statusText;
        try {
          const body = JSON.parse(xhr.responseText) as {
            code?: string;
            error?: string;
            message?: string;
          };
          code = body.code ?? code;
          message = body.error ?? body.message ?? message;
        } catch {
          // keep defaults
        }
        reject(new ApiError(xhr.status, code, message));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError(0, "NETWORK_ERROR", "Network error during file upload")),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError(0, "ABORTED", "File upload was aborted")),
    );

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** GET /files */
export async function listFiles(
  page = 1,
  pageSize = 20,
  token?: string,
): Promise<ListFilesResponse> {
  const qs = toQueryString({ page, page_size: pageSize });
  return apiFetch<ListFilesResponse>(`/files${qs}`, {}, token);
}

// ---------------------------------------------------------------------------
// Analysis jobs
// ---------------------------------------------------------------------------

/** POST /analysis */
export async function createAnalysis(
  fileId: string,
  flags?: Record<string, string>,
  token?: string,
): Promise<AnalysisJob> {
  const body: CreateAnalysisRequest = { file_id: fileId, flags };
  return apiFetch<AnalysisJob>(
    "/analysis",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

/** GET /analysis */
export async function listAnalyses(
  page = 1,
  pageSize = 20,
  token?: string,
): Promise<ListAnalysesResponse> {
  const qs = toQueryString({ page, page_size: pageSize });
  return apiFetch<ListAnalysesResponse>(`/analysis${qs}`, {}, token);
}

/** GET /analysis/{job_id} */
export async function getAnalysis(
  jobId: string,
  token?: string,
): Promise<AnalysisJob> {
  return apiFetch<AnalysisJob>(`/analysis/${encodeURIComponent(jobId)}`, {}, token);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** GET /analysis/{job_id}/dashboard */
export async function getDashboard(
  jobId: string,
  token?: string,
): Promise<DashboardData> {
  return apiFetch<DashboardData>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/aggregates */
export async function getDashboardAggregates(
  jobId: string,
  type?: string,
  token?: string,
): Promise<AggregatesResponse> {
  const qs = type ? toQueryString({ type }) : "";
  return apiFetch<AggregatesResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/aggregates${qs}`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/exceptions */
export async function getDashboardExceptions(
  jobId: string,
  token?: string,
): Promise<ExceptionsResponse> {
  return apiFetch<ExceptionsResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/exceptions`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/gaps */
export async function getDashboardGaps(
  jobId: string,
  token?: string,
): Promise<GapsResponse> {
  return apiFetch<GapsResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/gaps`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/threads */
export async function getDashboardThreads(
  jobId: string,
  token?: string,
): Promise<ThreadStatsResponse> {
  return apiFetch<ThreadStatsResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/threads`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/filters */
export async function getDashboardFilters(
  jobId: string,
  token?: string,
): Promise<FilterComplexityResponse> {
  return apiFetch<FilterComplexityResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/filters`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/queued-calls */
export async function getDashboardQueuedCalls(
  jobId: string,
  token?: string,
): Promise<QueuedCallsResponse> {
  return apiFetch<QueuedCallsResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/queued-calls`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/delayed-escalations */
export async function getDashboardDelayedEscalations(
  jobId: string,
  minDelayMs?: number,
  limit?: number,
  token?: string,
): Promise<DelayedEscalationsResponse> {
  const qs = toQueryString({ min_delay_ms: minDelayMs, limit });
  return apiFetch<DelayedEscalationsResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/delayed-escalations${qs}`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/logging-activity */
export async function getDashboardLoggingActivity(
  jobId: string,
  token?: string,
): Promise<LoggingActivityResponse> {
  return apiFetch<LoggingActivityResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/logging-activity`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/dashboard/file-metadata */
export async function getDashboardFileMetadata(
  jobId: string,
  token?: string,
): Promise<FileMetadataResponse> {
  return apiFetch<FileMetadataResponse>(
    `/analysis/${encodeURIComponent(jobId)}/dashboard/file-metadata`,
    {},
    token,
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** POST /analysis/{job_id}/report */
export async function generateReport(
  jobId: string,
  format: ReportFormat = "html",
  token?: string,
): Promise<ReportResponse> {
  return apiFetch<ReportResponse>(
    `/analysis/${encodeURIComponent(jobId)}/report`,
    { method: "POST", body: JSON.stringify({ format }) },
    token,
  );
}

// ---------------------------------------------------------------------------
// Log search
// ---------------------------------------------------------------------------

/** GET /analysis/{job_id}/search */
export async function searchLogs(
  jobId: string,
  params: SearchLogsParams,
  token?: string,
): Promise<SearchLogsResponse> {
  const qs = toQueryString(params as Record<string, unknown>);
  // Backend returns { results: [{id, score, fields: {...}}], total, page, page_size, total_pages }
  // Transform to the frontend-expected shape { entries: LogEntry[], total, pagination }
  const raw = await apiFetch<{
    results?: Array<{ id: string; score: number; fields: Record<string, unknown> }>;
    total?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
  }>(
    `/analysis/${encodeURIComponent(jobId)}/search${qs}`,
    {},
    token,
  );

  const entries: import("./api-types").LogEntry[] = (raw.results ?? [])
    .filter((r): r is typeof r & { fields: Record<string, unknown> } => r != null && r.fields != null)
    .map((r) => ({
      tenant_id: "",
      job_id: jobId,
      entry_id: (r.fields.entry_id as string) ?? r.id,
      line_number: (r.fields.line_number as number) ?? 0,
      timestamp: (r.fields.timestamp as string) ?? "",
      log_type: (r.fields.log_type as import("./api-types").LogType) ?? "API",
      trace_id: (r.fields.trace_id as string) ?? "",
      rpc_id: (r.fields.rpc_id as string) ?? "",
      thread_id: (r.fields.thread_id as string) ?? "",
      queue: (r.fields.queue as string) ?? "",
      user: (r.fields.user as string) ?? "",
      duration_ms: (r.fields.duration_ms as number) ?? null,
      success: (r.fields.success as boolean) ?? null,
      form: (r.fields.form as string) ?? null,
      sql_table: (r.fields.sql_table as string) ?? null,
      filter_name: (r.fields.filter_name as string) ?? null,
      esc_name: (r.fields.esc_name as string) ?? null,
      raw_text: (r.fields.raw_text as string) ?? "",
      error_message: (r.fields.error_message as string) ?? null,
    }));

  return {
    entries,
    total: raw.total ?? entries.length,
    pagination: {
      page: raw.page ?? 1,
      page_size: raw.page_size ?? entries.length,
      total_pages: raw.total_pages ?? 1,
      total: raw.total ?? entries.length,
    },
  };
}

/**
 * GET /analysis/{job_id}/search/export — returns raw Blob (CSV or JSON).
 *
 * @param format - "csv" | "json"
 */
export async function exportSearchResults(
  jobId: string,
  params: SearchLogsParams,
  format: "csv" | "json" = "csv",
  token?: string,
): Promise<Blob> {
  const qs = toQueryString({ ...params, format } as Record<string, unknown>);
  const url = `${API_BASE}/analysis/${encodeURIComponent(jobId)}/search/export${qs}`;

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...bearerHeader(token),
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new ApiError(response.status, "EXPORT_ERROR", response.statusText);
  }
  return response.blob();
}

// ---------------------------------------------------------------------------
// Log entries
// ---------------------------------------------------------------------------

/** GET /analysis/{job_id}/entries/{entry_id} */
export async function getLogEntry(
  jobId: string,
  entryId: string,
  token?: string,
): Promise<LogEntry> {
  return apiFetch<LogEntry>(
    `/analysis/${encodeURIComponent(jobId)}/entries/${encodeURIComponent(entryId)}`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/entries/{entry_id}/context */
export async function getEntryContext(
  jobId: string,
  entryId: string,
  token?: string,
): Promise<LogEntryContext> {
  return apiFetch<LogEntryContext>(
    `/analysis/${encodeURIComponent(jobId)}/entries/${encodeURIComponent(entryId)}/context`,
    {},
    token,
  );
}

// ---------------------------------------------------------------------------
// Trace / waterfall
// ---------------------------------------------------------------------------

/** GET /analysis/{job_id}/trace/{trace_id} */
export async function getTrace(
  jobId: string,
  traceId: string,
  token?: string,
): Promise<WaterfallResponse> {
  return apiFetch<WaterfallResponse>(
    `/analysis/${encodeURIComponent(jobId)}/trace/${encodeURIComponent(traceId)}`,
    {},
    token,
  );
}

/** GET /analysis/{job_id}/trace/{trace_id}/waterfall */
export async function getWaterfall(
  jobId: string,
  traceId: string,
  token?: string,
): Promise<WaterfallResponse> {
  // Backend returns type_breakdown as Record<string, number> (e.g. {"API": 4, "SQL": 161})
  // and spans have `has_error` (boolean) instead of `has_errors`.
  // Transform to match the frontend WaterfallResponse type.
  interface BackendTypeBreakdown {
    API?: number;
    SQL?: number;
    FLTR?: number;
    ESCL?: number;
    // also accept frontend field names
    api_count?: number;
    sql_count?: number;
    filter_count?: number;
    esc_count?: number;
  }

  const raw = await apiFetch<
    Omit<WaterfallResponse, "type_breakdown"> & {
      type_breakdown: BackendTypeBreakdown;
    }
  >(
    `/analysis/${encodeURIComponent(jobId)}/trace/${encodeURIComponent(traceId)}/waterfall`,
    {},
    token,
  );

  // Normalize type_breakdown
  const tb = raw.type_breakdown ?? {};
  const typeBreakdown: TypeBreakdown = {
    api_count: tb.api_count ?? tb.API ?? 0,
    sql_count: tb.sql_count ?? tb.SQL ?? 0,
    filter_count: tb.filter_count ?? tb.FLTR ?? 0,
    esc_count: tb.esc_count ?? tb.ESCL ?? 0,
  };

  // Normalize spans: ensure has_error -> has_error (already correct), add defaults
  function normalizeSpan(s: SpanNode & { has_error?: boolean }): SpanNode {
    return {
      ...s,
      has_error: s.has_error ?? false,
      operation: s.operation ?? (s.fields?.api_code as string) ?? "",
      error_message: s.error_message ?? null,
      form: s.form ?? null,
      children: (s.children ?? []).map(normalizeSpan),
    };
  }

  return {
    ...raw,
    type_breakdown: typeBreakdown,
    spans: (raw.spans ?? []).map(normalizeSpan),
    flat_spans: (raw.flat_spans ?? []).map(normalizeSpan),
    critical_path: raw.critical_path ?? [],
  };
}

/**
 * GET /analysis/{job_id}/trace/{trace_id}/export — returns raw Blob.
 *
 * @param format - "csv" | "json" | "har"
 */
export async function exportTrace(
  jobId: string,
  traceId: string,
  format: "csv" | "json" | "har" = "json",
  token?: string,
): Promise<Blob> {
  const qs = toQueryString({ format });
  const url = `${API_BASE}/analysis/${encodeURIComponent(jobId)}/trace/${encodeURIComponent(traceId)}/export${qs}`;

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...bearerHeader(token),
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new ApiError(response.status, "EXPORT_ERROR", response.statusText);
  }
  return response.blob();
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** GET /analysis/{job_id}/transactions */
export async function searchTransactions(
  jobId: string,
  params: TransactionSearchParams,
  token?: string,
): Promise<TransactionSearchResponse> {
  const qs = toQueryString(params as Record<string, unknown>);
  // Backend returns a different shape than the frontend types expect.
  // Transform the response to match TransactionSummary.
  interface BackendTxn {
    trace_id: string;
    correlation_type?: string;
    primary_user?: string;
    primary_form?: string;
    primary_operation?: string;
    primary_queue?: string;
    total_duration_ms?: number;
    span_count?: number;
    error_count?: number;
    first_timestamp?: string;
    last_timestamp?: string;
    // Also accept frontend field names if they happen to match
    user?: string;
    queue?: string;
    form?: string;
    duration_ms?: number;
    start_time?: string;
    end_time?: string;
    rpc_id?: string;
    thread_id?: string;
    has_errors?: boolean;
    log_types?: LogType[];
  }

  const raw = await apiFetch<{
    transactions?: BackendTxn[];
    total?: number;
    took_ms?: number;
    pagination?: Pagination;
  }>(
    `/analysis/${encodeURIComponent(jobId)}/transactions${qs}`,
    {},
    token,
  );

  const transactions: TransactionSummary[] = (raw.transactions ?? []).map(
    (t) => ({
      trace_id: t.trace_id,
      rpc_id: t.rpc_id ?? "",
      thread_id: t.thread_id ?? "",
      queue: t.primary_queue ?? t.queue ?? "",
      user: t.primary_user ?? t.user ?? "",
      start_time: t.first_timestamp ?? t.start_time ?? "",
      end_time: t.last_timestamp ?? t.end_time ?? "",
      duration_ms: t.total_duration_ms ?? t.duration_ms ?? 0,
      span_count: t.span_count ?? 0,
      error_count: t.error_count ?? 0,
      has_errors: (t.error_count ?? 0) > 0,
      log_types: t.log_types ?? [],
      form: t.primary_form ?? t.form ?? null,
    }),
  );

  return {
    transactions,
    total: raw.total ?? transactions.length,
    pagination: raw.pagination ?? {
      page: 1,
      page_size: transactions.length,
      total: raw.total ?? transactions.length,
      total_pages: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// AI — trace analysis
// ---------------------------------------------------------------------------

/** POST /analysis/{job_id}/trace/ai-analyze */
export async function analyzeTraceAI(
  jobId: string,
  traceId: string,
  question: string,
  token?: string,
): Promise<TraceAIAnalyzeResponse> {
  return apiFetch<TraceAIAnalyzeResponse>(
    `/analysis/${encodeURIComponent(jobId)}/trace/ai-analyze`,
    {
      method: "POST",
      body: JSON.stringify({ trace_id: traceId, question }),
    },
    token,
  );
}

// ---------------------------------------------------------------------------
// AI — non-streaming query
// ---------------------------------------------------------------------------

/** POST /analysis/{job_id}/ai */
export async function queryAI(
  jobId: string,
  question: string,
  skill?: string,
  token?: string,
): Promise<AIQueryResponse> {
  return apiFetch<AIQueryResponse>(
    `/analysis/${encodeURIComponent(jobId)}/ai`,
    {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, question, skill }),
    },
    token,
  );
}

// ---------------------------------------------------------------------------
// Recent traces
// ---------------------------------------------------------------------------

/** GET /trace/recent */
export async function getRecentTraces(
  userId?: string,
  token?: string,
): Promise<RecentTracesResponse> {
  const qs = userId ? toQueryString({ user_id: userId }) : "";
  return apiFetch<RecentTracesResponse>(`/trace/recent${qs}`, {}, token);
}

// ---------------------------------------------------------------------------
// Autocomplete
// ---------------------------------------------------------------------------

/** GET /search/autocomplete */
export async function getAutocomplete(
  field: string,
  prefix: string,
  jobId?: string,
  token?: string,
): Promise<AutocompleteResponse> {
  const qs = toQueryString({
    field,
    prefix,
    ...(jobId ? { job_id: jobId } : {}),
  });
  return apiFetch<AutocompleteResponse>(`/search/autocomplete${qs}`, {}, token);
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------

/** GET /search/saved */
export async function listSavedSearches(
  token?: string,
): Promise<ListSavedSearchesResponse> {
  return apiFetch<ListSavedSearchesResponse>("/search/saved", {}, token);
}

/** POST /search/saved */
export async function createSavedSearch(
  name: string,
  query: string,
  filters?: Record<string, string>,
  token?: string,
): Promise<SavedSearch> {
  const body: CreateSavedSearchRequest = {
    name,
    kql_query: query,
    filters,
  };
  return apiFetch<SavedSearch>(
    "/search/saved",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

/** DELETE /search/saved/{search_id} */
export async function deleteSavedSearch(
  searchId: string,
  token?: string,
): Promise<void> {
  await apiFetch<void>(
    `/search/saved/${encodeURIComponent(searchId)}`,
    { method: "DELETE" },
    token,
  );
}

// ---------------------------------------------------------------------------
// Search history
// ---------------------------------------------------------------------------

/** GET /search/history */
export async function getSearchHistory(
  token?: string,
): Promise<SearchHistoryResponse> {
  return apiFetch<SearchHistoryResponse>("/search/history", {}, token);
}

// ---------------------------------------------------------------------------
// AI — streaming (SSE via POST /ai/stream)
// ---------------------------------------------------------------------------

/**
 * Initiates a streaming AI response via SSE.
 *
 * Returns an `AsyncGenerator<AIStreamEvent>` that yields parsed SSE events
 * until the stream closes or an error occurs.
 *
 * @example
 * ```ts
 * const gen = streamAI(jobId, conversationId, "Why are these queries slow?");
 * for await (const event of gen) {
 *   if (event.type === "token") appendText(event.content ?? "");
 * }
 * ```
 */
export async function* streamAI(
  jobId: string,
  conversationId: string,
  message: string,
  skill?: string,
  token?: string,
): AsyncGenerator<import("./api-types").AIStreamEvent, void, unknown> {
  const url = `${API_BASE}/ai/stream`;

  const body: AIStreamRequest = {
    job_id: jobId,
    conversation_id: conversationId,
    query: message,
    skill,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...getAuthHeaders(),
    ...bearerHeader(token),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let code = "STREAM_ERROR";
    let errMsg = response.statusText;
    try {
      const b = (await response.json()) as { code?: string; error?: string; message?: string };
      code = b.code ?? code;
      errMsg = b.error ?? b.message ?? errMsg;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, code, errMsg);
  }

  if (!response.body) {
    throw new ApiError(0, "NO_BODY", "SSE response had no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newlines
      const parts = buffer.split("\n\n");
      // The last element may be an incomplete message; keep it in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        let eventType = "";
        let dataLine = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim();
          }
        }

        if (!dataLine || dataLine === "[DONE]") {
          if (dataLine === "[DONE]") return;
          continue;
        }

        try {
          const raw = JSON.parse(dataLine) as Record<string, unknown>;

          // Map backend SSE event format to AIStreamEvent
          const mapped: import("./api-types").AIStreamEvent = (() => {
            switch (eventType) {
              case "token":
                return { type: "token" as const, content: (raw.text as string) ?? "" };
              case "done":
                return { type: "done" as const, follow_ups: raw.follow_ups as string[] | undefined };
              case "error":
                return { type: "error" as const, error: (raw.message as string) ?? (raw.error as string) ?? "Unknown error" };
              case "start":
                return { type: "start" as const, conversation_id: raw.conversation_id as string, message_id: raw.message_id as string };
              case "skill":
                return { type: "skill" as const, skill_name: raw.skill_name as string };
              case "metadata":
                return { type: "metadata" as const, tokens_used: raw.tokens_used as number, latency_ms: raw.latency_ms as number, skill_name: raw.skill_name as string };
              case "follow_ups":
                return { type: "follow_ups" as const, follow_ups: raw.follow_ups as string[] };
              default:
                // Fallback: try to use raw as-is (supports both old and new format)
                return (raw.type ? raw : { type: eventType || "token", ...raw }) as unknown as import("./api-types").AIStreamEvent;
            }
          })();

          yield mapped;
        } catch {
          // Malformed event — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// AI skills
// ---------------------------------------------------------------------------

/** GET /ai/skills */
export async function listAISkills(token?: string): Promise<AISkill[]> {
  const resp = await apiFetch<ListSkillsResponse>("/ai/skills", {}, token);
  return resp.skills;
}

// ---------------------------------------------------------------------------
// AI conversations
// ---------------------------------------------------------------------------

/** GET /ai/conversations */
export async function listConversations(
  jobId?: string,
  token?: string,
): Promise<ListConversationsResponse> {
  const qs = jobId ? toQueryString({ job_id: jobId }) : "";
  return apiFetch<ListConversationsResponse>(`/ai/conversations${qs}`, {}, token);
}

/** POST /ai/conversations */
export async function createConversation(
  jobId?: string,
  title?: string,
  token?: string,
): Promise<Conversation> {
  const body: CreateConversationRequest = { job_id: jobId, title };
  return apiFetch<Conversation>(
    "/ai/conversations",
    { method: "POST", body: JSON.stringify(body) },
    token,
  );
}

/** GET /ai/conversations/{id} */
export async function getConversation(
  conversationId: string,
  token?: string,
): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/ai/conversations/${encodeURIComponent(conversationId)}`,
    {},
    token,
  );
}

/** DELETE /ai/conversations/{id} */
export async function deleteConversation(
  conversationId: string,
  token?: string,
): Promise<void> {
  await apiFetch<void>(
    `/ai/conversations/${encodeURIComponent(conversationId)}`,
    { method: "DELETE" },
    token,
  );
}
