import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

// ---------------------------------------------------------------------------
// NotFound — rendered by Next.js for any unmatched route (app/not-found.tsx)
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-bg-primary)] px-4 text-center">
      {/* Icon */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
        aria-hidden="true"
      >
        <FileQuestion className="h-10 w-10" />
      </div>

      {/* Copy */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Page Not Found
        </h1>
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>

      {/* Action */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
      >
        Go Home
      </Link>
    </div>
  )
}
