import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ---------------------------------------------------------------------------
// Class name merging
// ---------------------------------------------------------------------------

/**
 * Merges Tailwind CSS class names, resolving conflicts with tailwind-merge
 * and supporting conditional classes via clsx.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'hover:bg-blue-600')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_ONLY_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/**
 * Formats a date as a human-readable string.
 *
 * @example
 * formatDate('2024-03-15T14:30:00Z') // "Mar 15, 2024, 02:30 PM"
 * formatDate(new Date())              // "Feb 17, 2026, 09:45 AM"
 */
export function formatDate(date: string | Date, dateOnly = false): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'
  return dateOnly ? DATE_ONLY_FORMAT.format(d) : DATE_FORMAT.format(d)
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @example
 * formatDuration(450)    // "450ms"
 * formatDuration(1234)   // "1.2s"
 * formatDuration(65000)  // "1m 5s"
 * formatDuration(3700000) // "1h 1m"
 */
export function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—'

  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }

  const totalSeconds = ms / 1000

  if (totalSeconds < 60) {
    const s = totalSeconds % 1 === 0 ? totalSeconds.toFixed(0) : totalSeconds.toFixed(1)
    return `${s}s`
  }

  const totalMinutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = Math.floor(totalSeconds % 60)

  if (totalMinutes < 60) {
    return remainingSeconds > 0
      ? `${totalMinutes}m ${remainingSeconds}s`
      : `${totalMinutes}m`
  }

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

// ---------------------------------------------------------------------------
// Byte formatting
// ---------------------------------------------------------------------------

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Formats a byte count as a human-readable size string.
 *
 * @example
 * formatBytes(512)          // "512 B"
 * formatBytes(1536)         // "1.5 KB"
 * formatBytes(1572864)      // "1.5 MB"
 * formatBytes(1073741824)   // "1.0 GB"
 */
export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'

  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1
  )
  const value = bytes / Math.pow(1024, i)
  const formatted = i === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${BYTE_UNITS[i]}`
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

const NUMBER_FORMAT = new Intl.NumberFormat('en-US')

/**
 * Formats a number with locale-appropriate thousand separators.
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(42)      // "42"
 */
export function formatNumber(num: number): string {
  if (!isFinite(num)) return '—'
  return NUMBER_FORMAT.format(num)
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

const RELATIVE_TIME_THRESHOLDS = [
  { limit: 60, divisor: 1, unit: 'second' },
  { limit: 3600, divisor: 60, unit: 'minute' },
  { limit: 86400, divisor: 3600, unit: 'hour' },
  { limit: 604800, divisor: 86400, unit: 'day' },
  { limit: 2592000, divisor: 604800, unit: 'week' },
  { limit: 31536000, divisor: 2592000, unit: 'month' },
] as const

/**
 * Formats a date as a relative time string (e.g. "2h ago", "3 days ago").
 * Falls back to absolute date for dates older than 1 year.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)

  if (diffSec < 0) return 'just now'
  if (diffSec < 10) return 'just now'

  for (const { limit, divisor, unit } of RELATIVE_TIME_THRESHOLDS) {
    if (diffSec < limit) {
      const val = Math.floor(diffSec / divisor)
      return `${val}${unit.charAt(0)} ago`
    }
  }

  return DATE_ONLY_FORMAT.format(d)
}

// ---------------------------------------------------------------------------
// Compact number formatting
// ---------------------------------------------------------------------------

/**
 * Formats a number compactly: 1,234 → "1.2K", 1,234,567 → "1.2M"
 */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// String truncation
// ---------------------------------------------------------------------------

/**
 * Truncates a string to a maximum length, appending an ellipsis if needed.
 *
 * @example
 * truncate('Hello, World!', 8)  // "Hello..."
 * truncate('Short', 10)          // "Short"
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  if (maxLength <= 3) return str.slice(0, maxLength)
  return `${str.slice(0, maxLength - 3)}...`
}
