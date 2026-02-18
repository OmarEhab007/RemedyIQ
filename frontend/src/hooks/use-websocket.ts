'use client'

/**
 * use-websocket.ts — WebSocket connection management hooks for RemedyIQ.
 *
 * Usage:
 *   // App-level: connect once and share subscription helpers
 *   const { subscribeToJob, unsubscribeFromJob } = useWebSocket()
 *
 *   // Component-level: track a specific job
 *   const { progress, status, isComplete } = useJobProgress(jobId)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  RemedyWebSocket,
  type ConnectionStatus,
  type JobProgressPayload,
} from '@/lib/websocket'
import { getAnalysis } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobProgressState {
  progress: number       // 0–100
  status: string         // e.g. 'parsing', 'analyzing', 'complete', 'error'
  message: string        // human-readable status message
  isComplete: boolean
  error: string | null
}

export interface WebSocketHook {
  connectionStatus: ConnectionStatus
  subscribeToJob: (jobId: string) => void
  unsubscribeFromJob: (jobId: string) => void
}

// ---------------------------------------------------------------------------
// WebSocket singleton reference (module-level, shared across hook instances)
// ---------------------------------------------------------------------------

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/** Stable no-op token getter for dev mode (same reference across renders). */
const DEV_GET_TOKEN = () => Promise.resolve(null as string | null)

function useGetToken() {
  if (IS_DEV_MODE) {
    return DEV_GET_TOKEN
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { getToken } = useAuth()
  return getToken
}

let _wsInstance: RemedyWebSocket | null = null

// ---------------------------------------------------------------------------
// useWebSocket
// ---------------------------------------------------------------------------

/**
 * Manages the WebSocket connection lifecycle.
 * Connects on mount using the Clerk auth token, disconnects on unmount.
 * Safe to call from multiple components — uses a module-level singleton.
 */
export function useWebSocket(): WebSocketHook {
  const getToken = useGetToken()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<RemedyWebSocket | null>(null)

  useEffect(() => {
    let cancelled = false

    async function connect() {
      setConnectionStatus('connecting')

      try {
        const token = await getToken()

        const ws = new RemedyWebSocket(undefined, token ?? undefined)

        // Listen for status changes
        ws.on<ConnectionStatus>('__status__', (status) => {
          if (!cancelled) {
            setConnectionStatus(status)
            if (status === 'connected') {
              _wsInstance = ws
            } else if (status === 'disconnected') {
              _wsInstance = null
            }
          }
        })

        // Listen for errors
        ws.on('__error__', () => {
          if (!cancelled) {
            setConnectionStatus('disconnected')
          }
        })

        wsRef.current = ws
        ws.connect()
      } catch {
        if (!cancelled) {
          setConnectionStatus('disconnected')
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.disconnect()
        wsRef.current = null
        _wsInstance = null
        setConnectionStatus('disconnected')
      }
    }
  }, [getToken])

  const subscribeToJob = useCallback((jobId: string) => {
    const ws = wsRef.current ?? _wsInstance
    if (ws) {
      ws.subscribeToJobProgress(jobId)
    }
  }, [])

  const unsubscribeFromJob = useCallback((jobId: string) => {
    const ws = wsRef.current ?? _wsInstance
    if (ws) {
      ws.unsubscribeFromJobProgress(jobId)
    }
  }, [])

  return {
    connectionStatus,
    subscribeToJob,
    unsubscribeFromJob,
  }
}

// ---------------------------------------------------------------------------
// useJobProgress
// ---------------------------------------------------------------------------

const initialProgressState: JobProgressState = {
  progress: 0,
  status: 'pending',
  message: '',
  isComplete: false,
  error: null,
}

/**
 * Subscribes to a specific job's progress updates via WebSocket.
 *
 * - Auto-subscribes when `jobId` is provided.
 * - Auto-unsubscribes on unmount or when `jobId` changes.
 * - Connects to the WebSocket using the authenticated user's token.
 */
/** Terminal statuses that stop polling. */
const TERMINAL_STATUSES = new Set(['complete', 'failed'])

export function useJobProgress(jobId: string | null): JobProgressState {
  const getToken = useGetToken()
  const [state, setState] = useState<JobProgressState>(initialProgressState)
  const wsRef = useRef<RemedyWebSocket | null>(null)

  useEffect(() => {
    if (!jobId) {
      setState(initialProgressState)
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let unsubProgress: (() => void) | null = null
    let unsubComplete: (() => void) | null = null
    let unsubError: (() => void) | null = null

    // -----------------------------------------------------------------------
    // Polling fallback — fetches job state from REST API
    // Catches jobs that finish before the WebSocket subscription is ready.
    // -----------------------------------------------------------------------
    let isTerminal = false

    async function pollJobState(token: string | null) {
      if (cancelled || isTerminal) return
      try {
        const job = await getAnalysis(jobId!, token ?? undefined)
        if (cancelled) return

        const isFailed = job.status === 'failed'
        const isDone = job.status === 'complete'

        if (isFailed || isDone || TERMINAL_STATUSES.has(job.status)) {
          isTerminal = true
          setState({
            progress: isDone ? 100 : job.progress_pct,
            status: job.status,
            message: isFailed
              ? (job.error_message ?? 'Analysis failed')
              : isDone
              ? 'Analysis complete'
              : `${job.status} (${job.progress_pct}%)`,
            isComplete: isDone,
            error: job.error_message ?? null,
          })
        } else {
          // Update with latest progress from server
          setState({
            progress: job.progress_pct,
            status: job.status,
            message: `${job.status} (${job.progress_pct}%)`,
            isComplete: false,
            error: null,
          })
          // Schedule next poll
          pollTimer = setTimeout(() => void pollJobState(token), 3_000)
        }
      } catch {
        // Poll failed — retry after delay
        if (!cancelled) {
          pollTimer = setTimeout(() => void pollJobState(token), 5_000)
        }
      }
    }

    async function connect() {
      try {
        const token = await getToken()

        // Only attach WebSocket listeners if the singleton already exists.
        // We do NOT create a new WebSocket here — the dashboard layout's
        // useWebSocket() hook manages the singleton. If it's not available,
        // we rely entirely on the polling fallback.
        const ws = _wsInstance
        if (ws) {
          unsubProgress = ws.on<JobProgressPayload>('job_progress', (payload) => {
            if (cancelled || payload.job_id !== jobId) return

            isTerminal = false
            setState({
              progress: payload.progress_pct,
              status: payload.status,
              message: `${payload.status} (${payload.progress_pct}%)`,
              isComplete: payload.status === 'complete',
              error: payload.error_message ?? null,
            })
          })

          unsubComplete = ws.on<JobProgressPayload>('job_complete', (payload) => {
            if (cancelled || payload.job_id !== jobId) return

            isTerminal = true
            const isFailed = payload.status === 'failed'
            setState({
              progress: isFailed ? payload.progress_pct : 100,
              status: payload.status,
              message: isFailed ? (payload.error_message ?? 'Analysis failed') : 'Analysis complete',
              isComplete: !isFailed,
              error: payload.error_message ?? null,
            })
          })

          unsubError = ws.on('__error__', () => {
            if (!cancelled) {
              setState((prev) => ({
                ...prev,
                error: 'WebSocket connection error',
              }))
            }
          })

          wsRef.current = ws
          ws.subscribeToJobProgress(jobId!)
        }

        // Always start polling — catches fast-finishing jobs and works
        // even when WebSocket is unavailable.
        void pollJobState(token)
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Unknown connection error',
          }))
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
      unsubProgress?.()
      unsubComplete?.()
      unsubError?.()
      if (wsRef.current) {
        wsRef.current.unsubscribeFromJobProgress(jobId)
        wsRef.current = null
      }
      setState(initialProgressState)
    }
  }, [jobId, getToken])

  return state
}
