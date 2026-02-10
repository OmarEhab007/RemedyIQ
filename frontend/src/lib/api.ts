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
  }

  // In development, use dev bypass headers if no token.
  if (!token && process.env.NODE_ENV === "development") {
    headers["X-Dev-User-ID"] = "dev-user";
    headers["X-Dev-Tenant-ID"] = "dev-tenant";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ code: "unknown", message: res.statusText }));
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
