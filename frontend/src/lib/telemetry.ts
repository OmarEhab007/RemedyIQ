export type WorkflowType = 'api' | 'sql' | 'escalation' | 'filter'

export type TelemetryEventName =
  | 'dashboard_render_complete'
  | 'core_workflow_entered'
  | 'core_workflow_complete'
  | 'nav_click'

export type TelemetryPayload = Record<string, string | number | boolean | null | undefined>

/**
 * Minimal client telemetry emitter used for Phase 1 instrumentation.
 * Emits:
 * - browser custom event for local observers/tests
 * - console debug log in development
 */
export function trackEvent(name: TelemetryEventName, payload: TelemetryPayload = {}): void {
  if (typeof window === 'undefined') return

  const event = {
    name,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  window.dispatchEvent(new CustomEvent('remedyiq:telemetry', { detail: event }))

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[telemetry]', event)
  }
}
