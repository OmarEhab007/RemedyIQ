'use client'

/**
 * use-api.ts — TanStack React Query v5 hooks for all RemedyIQ API functions.
 *
 * Usage:
 *   const { data, isLoading, error } = useAnalyses()
 *   const { data: job } = useAnalysis(jobId)
 *   const mutation = useCreateAnalysis()
 *   mutation.mutate({ fileId: '...', flags: {} })
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import * as api from '@/lib/api'
import type {
  AnalysisJob,
  ListAnalysesResponse,
  DashboardData,
  AggregatesResponse,
  ExceptionsResponse,
  GapsResponse,
  ThreadStatsResponse,
  FileMetadataResponse,
  FilterComplexityResponse,
  LoggingActivityResponse,
  QueuedCallsResponse,
  DelayedEscalationsResponse,
  SearchLogsParams,
  SearchLogsResponse,
  LogEntry,
  LogEntryContext,
  WaterfallResponse,
  TransactionSearchParams,
  TransactionSearchResponse,
  RecentTracesResponse,
  AutocompleteResponse,
  ListSavedSearchesResponse,
  SavedSearch,
  SearchHistoryResponse,
  AISkill,
  ListConversationsResponse,
  Conversation,
  LogFile,
  ReportFormat,
  ReportResponse,
} from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/** Retrieves the Clerk JWT (production) or returns a no-op in dev mode. */
function useToken() {
  // In dev mode, the API client uses X-Dev-* headers instead of Bearer tokens.
  // Calling useAuth() when Clerk is not configured would throw or hang.
  if (IS_DEV_MODE) {
    return () => Promise.resolve(null as string | null)
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { getToken } = useAuth()
  return getToken
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const queryKeys = {
  analyses: () => ['analyses'] as const,
  analysis: (jobId: string) => ['analyses', jobId] as const,
  dashboard: (jobId: string) => ['dashboard', jobId] as const,
  dashboardAggregates: (jobId: string, type?: string) =>
    ['dashboard', jobId, 'aggregates', type ?? 'all'] as const,
  dashboardExceptions: (jobId: string) =>
    ['dashboard', jobId, 'exceptions'] as const,
  dashboardGaps: (jobId: string) =>
    ['dashboard', jobId, 'gaps'] as const,
  dashboardThreads: (jobId: string) =>
    ['dashboard', jobId, 'threads'] as const,
  dashboardFilters: (jobId: string) =>
    ['dashboard', jobId, 'filters'] as const,
  dashboardQueuedCalls: (jobId: string) =>
    ['dashboard', jobId, 'queued-calls'] as const,
  dashboardDelayedEscalations: (jobId: string) =>
    ['dashboard', jobId, 'delayed-escalations'] as const,
  dashboardLoggingActivity: (jobId: string) =>
    ['dashboard', jobId, 'logging-activity'] as const,
  dashboardFileMetadata: (jobId: string) =>
    ['dashboard', jobId, 'file-metadata'] as const,
  searchLogs: (jobId: string, params: SearchLogsParams) =>
    ['logs', jobId, 'search', params] as const,
  logEntry: (jobId: string, entryId: string) =>
    ['logs', jobId, 'entry', entryId] as const,
  entryContext: (jobId: string, entryId: string) =>
    ['logs', jobId, 'entry', entryId, 'context'] as const,
  waterfall: (jobId: string, traceId: string) =>
    ['trace', jobId, 'waterfall', traceId] as const,
  searchTransactions: (jobId: string, params: TransactionSearchParams) =>
    ['trace', jobId, 'search', params] as const,
  recentTraces: (userId: string) =>
    ['trace', 'recent', userId] as const,
  autocomplete: (field: string, prefix: string, jobId?: string) =>
    ['autocomplete', field, prefix, jobId ?? ''] as const,
  savedSearches: () => ['savedSearches'] as const,
  searchHistory: () => ['searchHistory'] as const,
  aiSkills: () => ['aiSkills'] as const,
  conversations: (jobId?: string) =>
    ['conversations', jobId ?? ''] as const,
  conversation: (conversationId: string) =>
    ['conversations', 'detail', conversationId] as const,
} as const

// ---------------------------------------------------------------------------
// Analysis query hooks
// ---------------------------------------------------------------------------

/** Lists all analysis jobs for the authenticated user. */
export function useAnalyses() {
  const getToken = useToken()
  return useQuery<ListAnalysesResponse>({
    queryKey: queryKeys.analyses(),
    queryFn: async () => {
      const token = await getToken()
      return api.listAnalyses(1, 100, token ?? undefined)
    },
  })
}

/** Fetches a single analysis job by ID. Disabled when jobId is falsy. */
export function useAnalysis(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<AnalysisJob>({
    queryKey: queryKeys.analysis(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getAnalysis(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

// ---------------------------------------------------------------------------
// Dashboard query hooks
// ---------------------------------------------------------------------------

/** Fetches the top-level dashboard data for a job. */
export function useDashboard(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<DashboardData>({
    queryKey: queryKeys.dashboard(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboard(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/**
 * Fetches aggregates section of the dashboard.
 * Pass `enabled` as `false` (the default) until the section is expanded.
 */
export function useDashboardAggregates(
  jobId: string | null | undefined,
  type?: string,
  options?: { enabled?: boolean }
) {
  const getToken = useToken()
  return useQuery<AggregatesResponse>({
    queryKey: queryKeys.dashboardAggregates(jobId ?? '', type),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardAggregates(jobId as string, type, token ?? undefined)
    },
    enabled: Boolean(jobId) && (options?.enabled ?? false),
  })
}

/** Fetches the exceptions section of the dashboard. */
export function useDashboardExceptions(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<ExceptionsResponse>({
    queryKey: queryKeys.dashboardExceptions(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardExceptions(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/** Fetches the gaps section of the dashboard. */
export function useDashboardGaps(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<GapsResponse>({
    queryKey: queryKeys.dashboardGaps(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardGaps(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/** Fetches the threads section of the dashboard. */
export function useDashboardThreads(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<ThreadStatsResponse>({
    queryKey: queryKeys.dashboardThreads(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardThreads(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/** Fetches the filters section of the dashboard. */
export function useDashboardFilters(jobId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<FilterComplexityResponse>({
    queryKey: queryKeys.dashboardFilters(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardFilters(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/** Fetches queued API calls data for the dashboard. */
export function useQueuedCalls(
  jobId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const getToken = useToken()
  return useQuery<QueuedCallsResponse>({
    queryKey: queryKeys.dashboardQueuedCalls(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardQueuedCalls(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && (options?.enabled ?? false),
  })
}

/** Fetches delayed escalations data for the dashboard. */
export function useDelayedEscalations(
  jobId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const getToken = useToken()
  return useQuery<DelayedEscalationsResponse>({
    queryKey: queryKeys.dashboardDelayedEscalations(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardDelayedEscalations(jobId as string, undefined, undefined, token ?? undefined)
    },
    enabled: Boolean(jobId) && (options?.enabled ?? false),
  })
}

/** Fetches logging activity data for the dashboard. */
export function useLoggingActivity(
  jobId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const getToken = useToken()
  return useQuery<LoggingActivityResponse>({
    queryKey: queryKeys.dashboardLoggingActivity(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardLoggingActivity(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && (options?.enabled ?? false),
  })
}

/** Fetches file metadata data for the dashboard. */
export function useFileMetadata(
  jobId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const getToken = useToken()
  return useQuery<FileMetadataResponse>({
    queryKey: queryKeys.dashboardFileMetadata(jobId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getDashboardFileMetadata(jobId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && (options?.enabled ?? false),
  })
}

// ---------------------------------------------------------------------------
// Log Explorer query hooks
// ---------------------------------------------------------------------------

/** Searches log entries for a job. Re-runs when params change. */
export function useSearchLogs(
  jobId: string | null | undefined,
  params: SearchLogsParams
) {
  const getToken = useToken()
  return useQuery<SearchLogsResponse>({
    queryKey: queryKeys.searchLogs(jobId ?? '', params),
    queryFn: async () => {
      const token = await getToken()
      return api.searchLogs(jobId as string, params, token ?? undefined)
    },
    enabled: Boolean(jobId),
    placeholderData: (prev) => prev,
  })
}

/** Fetches a single log entry. Disabled when either ID is falsy. */
export function useLogEntry(
  jobId: string | null | undefined,
  entryId: string | null | undefined
) {
  const getToken = useToken()
  return useQuery<LogEntry>({
    queryKey: queryKeys.logEntry(jobId ?? '', entryId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getLogEntry(jobId as string, entryId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && Boolean(entryId),
  })
}

/** Fetches surrounding log entries (context window) around a specific entry. */
export function useEntryContext(
  jobId: string | null | undefined,
  entryId: string | null | undefined
) {
  const getToken = useToken()
  return useQuery<LogEntryContext>({
    queryKey: queryKeys.entryContext(jobId ?? '', entryId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getEntryContext(jobId as string, entryId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && Boolean(entryId),
  })
}

// ---------------------------------------------------------------------------
// Trace / Waterfall query hooks
// ---------------------------------------------------------------------------

/** Fetches waterfall (span hierarchy) data for a trace. */
export function useWaterfall(
  jobId: string | null | undefined,
  traceId: string | null | undefined
) {
  const getToken = useToken()
  return useQuery<WaterfallResponse>({
    queryKey: queryKeys.waterfall(jobId ?? '', traceId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getWaterfall(jobId as string, traceId as string, token ?? undefined)
    },
    enabled: Boolean(jobId) && Boolean(traceId),
  })
}

/** Searches transactions for a job. */
export function useSearchTransactions(
  jobId: string | null | undefined,
  params: TransactionSearchParams
) {
  const getToken = useToken()
  return useQuery<TransactionSearchResponse>({
    queryKey: queryKeys.searchTransactions(jobId ?? '', params),
    queryFn: async () => {
      const token = await getToken()
      return api.searchTransactions(jobId as string, params, token ?? undefined)
    },
    enabled: Boolean(jobId),
    placeholderData: (prev) => prev,
  })
}

/** Fetches recently viewed traces for a user. */
export function useRecentTraces(userId: string | null | undefined) {
  const getToken = useToken()
  return useQuery<RecentTracesResponse>({
    queryKey: queryKeys.recentTraces(userId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getRecentTraces(userId as string, token ?? undefined)
    },
    enabled: Boolean(userId),
  })
}

// ---------------------------------------------------------------------------
// Search utility hooks
// ---------------------------------------------------------------------------

/**
 * Autocomplete suggestions for a search field.
 * Disabled when prefix is shorter than 1 character.
 */
export function useAutocomplete(
  field: string,
  prefix: string,
  jobId?: string | null
) {
  const getToken = useToken()
  return useQuery<AutocompleteResponse>({
    queryKey: queryKeys.autocomplete(field, prefix, jobId ?? undefined),
    queryFn: async () => {
      const token = await getToken()
      return api.getAutocomplete(field, prefix, jobId ?? undefined, token ?? undefined)
    },
    enabled: prefix.length >= 1,
    staleTime: 30_000,
  })
}

/** Fetches the list of saved searches for the authenticated user. */
export function useSavedSearches() {
  const getToken = useToken()
  return useQuery<ListSavedSearchesResponse>({
    queryKey: queryKeys.savedSearches(),
    queryFn: async () => {
      const token = await getToken()
      return api.listSavedSearches(token ?? undefined)
    },
  })
}

/** Fetches the user's recent search history. */
export function useSearchHistory() {
  const getToken = useToken()
  return useQuery<SearchHistoryResponse>({
    queryKey: queryKeys.searchHistory(),
    queryFn: async () => {
      const token = await getToken()
      return api.getSearchHistory(token ?? undefined)
    },
  })
}

// ---------------------------------------------------------------------------
// AI Assistant query hooks
// ---------------------------------------------------------------------------

/** Fetches the list of available AI skills. */
export function useAISkills() {
  const getToken = useToken()
  return useQuery<AISkill[]>({
    queryKey: queryKeys.aiSkills(),
    queryFn: async () => {
      const token = await getToken()
      return api.listAISkills(token ?? undefined)
    },
    staleTime: 300_000, // skills rarely change — cache for 5 minutes
  })
}

/** Fetches all conversations, optionally scoped to a job. */
export function useConversations(jobId?: string | null) {
  const getToken = useToken()
  return useQuery<ListConversationsResponse>({
    queryKey: queryKeys.conversations(jobId ?? undefined),
    queryFn: async () => {
      const token = await getToken()
      return api.listConversations(jobId ?? undefined, token ?? undefined)
    },
    enabled: Boolean(jobId),
  })
}

/** Fetches a single conversation with its full message history. */
export function useConversation(
  conversationId: string | null | undefined
) {
  const getToken = useToken()
  return useQuery<Conversation>({
    queryKey: queryKeys.conversation(conversationId ?? ''),
    queryFn: async () => {
      const token = await getToken()
      return api.getConversation(conversationId as string, token ?? undefined)
    },
    enabled: Boolean(conversationId),
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Creates a new analysis job and invalidates the analyses list cache. */
export function useCreateAnalysis() {
  const getToken = useToken()
  const queryClient = useQueryClient()
  return useMutation<AnalysisJob, Error, { fileId: string; flags?: Record<string, string> }>({
    mutationFn: async ({ fileId, flags }) => {
      const token = await getToken()
      return api.createAnalysis(fileId, flags, token ?? undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.analyses() })
    },
  })
}

/**
 * Uploads a file to MinIO/S3.
 * Returns the upload mutation — caller can track `mutation.isPending` for
 * progress feedback and `mutation.data` for the resulting file.
 */
export function useUploadFile() {
  const getToken = useToken()
  return useMutation<{ file: LogFile }, Error, { file: File; onProgress?: (pct: number) => void }>({
    mutationFn: async ({ file, onProgress }) => {
      const token = await getToken()
      return api.uploadFile(file, onProgress, token ?? undefined)
    },
  })
}

/** Saves a search query and invalidates the saved searches list cache. */
export function useSaveSearch() {
  const getToken = useToken()
  const queryClient = useQueryClient()
  return useMutation<SavedSearch, Error, { name: string; query: string; filters?: Record<string, string> }>({
    mutationFn: async ({ name, query, filters }) => {
      const token = await getToken()
      return api.createSavedSearch(name, query, filters, token ?? undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches() })
    },
  })
}

/** Deletes a saved search by ID and invalidates the saved searches list cache. */
export function useDeleteSavedSearch() {
  const getToken = useToken()
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (searchId) => {
      const token = await getToken()
      return api.deleteSavedSearch(searchId, token ?? undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches() })
    },
  })
}

/** Creates a new AI conversation and invalidates the conversations list cache. */
export function useCreateConversation() {
  const getToken = useToken()
  const queryClient = useQueryClient()
  return useMutation<Conversation, Error, { jobId?: string; title?: string }>({
    mutationFn: async ({ jobId, title }) => {
      const token = await getToken()
      return api.createConversation(jobId, title, token ?? undefined)
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(variables.jobId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations(),
      })
    },
  })
}

/** Deletes an AI conversation and invalidates the conversations list cache. */
export function useDeleteConversation() {
  const getToken = useToken()
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (conversationId) => {
      const token = await getToken()
      return api.deleteConversation(conversationId, token ?? undefined)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'conversations',
      })
    },
  })
}

/** Triggers report generation for a job. */
export function useGenerateReport() {
  const getToken = useToken()
  return useMutation<ReportResponse, Error, { jobId: string; format?: ReportFormat }>({
    mutationFn: async ({ jobId, format }) => {
      const token = await getToken()
      return api.generateReport(jobId, format, token ?? undefined)
    },
  })
}
