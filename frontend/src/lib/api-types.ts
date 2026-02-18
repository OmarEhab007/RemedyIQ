/**
 * API Types — mirrors Go backend domain models (backend/internal/domain/models.go).
 * All field names use snake_case to match Go JSON tags.
 *
 * @module api-types
 */

// ---------------------------------------------------------------------------
// Primitive / shared enums
// ---------------------------------------------------------------------------

/** The four AR Server log types supported by the analyzer. */
export type LogType = "API" | "SQL" | "FLTR" | "ESCL";

/** Lifecycle states of an analysis job. */
export type JobStatus =
  | "queued"
  | "parsing"
  | "analyzing"
  | "storing"
  | "complete"
  | "failed";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export interface LogFile {
  id: string;
  filename: string;
  size_bytes: number;
  detected_types: LogType[];
  uploaded_at: string;
  tenant_id: string;
  uploader_id: string;
  storage_key: string;
  checksum: string;
}

export interface ListFilesResponse {
  files: LogFile[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Analysis jobs
// ---------------------------------------------------------------------------

export interface AnalysisJob {
  id: string;
  tenant_id: string;
  status: JobStatus;
  file_id: string;
  progress_pct: number;
  processed_lines: number;
  jar_flags?: Record<string, unknown>;
  jvm_heap_mb?: number;
  timeout_seconds?: number;
  // Per-type counts — available on some responses (e.g. list with stats)
  api_count?: number;
  sql_count?: number;
  filter_count?: number;
  esc_count?: number;
  log_start?: string | null;
  log_end?: string | null;
  log_duration?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
  completed_at: string | null;
  flags?: Record<string, string> | null;
}

export interface CreateAnalysisRequest {
  file_id: string;
  flags?: Record<string, string>;
}

export interface ListAnalysesResponse {
  jobs: AnalysisJob[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Dashboard — general statistics
// ---------------------------------------------------------------------------

export interface GeneralStatistics {
  total_lines: number;
  api_count: number;
  sql_count: number;
  filter_count: number;
  esc_count: number;
  unique_users: number;
  unique_forms: number;
  unique_tables: number;
  log_start: string | null;
  log_end: string | null;
  log_duration: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard — health score
// ---------------------------------------------------------------------------

export type HealthSeverity = "ok" | "warning" | "critical";

export interface HealthScoreFactor {
  name: string;
  score: number;
  max_score: number;
  weight: number;
  description: string;
  severity: HealthSeverity;
}

export interface HealthScore {
  score: number;
  status: HealthSeverity;
  factors: HealthScoreFactor[];
}

// ---------------------------------------------------------------------------
// Dashboard — top-N entries
// ---------------------------------------------------------------------------

export interface TopNEntry {
  rank: number;
  line_number: number;
  file_number?: number;
  timestamp: string;
  trace_id: string;
  rpc_id: string;
  queue: string;
  identifier: string;
  form: string;
  user: string;
  duration_ms: number;
  queue_time_ms?: number;
  success: boolean;
  details: string;
}

// ---------------------------------------------------------------------------
// Dashboard — time series
// ---------------------------------------------------------------------------

export interface TimeSeriesPoint {
  timestamp: string;
  api_count: number;
  sql_count: number;
  filter_count: number;
  esc_count: number;
  avg_duration_ms: number;
  error_count: number;
}

// ---------------------------------------------------------------------------
// Dashboard — distribution
// ---------------------------------------------------------------------------

export interface DistributionBucket {
  label: string;
  count: number;
  percentage: number;
}

/**
 * Distribution data as returned by the backend.
 * Each field is a map of label → count.
 */
export interface Distribution {
  by_type?: Record<string, number>;
  by_form?: Record<string, number>;
  by_queue?: Record<string, number>;
  by_table?: Record<string, number>;
  // Legacy / computed fields (generated client-side)
  log_type?: DistributionBucket[];
  duration_buckets?: DistributionBucket[];
  error_rate?: number;
}

// ---------------------------------------------------------------------------
// Dashboard — aggregated response
// ---------------------------------------------------------------------------

export interface DashboardData {
  general_stats: GeneralStatistics;
  top_api_calls: TopNEntry[];
  top_sql_statements: TopNEntry[];
  top_filters: TopNEntry[];
  top_escalations: TopNEntry[];
  time_series: TimeSeriesPoint[];
  distribution: Distribution;
  health_score: HealthScore;
}

// ---------------------------------------------------------------------------
// Aggregates (JAR-native and normalized)
// ---------------------------------------------------------------------------

export interface AggregateRow {
  label: string;
  values: (string | number | null)[];
}

export interface AggregateGroup {
  name: string;
  headers: string[];
  rows: AggregateRow[];
}

export interface AggregateSection {
  title: string;
  groups: AggregateGroup[];
}

export interface AggregatesResponse {
  job_id: string;
  sections: AggregateSection[];
}

// JAR-native aggregate types
export interface JARAggregateRow {
  cells: string[];
}

export interface JARAggregateGroup {
  headers: string[];
  rows: JARAggregateRow[];
}

export interface JARAggregateTable {
  title: string;
  groups: JARAggregateGroup[];
}

export interface JARAggregatesResponse {
  job_id: string;
  tables: JARAggregateTable[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export interface ExceptionEntry {
  line_number: number;
  timestamp: string;
  trace_id: string;
  rpc_id: string;
  thread_id: string;
  queue: string;
  user: string;
  log_type: LogType;
  message: string;
  stack_trace: string | null;
  form: string | null;
  duration_ms: number | null;
}

export interface ExceptionsResponse {
  job_id: string;
  exceptions: ExceptionEntry[];
  total: number;
}

// JAR-native exception types
export interface JARAPIError {
  line_number: number;
  timestamp: string;
  trace_id: string;
  error_code: string;
  message: string;
}

export interface JARExceptionEntry {
  line_number: number;
  timestamp: string;
  exception_class: string;
  message: string;
  stack_frames: string[];
}

export interface JARExceptionsResponse {
  job_id: string;
  api_errors: JARAPIError[];
  exceptions: JARExceptionEntry[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

export interface GapEntry {
  start_time: string;
  end_time: string;
  duration_ms: number;
  before_line: number;
  after_line: number;
  description: string;
}

export interface QueueHealthSummary {
  queue: string;
  total_requests: number;
  error_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  gap_count: number;
}

export interface GapsResponse {
  job_id: string;
  gaps: GapEntry[];
  queue_health: QueueHealthSummary[];
  total_gaps: number;
}

// JAR-native gaps response
export interface JARGapsResponse {
  job_id: string;
  gaps: GapEntry[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Thread statistics
// ---------------------------------------------------------------------------

export interface ThreadStatsEntry {
  thread_id: string;
  queue: string;
  total_requests: number;
  error_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  min_duration_ms: number;
  total_duration_ms: number;
  unique_users: number;
  unique_forms: number;
}

export interface ThreadStatsResponse {
  job_id: string;
  thread_stats: ThreadStatsEntry[];
  total_threads: number;
}

// JAR-native thread stats
export interface JARThreadStat {
  thread_id: string;
  request_count: number;
  total_time_ms: number;
  avg_time_ms: number;
  max_time_ms: number;
}

export interface JARThreadStatsResponse {
  job_id: string;
  stats: JARThreadStat[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Filter complexity
// ---------------------------------------------------------------------------

export interface MostExecutedFilter {
  filter_name: string;
  execution_count: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  total_duration_ms: number;
  error_count: number;
  form: string | null;
}

export interface FilterPerTransaction {
  trace_id: string;
  rpc_id: string;
  timestamp: string;
  filter_count: number;
  total_filter_duration_ms: number;
  user: string;
  queue: string;
}

export interface FilterComplexityResponse {
  job_id: string;
  most_executed: MostExecutedFilter[];
  filters_per_transaction: FilterPerTransaction[];
  avg_filters_per_transaction: number;
  max_filters_per_transaction: number;
}

// JAR-native filter complexity types
export interface JARFilterLevel {
  level: number;
  filter_name: string;
  duration_ms: number;
}

export interface JARFilterExecutedPerTxn {
  trace_id: string;
  count: number;
  levels: JARFilterLevel[];
}

export interface JARFilterMostExecuted {
  filter_name: string;
  count: number;
  avg_duration_ms: number;
}

export interface JARFilterPerTransaction {
  trace_id: string;
  filter_count: number;
}

export interface JARFilterComplexityResponse {
  job_id: string;
  most_executed: JARFilterMostExecuted[];
  per_transaction: JARFilterExecutedPerTxn[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Log entries
// ---------------------------------------------------------------------------

export interface LogEntry {
  tenant_id: string;
  job_id: string;
  entry_id: string;
  line_number: number;
  timestamp: string;
  log_type: LogType;
  trace_id: string;
  rpc_id: string;
  thread_id: string;
  queue: string;
  user: string;
  duration_ms: number | null;
  success: boolean | null;
  form: string | null;
  sql_table: string | null;
  filter_name: string | null;
  esc_name: string | null;
  raw_text: string;
  error_message: string | null;
}

export interface LogEntryContext {
  before: LogEntry[];
  entry: LogEntry;
  after: LogEntry[];
}

export interface SearchLogsParams {
  q?: string;
  log_type?: string;
  user?: string;
  form?: string;
  queue?: string;
  min_duration?: number;
  max_duration?: number;
  error_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchLogsResponse {
  entries: LogEntry[];
  total: number;
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Trace / waterfall
// ---------------------------------------------------------------------------

export interface SpanFields {
  [key: string]: string | number | boolean | null;
}

export interface SpanNode {
  id: string;
  parent_id: string | null;
  depth: number;
  log_type: LogType;
  start_offset_ms: number;
  duration_ms: number;
  fields: SpanFields;
  children: SpanNode[];
  on_critical_path: boolean;
  has_error: boolean;
  timestamp: string;
  thread_id: string;
  trace_id: string;
  user: string;
  queue: string;
  form: string | null;
  operation: string;
  success: boolean;
  error_message: string | null;
}

export interface TypeBreakdown {
  api_count: number;
  sql_count: number;
  filter_count: number;
  esc_count: number;
}

export interface WaterfallResponse {
  trace_id: string;
  total_duration_ms: number;
  span_count: number;
  error_count: number;
  type_breakdown: TypeBreakdown;
  spans: SpanNode[];
  flat_spans: SpanNode[];
  critical_path: string[];
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TransactionSummary {
  trace_id: string;
  rpc_id: string;
  thread_id: string;
  queue: string;
  user: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  span_count: number;
  error_count: number;
  has_errors: boolean;
  log_types: LogType[];
  form: string | null;
}

export interface TransactionSearchParams {
  user?: string;
  thread_id?: string;
  trace_id?: string;
  rpc_id?: string;
  has_errors?: boolean;
  min_duration_ms?: number;
  max_duration_ms?: number;
  limit?: number;
  offset?: number;
}

export interface TransactionSearchResponse {
  transactions: TransactionSummary[];
  total: number;
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportFormat = "html" | "pdf" | "json";

export interface ReportResponse {
  job_id: string;
  format: ReportFormat;
  content: string;
  generated_at: string;
  skill_used: string;
}

// ---------------------------------------------------------------------------
// AI — conversations and messages
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  skill_name: string | null;
  follow_ups: string[];
  tokens_used: number | null;
  latency_ms: number | null;
  status: MessageStatus;
  error_message: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages: Message[];
}

export interface ListConversationsResponse {
  conversations: Conversation[];
  pagination: Pagination;
}

export interface CreateConversationRequest {
  job_id?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// AI — skills
// ---------------------------------------------------------------------------

export interface AISkill {
  name: string;
  display_name: string;
  description: string;
  icon: string;
}

export interface ListSkillsResponse {
  skills: AISkill[];
}

// ---------------------------------------------------------------------------
// AI — streaming events (SSE)
// ---------------------------------------------------------------------------

export interface AIStreamEvent {
  type: "token" | "done" | "error" | "follow_ups" | "start" | "skill" | "metadata";
  content?: string;
  follow_ups?: string[];
  error?: string;
  /** Populated on "start" events */
  conversation_id?: string;
  message_id?: string;
  /** Populated on "skill" / "metadata" events */
  skill_name?: string;
  tokens_used?: number;
  latency_ms?: number;
}

// ---------------------------------------------------------------------------
// AI — non-streaming query response
// ---------------------------------------------------------------------------

export interface AIQueryRequest {
  job_id: string;
  question: string;
  skill?: string;
}

export interface AIQueryResponse {
  message: Message;
  conversation_id: string;
}

// ---------------------------------------------------------------------------
// AI — trace analysis
// ---------------------------------------------------------------------------

export interface TraceAIAnalyzeRequest {
  trace_id: string;
  question: string;
}

export interface TraceAIAnalyzeResponse {
  analysis: string;
  follow_ups: string[];
  skill_used: string;
}

// ---------------------------------------------------------------------------
// Search — autocomplete
// ---------------------------------------------------------------------------

export interface AutocompleteSuggestion {
  value: string;
  count: number;
}

export interface AutocompleteResponse {
  field: string;
  suggestions: AutocompleteSuggestion[];
}

// ---------------------------------------------------------------------------
// Search — saved searches
// ---------------------------------------------------------------------------

export interface SavedSearch {
  id: string;
  name: string;
  kql_query: string;
  filters: Record<string, string>;
  is_pinned: boolean;
  created_at: string;
}

export interface ListSavedSearchesResponse {
  saved_searches: SavedSearch[];
}

export interface CreateSavedSearchRequest {
  name: string;
  kql_query: string;
  filters?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Search — history
// ---------------------------------------------------------------------------

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters: Record<string, string>;
  created_at: string;
  result_count: number;
}

export interface SearchHistoryResponse {
  history: SearchHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Trace — recent
// ---------------------------------------------------------------------------

export interface RecentTrace {
  trace_id: string;
  job_id: string;
  user: string;
  queue: string;
  duration_ms: number;
  error_count: number;
  span_count: number;
  timestamp: string;
}

export interface RecentTracesResponse {
  traces: RecentTrace[];
}

// ---------------------------------------------------------------------------
// AI stream request body (POST /ai/stream)
// ---------------------------------------------------------------------------

export interface AIStreamRequest {
  job_id: string;
  conversation_id: string;
  query: string;
  skill?: string;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  services: Record<string, "ok" | "error">;
}
