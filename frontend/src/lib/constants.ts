import type { LogType, JobStatus } from './api-types'

// Re-export so consumers can import from a single constants module
export type { LogType, JobStatus }

// ---------------------------------------------------------------------------
// Route paths
// ---------------------------------------------------------------------------

export const ROUTES = {
  HOME: '/',
  UPLOAD: '/upload',
  ANALYSIS: '/analysis',
  ANALYSIS_DETAIL: (id: string) => `/analysis/${id}`,
  ANALYSIS_EXPLORER: (id: string) => `/analysis/${id}/explorer`,
  ANALYSIS_TRACE: (id: string, traceId: string) => `/analysis/${id}/trace/${traceId}`,
  EXPLORER: '/explorer',
  TRACE: '/trace',
  AI: '/ai',
} as const

// ---------------------------------------------------------------------------
// Log type display configuration
// ---------------------------------------------------------------------------

export interface LogTypeConfig {
  bg: string
  text: string
  label: string
  description: string
}

export const LOG_TYPE_COLORS: Record<LogType, LogTypeConfig> = {
  API: {
    bg: 'var(--color-primary)',
    text: 'white',
    label: 'API',
    description: 'AR Server API calls',
  },
  SQL: {
    bg: 'var(--color-success)',
    text: 'white',
    label: 'SQL',
    description: 'Database SQL queries',
  },
  FLTR: {
    bg: 'var(--color-warning)',
    text: 'black',
    label: 'FLTR',
    description: 'AR System filter executions',
  },
  ESCL: {
    bg: 'var(--color-escalation)',
    text: 'white',
    label: 'ESCL',
    description: 'Escalation daemon entries',
  },
} as const

// ---------------------------------------------------------------------------
// Log level configuration
// ---------------------------------------------------------------------------

export type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG'

export interface LogLevelConfig {
  color: string
  bgColor: string
  label: string
  priority: number
}

export const LOG_LEVEL_CONFIG: Record<LogLevel, LogLevelConfig> = {
  ERROR: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-light)',
    label: 'ERROR',
    priority: 0,
  },
  WARNING: {
    color: 'var(--color-warning)',
    bgColor: 'var(--color-warning-light)',
    label: 'WARNING',
    priority: 1,
  },
  INFO: {
    color: 'var(--color-info)',
    bgColor: 'var(--color-info-light)',
    label: 'INFO',
    priority: 2,
  },
  DEBUG: {
    color: 'var(--color-debug)',
    bgColor: 'var(--color-debug-light)',
    label: 'DEBUG',
    priority: 3,
  },
} as const

// ---------------------------------------------------------------------------
// Job status configuration
// Matches JobStatus from api-types: queued | parsing | analyzing | storing | complete | failed
// ---------------------------------------------------------------------------

export interface JobStatusConfig {
  color: string
  bgColor: string
  label: string
  description: string
}

export const JOB_STATUS_CONFIG: Record<JobStatus, JobStatusConfig> = {
  queued: {
    color: 'var(--color-info)',
    bgColor: 'var(--color-info-light)',
    label: 'Queued',
    description: 'In the processing queue',
  },
  parsing: {
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-light)',
    label: 'Parsing',
    description: 'Parsing log file',
  },
  analyzing: {
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-light)',
    label: 'Analyzing',
    description: 'Running analysis',
  },
  storing: {
    color: 'var(--color-primary)',
    bgColor: 'var(--color-primary-light)',
    label: 'Storing',
    description: 'Persisting results',
  },
  complete: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-light)',
    label: 'Complete',
    description: 'Analysis complete',
  },
  failed: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-light)',
    label: 'Failed',
    description: 'Analysis encountered an error',
  },
} as const

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

export interface KeyboardShortcut {
  key: string
  meta: boolean
  shift?: boolean
  label: string
  description: string
}

export const KEYBOARD_SHORTCUTS = {
  COMMAND_PALETTE: {
    key: 'k',
    meta: true,
    shift: false,
    label: '⌘K',
    description: 'Open command palette',
  },
  ESCAPE: {
    key: 'Escape',
    meta: false,
    shift: false,
    label: 'Esc',
    description: 'Close / dismiss',
  },
  SEARCH: {
    key: '/',
    meta: false,
    shift: false,
    label: '/',
    description: 'Focus search',
  },
  UPLOAD: {
    key: 'u',
    meta: true,
    shift: false,
    label: '⌘U',
    description: 'Upload log file',
  },
  AI_ASSISTANT: {
    key: 'j',
    meta: true,
    shift: false,
    label: '⌘J',
    description: 'Open AI assistant',
  },
} as const satisfies Record<string, KeyboardShortcut>

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const API_ROUTES = {
  JOBS: '/api/v1/jobs',
  JOB: (id: string) => `/api/v1/jobs/${id}`,
  JOB_LOGS: (id: string) => `/api/v1/jobs/${id}/logs`,
  JOB_SUMMARY: (id: string) => `/api/v1/jobs/${id}/summary`,
  UPLOAD: '/api/v1/upload',
  EXPLORER: '/api/v1/logs',
  TRACES: '/api/v1/traces',
  TRACE: (id: string) => `/api/v1/traces/${id}`,
  AI_CONVERSATIONS: '/api/v1/ai/conversations',
  AI_CONVERSATION: (id: string) => `/api/v1/ai/conversations/${id}`,
  AI_STREAM: (id: string) => `/api/v1/ai/conversations/${id}/stream`,
} as const

// ---------------------------------------------------------------------------
// AR API code mapping — human-readable names for cryptic API codes
// ---------------------------------------------------------------------------

export const AR_API_CODES: Record<string, { name: string; description: string }> = {
  SE: { name: 'Set Entry', description: 'Update an existing record' },
  CE: { name: 'Create Entry', description: 'Create a new record' },
  DE: { name: 'Delete Entry', description: 'Delete a record' },
  GE: { name: 'Get Entry', description: 'Retrieve a single record' },
  GLEWF: { name: 'Get List (Fields)', description: 'Query records with specific fields' },
  GLE: { name: 'Get List Entry', description: 'Query multiple records' },
  GLS: { name: 'Get List Schema', description: 'List available schemas' },
  GSI: { name: 'Get Server Info', description: 'Retrieve server information' },
  ME: { name: 'Merge Entry', description: 'Merge/upsert a record' },
  SGE: { name: 'Set/Get Entry', description: 'Update and retrieve in one call' },
  SSI: { name: 'Set Server Info', description: 'Update server settings' },
  EXEC: { name: 'Execute Process', description: 'Run a server-side process' },
  GS: { name: 'Get Schema', description: 'Retrieve form schema' },
  GSF: { name: 'Get Field', description: 'Retrieve field definition' },
  GLSF: { name: 'Get List Fields', description: 'List field definitions' },
  IS: { name: 'Import Schema', description: 'Import form definition' },
  ES: { name: 'Export Schema', description: 'Export form definition' },
  BGE: { name: 'Begin Guide', description: 'Start a guided transaction' },
  EGE: { name: 'End Guide', description: 'End a guided transaction' },
  BGTX: { name: 'Begin Transaction', description: 'Start a bulk transaction' },
  EGTX: { name: 'End Transaction', description: 'Commit a bulk transaction' },
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 50
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

// ---------------------------------------------------------------------------
// Health score thresholds
// ---------------------------------------------------------------------------

export const HEALTH_SCORE_THRESHOLDS = {
  GOOD: 80,
  WARNING: 60,
  CRITICAL: 0,
} as const

export type HealthScoreLevel = 'good' | 'warning' | 'critical'

export function getHealthScoreLevel(score: number): HealthScoreLevel {
  if (score >= HEALTH_SCORE_THRESHOLDS.GOOD) return 'good'
  if (score >= HEALTH_SCORE_THRESHOLDS.WARNING) return 'warning'
  return 'critical'
}
