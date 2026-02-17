export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

// --- Types matching backend domain models ---

export interface LogFile {
  id: string;
  filename: string;
  size_bytes: number;
  detected_types: string[];
  uploaded_at: string;
}

export interface JARFlags {
  top_n?: number;
  group_by?: string[];
  sort_by?: string;
  user_filter?: string;
  exclude_users?: string[];
  skip_api?: boolean;
  skip_sql?: boolean;
  skip_esc?: boolean;
  skip_fltr?: boolean;
  include_fts?: boolean;
}

export interface AnalysisJob {
  id: string;
  file_id: string;
  status:
    | "queued"
    | "parsing"
    | "analyzing"
    | "storing"
    | "complete"
    | "failed";
  progress_pct: number;
  api_count?: number;
  sql_count?: number;
  filter_count?: number;
  esc_count?: number;
  log_start?: string;
  log_end?: string;
  log_duration?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface TopNEntry {
  rank: number;
  line_number: number;
  file_number: number;
  timestamp: string;
  trace_id: string;
  rpc_id: string;
  queue: string;
  identifier: string;
  form?: string;
  user?: string;
  duration_ms: number;
  queue_time_ms?: number;
  success: boolean;
  details?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  api_count: number;
  sql_count: number;
  filter_count: number;
  esc_count: number;
  avg_duration_ms: number;
  error_count: number;
}

export interface GeneralStats {
  total_lines: number;
  api_count: number;
  sql_count: number;
  filter_count: number;
  esc_count: number;
  unique_users: number;
  unique_forms: number;
  unique_tables: number;
  log_start: string;
  log_end: string;
  log_duration: string;
}

export interface DashboardData {
  general_stats: GeneralStats;
  top_api_calls: TopNEntry[];
  top_sql_statements: TopNEntry[];
  top_filters: TopNEntry[];
  top_escalations: TopNEntry[];
  time_series: TimeSeriesPoint[];
  distribution: Record<string, Record<string, number>>;
  health_score?: HealthScore | null;
}

// --- Enhanced Analysis Dashboard Types ---

export interface AggregateGroup {
  name: string;
  count: number;
  total_ms: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  error_count: number;
  error_rate: number;
  unique_traces: number;
}

export interface AggregateSection {
  groups: AggregateGroup[];
  grand_total?: AggregateGroup;
}

export interface AggregatesResponse {
  api?: AggregateSection;
  sql?: AggregateSection;
  filter?: AggregateSection;
}

export interface GapEntry {
  start_time: string;
  end_time: string;
  duration_ms: number;
  before_line: number;
  after_line: number;
  log_type: string;
  queue?: string;
  thread_id?: string;
}

export interface QueueHealthSummary {
  queue: string;
  total_calls: number;
  avg_ms: number;
  error_rate: number;
  p95_ms: number;
}

export interface GapsResponse {
  gaps: GapEntry[];
  queue_health: QueueHealthSummary[];
}

export interface ThreadStatsEntry {
  thread_id: string;
  total_calls: number;
  total_ms: number;
  avg_ms: number;
  max_ms: number;
  error_count: number;
  busy_pct: number;
  active_start?: string;
  active_end?: string;
}

export interface ThreadStatsResponse {
  threads: ThreadStatsEntry[];
  total_threads: number;
}

export interface ExceptionEntry {
  error_code: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  log_type: string;
  queue?: string;
  form?: string;
  user?: string;
  sample_line: number;
  sample_trace?: string;
}

export interface ExceptionsResponse {
  exceptions: ExceptionEntry[];
  total_count: number;
  error_rates: Record<string, number>;
  top_codes: string[];
}

export interface MostExecutedFilter {
  name: string;
  count: number;
  total_ms: number;
}

export interface FilterPerTransaction {
  transaction_id: string;
  filter_name: string;
  execution_count: number;
  total_ms: number;
  avg_ms: number;
  max_ms: number;
  queue?: string;
  form?: string;
}

export interface FilterComplexityResponse {
  most_executed: MostExecutedFilter[];
  per_transaction: FilterPerTransaction[];
  total_filter_time_ms: number;
}

// --- JAR-Native Types (source: "jar_parsed") ---

export interface JARGapEntry {
  gap_duration: number;
  line_number: number;
  trace_id: string;
  timestamp: string;
  details: string;
}

export interface JARGapsResponse {
  line_gaps: JARGapEntry[];
  thread_gaps: JARGapEntry[];
  queue_health: QueueHealthSummary[];
  source: "jar_parsed" | "computed";
}

export interface JARAggregateRow {
  operation_type: string;
  ok: number;
  fail: number;
  total: number;
  min_time: number;
  max_time: number;
  avg_time: number;
  sum_time: number;
  min_line: number;
  max_line: number;
}

export interface JARAggregateGroup {
  entity_name: string;
  rows: JARAggregateRow[];
  subtotal?: JARAggregateRow;
}

export interface JARAggregateTable {
  grouped_by: string;
  sorted_by: string;
  groups: JARAggregateGroup[];
  grand_total?: JARAggregateRow;
}

export interface JARAggregatesResponse {
  api_by_form?: JARAggregateTable;
  api_by_client?: JARAggregateTable;
  api_by_client_ip?: JARAggregateTable;
  sql_by_table?: JARAggregateTable;
  esc_by_form?: JARAggregateTable;
  esc_by_pool?: JARAggregateTable;
  source: "jar_parsed" | "computed";
}

export interface JARThreadStat {
  queue: string;
  thread_id: string;
  first_time: string;
  last_time: string;
  count: number;
  q_count: number;
  q_time: number;
  total_time: number;
  busy_pct: number;
}

export interface JARThreadStatsResponse {
  api_threads: JARThreadStat[];
  sql_threads: JARThreadStat[];
  source: "jar_parsed" | "computed";
}

export interface JARAPIError {
  end_line: number;
  trace_id: string;
  queue: string;
  api_type: string;
  form: string;
  user: string;
  start_time: string;
  error_message: string;
}

export interface JARExceptionEntry {
  line_number: number;
  trace_id: string;
  exception_type: string;
  message: string;
  sql_statement: string;
}

export interface JARExceptionsResponse {
  api_errors: JARAPIError[];
  api_exceptions: JARExceptionEntry[];
  sql_exceptions: JARExceptionEntry[];
  source: "jar_parsed" | "computed";
}

export interface JARFilterMostExecuted {
  filter_name: string;
  pass_count: number;
  fail_count: number;
}

export interface JARFilterPerTransaction {
  line_number: number;
  trace_id: string;
  filter_count: number;
  operation: string;
  form: string;
  request_id: string;
  filters_per_sec: number;
}

export interface JARFilterExecutedPerTxn {
  line_number: number;
  trace_id: string;
  filter_name: string;
  pass_count: number;
  fail_count: number;
}

export interface JARFilterLevel {
  line_number: number;
  trace_id: string;
  filter_level: number;
  operation: string;
  form: string;
  request_id: string;
}

export interface JARFilterComplexityResponse {
  longest_running: TopNEntry[];
  most_executed: JARFilterMostExecuted[];
  per_transaction: JARFilterPerTransaction[];
  executed_per_txn: JARFilterExecutedPerTxn[];
  filter_levels: JARFilterLevel[];
  source: "jar_parsed" | "computed";
}

export interface JARAPIAbbreviation {
  abbreviation: string;
  full_name: string;
}

// --- Health Score ---

export interface HealthScoreFactor {
  name: string;
  score: number;
  max_score: number;
  weight: number;
  description: string;
  severity: string;
}

export interface HealthScore {
  score: number;
  status: string;
  factors: HealthScoreFactor[];
}

export interface Pagination {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface SpanNode {
  id: string;
  parent_id?: string;
  depth: number;
  log_type: "API" | "SQL" | "FLTR" | "ESCL";
  start_offset_ms: number;
  duration_ms: number;
  fields: Record<string, unknown>;
  children: SpanNode[];
  on_critical_path: boolean;
  has_error: boolean;
  timestamp: string;
  thread_id: string;
  trace_id: string;
  rpc_id?: string;
  user?: string;
  queue?: string;
  form?: string;
  operation?: string;
  line_number: number;
  file_number: number;
  success: boolean;
  error_message?: string;
}

export interface WaterfallResponse {
  trace_id: string;
  correlation_type: string;
  total_duration_ms: number;
  span_count: number;
  error_count: number;
  primary_user: string;
  primary_queue: string;
  type_breakdown: Record<string, number>;
  trace_start: string;
  trace_end: string;
  spans: SpanNode[];
  flat_spans: SpanNode[];
  critical_path: string[];
  took_ms: number;
}

export interface TransactionSummary {
  trace_id: string;
  correlation_type: string;
  primary_user: string;
  primary_form: string;
  primary_operation: string;
  total_duration_ms: number;
  span_count: number;
  error_count: number;
  first_timestamp: string;
  last_timestamp: string;
  primary_queue?: string;
}

export interface TransactionSearchResponse {
  transactions: TransactionSummary[];
  total: number;
  took_ms: number;
}

export interface TransactionSearchParams {
  user?: string;
  thread_id?: string;
  trace_id?: string;
  rpc_id?: string;
  has_errors?: boolean;
  min_duration_ms?: number;
  limit?: number;
  offset?: number;
}

// --- API Error ---

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// --- Shared headers helper ---

export function getApiHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };

  // In development, use dev bypass headers
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_MODE !== "false") {
    headers["X-Dev-User-ID"] = "00000000-0000-0000-0000-000000000001";
    headers["X-Dev-Tenant-ID"] = "00000000-0000-0000-0000-000000000001";
  }

  return headers;
}

// --- Base fetch helper ---

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    // Apply dev headers if no token
    Object.assign(headers, getApiHeaders());
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Check content-type before parsing JSON
    const contentType = res.headers.get("content-type");
    let body: { code?: string; message?: string } = { code: "unknown", message: res.statusText };

    if (contentType && contentType.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        // Fall back to default error
      }
    }

    throw new ApiError(res.status, body.code || "unknown", body.message || res.statusText);
  }

  return res.json();
}

// --- API functions ---

export async function uploadFile(
  file: File,
  token?: string,
  onProgress?: (pct: number) => void,
): Promise<LogFile> {
  const formData = new FormData();
  formData.append("file", file);

  // Use XMLHttpRequest for upload progress tracking (fetch API doesn't support it)
  return new Promise<LogFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/files/upload`);

    // Apply auth headers
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    } else {
      const headers = getApiHeaders();
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new ApiError(xhr.status, "parse_error", "Failed to parse response"));
        }
      } else {
        let body: { code?: string; message?: string } = { code: "unknown", message: xhr.statusText };
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // use default
        }
        reject(new ApiError(xhr.status, body.code || "unknown", body.message || xhr.statusText));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError(0, "network_error", "Network error during upload"));
    };

    xhr.onabort = () => {
      reject(new ApiError(0, "aborted", "Upload was cancelled"));
    };

    xhr.send(formData);
  });
}

export async function listFiles(
  page = 1,
  pageSize = 20,
  token?: string,
): Promise<{ files: LogFile[]; pagination: Pagination }> {
  return apiFetch(`/files?page=${page}&page_size=${pageSize}`, {}, token);
}

export async function createAnalysis(
  fileId: string,
  flags?: JARFlags,
  token?: string,
): Promise<AnalysisJob> {
  return apiFetch<AnalysisJob>("/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, jar_flags: flags }),
  }, token);
}

export async function listAnalyses(
  token?: string,
): Promise<{ jobs: AnalysisJob[]; pagination: Pagination }> {
  return apiFetch("/analysis", {}, token);
}

export async function getAnalysis(
  jobId: string,
  token?: string,
): Promise<AnalysisJob> {
  const id = encodeURIComponent(jobId);
  return apiFetch<AnalysisJob>(`/analysis/${id}`, {}, token);
}

export async function getDashboard(
  jobId: string,
  token?: string,
): Promise<DashboardData> {
  const id = encodeURIComponent(jobId);
  return apiFetch<DashboardData>(`/analysis/${id}/dashboard`, {}, token);
}

export async function getDashboardAggregates(
  jobId: string,
  type?: string,
  token?: string,
): Promise<AggregatesResponse | JARAggregatesResponse> {
  const params = type ? `?${new URLSearchParams({ type }).toString()}` : "";
  const id = encodeURIComponent(jobId);
  return apiFetch<AggregatesResponse | JARAggregatesResponse>(`/analysis/${id}/dashboard/aggregates${params}`, {}, token);
}

export async function getDashboardExceptions(
  jobId: string,
  token?: string,
): Promise<ExceptionsResponse | JARExceptionsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<ExceptionsResponse | JARExceptionsResponse>(`/analysis/${id}/dashboard/exceptions`, {}, token);
}

export async function getDashboardGaps(
  jobId: string,
  token?: string,
): Promise<GapsResponse | JARGapsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<GapsResponse | JARGapsResponse>(`/analysis/${id}/dashboard/gaps`, {}, token);
}

export async function getDashboardThreads(
  jobId: string,
  token?: string,
): Promise<ThreadStatsResponse | JARThreadStatsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<ThreadStatsResponse | JARThreadStatsResponse>(`/analysis/${id}/dashboard/threads`, {}, token);
}

export async function getDashboardFilters(
  jobId: string,
  token?: string,
): Promise<FilterComplexityResponse | JARFilterComplexityResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<FilterComplexityResponse | JARFilterComplexityResponse>(`/analysis/${id}/dashboard/filters`, {}, token);
}

export interface ReportResponse {
  job_id: string;
  format: string;
  content: string;
  generated_at: string;
  skill_used: string;
}

export async function generateReport(
  jobId: string,
  format: string = "html",
  token?: string,
): Promise<ReportResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<ReportResponse>(`/analysis/${id}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  }, token);
}

export async function getWaterfall(
  jobId: string,
  traceId: string,
  token?: string,
): Promise<WaterfallResponse> {
  const jid = encodeURIComponent(jobId);
  const tid = encodeURIComponent(traceId);
  return apiFetch<WaterfallResponse>(`/analysis/${jid}/trace/${tid}/waterfall`, {}, token);
}

export async function searchTransactions(
  jobId: string,
  params: TransactionSearchParams,
  token?: string,
): Promise<TransactionSearchResponse> {
  const id = encodeURIComponent(jobId);
  const searchParams = new URLSearchParams();
  if (params.user) searchParams.set("user", params.user);
  if (params.thread_id) searchParams.set("thread_id", params.thread_id);
  if (params.trace_id) searchParams.set("trace_id", params.trace_id);
  if (params.rpc_id) searchParams.set("rpc_id", params.rpc_id);
  if (params.has_errors !== undefined) searchParams.set("has_errors", String(params.has_errors));
  if (params.min_duration_ms) searchParams.set("min_duration_ms", String(params.min_duration_ms));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  
  const query = searchParams.toString();
  return apiFetch<TransactionSearchResponse>(`/analysis/${id}/transactions${query ? `?${query}` : ""}`, {}, token);
}

export async function getRecentTraces(
  userId: string,
  token?: string,
): Promise<TransactionSummary[]> {
  return apiFetch<TransactionSummary[]>(`/trace/recent?user_id=${encodeURIComponent(userId)}`, {}, token);
}

export async function exportTrace(
  jobId: string,
  traceId: string,
  format: "json" | "csv" = "json",
  token?: string,
): Promise<Blob> {
  const jid = encodeURIComponent(jobId);
  const tid = encodeURIComponent(traceId);
  const headers: Record<string, string> = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    Object.assign(headers, getApiHeaders());
  }
  
  const res = await fetch(`${API_BASE}/analysis/${jid}/trace/${tid}/export?format=${format}`, { headers });
  if (!res.ok) {
    throw new ApiError(res.status, "export_error", "Failed to export trace");
  }
  return res.blob();
}
