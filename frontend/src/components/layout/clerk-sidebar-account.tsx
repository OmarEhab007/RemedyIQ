'use client'

import { LogIn } from 'lucide-react'
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'

import { cn } from '@/lib/utils'

export function ClerkSidebarAccount() {
  return (
    <div
      className="mx-2 mb-1 space-y-2"
      role="region"
      aria-label="Account"
    >
      <SignedIn>
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 px-2 py-1.5">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Signed in
          </span>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'h-8 w-8',
              },
            }}
          />
        </div>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
              'bg-[var(--color-primary)] text-white hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  )
}
