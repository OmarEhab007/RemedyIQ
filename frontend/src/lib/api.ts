const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

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
  success: boolean;
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
    headers["X-Dev-User-ID"] = "dev-user";
    headers["X-Dev-Tenant-ID"] = "dev-tenant";
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

export async function uploadFile(file: File, token?: string): Promise<LogFile> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<LogFile>("/files/upload", {
    method: "POST",
    body: formData,
  }, token);
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
  return apiFetch<AnalysisJob>(`/analysis/${jobId}`, {}, token);
}

export async function getDashboard(
  jobId: string,
  token?: string,
): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/analysis/${jobId}/dashboard`, {}, token);
}

export async function getDashboardAggregates(
  jobId: string,
  type?: string,
  token?: string,
): Promise<AggregatesResponse> {
  const params = type ? `?${new URLSearchParams({ type }).toString()}` : "";
  const id = encodeURIComponent(jobId);
  return apiFetch<AggregatesResponse>(`/analysis/${id}/dashboard/aggregates${params}`, {}, token);
}

export async function getDashboardExceptions(
  jobId: string,
  token?: string,
): Promise<ExceptionsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<ExceptionsResponse>(`/analysis/${id}/dashboard/exceptions`, {}, token);
}

export async function getDashboardGaps(
  jobId: string,
  token?: string,
): Promise<GapsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<GapsResponse>(`/analysis/${id}/dashboard/gaps`, {}, token);
}

export async function getDashboardThreads(
  jobId: string,
  token?: string,
): Promise<ThreadStatsResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<ThreadStatsResponse>(`/analysis/${id}/dashboard/threads`, {}, token);
}

export async function getDashboardFilters(
  jobId: string,
  token?: string,
): Promise<FilterComplexityResponse> {
  const id = encodeURIComponent(jobId);
  return apiFetch<FilterComplexityResponse>(`/analysis/${id}/dashboard/filters`, {}, token);
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
  return apiFetch<ReportResponse>(`/analysis/${jobId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format }),
  }, token);
}
