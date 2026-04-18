/**
 * Header-based auth (X-Dev-User-ID / X-Dev-Tenant-Id + optional WS ?token=dev)
 * for local testing without Clerk. Matches layout/middleware skipping Clerk when
 * NEXT_PUBLIC_DEV_MODE is true or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is unset.
 */
export function isHeaderAuthMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
}
