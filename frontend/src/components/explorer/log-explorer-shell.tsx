'use client'

/**
 * LogExplorerShell — shared layout chrome for global and job-scoped Log Explorer routes.
 */

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface LogExplorerShellProps {
  /** Primary heading row (title + job controls). */
  header: ReactNode
  /** Search bar, saved searches, export, and related actions. */
  toolbar: ReactNode
  /** Optional secondary row (time range, latency, etc.). */
  accessory?: ReactNode
  /** Timeline chart; omit when there is nothing to chart yet. */
  histogram?: ReactNode
  /** Error banner; omit when healthy. */
  error?: ReactNode
  /** Filter sidebar + table + detail split. */
  children: ReactNode
  className?: string
}

export function LogExplorerShell({
  header,
  toolbar,
  accessory,
  histogram,
  error,
  children,
  className,
}: LogExplorerShellProps) {
  return (
    <div className={cn('flex h-full flex-col gap-3 overflow-hidden', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{header}</div>
      {accessory ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{accessory}</div>
      ) : null}
      <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div>
      {histogram}
      {error}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">{children}</div>
    </div>
  )
}
