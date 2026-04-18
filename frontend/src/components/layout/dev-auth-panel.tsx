'use client'

import { FlaskConical, UserRound } from 'lucide-react'

function shortId(id: string): string {
  if (id.length <= 14) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

/**
 * Shown when the app runs in header-auth mode (Docker / local without Clerk).
 * Explains why there is no sign-in UI and which tenant the API uses.
 */
export function DevAuthPanel() {
  const tenantId =
    process.env.NEXT_PUBLIC_DEV_TENANT_ID ??
    '00000000-0000-0000-0000-000000000001'
  const userId =
    process.env.NEXT_PUBLIC_DEV_USER_ID ??
    '00000000-0000-0000-0000-000000000001'

  return (
    <div
      className="mx-2 mb-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/60 px-3 py-2.5"
      role="region"
      aria-label="Account and environment"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        </span>
        Local development
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        No Clerk sign-in. Requests use dev headers (
        <code className="rounded bg-[var(--color-bg-secondary)] px-1 py-0.5 text-[10px]">
          X-Dev-Tenant-Id
        </code>
        ).
      </p>
      <dl className="mt-2 space-y-1 text-[11px] text-[var(--color-text-tertiary)]">
        <div className="flex gap-1.5">
          <dt className="shrink-0">
            <UserRound className="inline h-3 w-3 align-middle" aria-hidden />{' '}
            User
          </dt>
          <dd className="truncate font-mono" title={userId}>
            {shortId(userId)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0">Tenant</dt>
          <dd className="truncate font-mono" title={tenantId}>
            {shortId(tenantId)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
