'use client'

import dynamic from 'next/dynamic'

import { isHeaderAuthMode } from '@/lib/auth-mode'

import { DevAuthPanel } from './dev-auth-panel'

const ClerkSidebarAccount = dynamic(
  () =>
    import('./clerk-sidebar-account').then((m) => m.ClerkSidebarAccount),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-2 mb-1 h-10 animate-pulse rounded-md bg-[var(--color-bg-tertiary)]"
        aria-hidden
      />
    ),
  }
)

export function SidebarAccount() {
  if (isHeaderAuthMode()) {
    return <DevAuthPanel />
  }
  return <ClerkSidebarAccount />
}
