/**
 * KQL helpers for Log Explorer deep links (must match backend search.ParseKQL).
 */

/**
 * Builds a KQL query that scopes to a trace ID, optionally to failed spans only.
 */
export function buildTraceExplorerQuery(
  traceId: string,
  options?: { errorsOnly?: boolean },
): string {
  const raw = traceId.trim()
  if (!raw) {
    return options?.errorsOnly ? 'status:false' : '*'
  }
  const safe = raw.replace(/"/g, "'")
  const needsQuotes = safe.includes(':') || /\s/.test(safe)
  const traceExpr = needsQuotes ? `trace:"${safe}"` : `trace:${safe}`
  if (options?.errorsOnly) {
    return `${traceExpr} status:false`
  }
  return traceExpr
}

/** Job-scoped explorer URL with initial KQL. */
export function analysisExplorerHref(jobId: string, kql: string): string {
  const q = encodeURIComponent(kql)
  return `/analysis/${jobId}/explorer?q=${q}`
}
