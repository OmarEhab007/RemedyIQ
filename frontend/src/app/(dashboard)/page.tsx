'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAnalyses } from '@/hooks/use-api'
import { PageState } from '@/components/ui/page-state'
import { ROUTES } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Root dashboard page
//
// Redirects to /analysis if any jobs exist, otherwise to /upload so the user
// can get started. Shows a loading skeleton while the data is in-flight.
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter()
  const { data: analyses, isLoading, isError } = useAnalyses()

  useEffect(() => {
    if (isLoading) return

    if (isError || !analyses || !analyses.jobs || analyses.jobs.length === 0) {
      router.push(ROUTES.UPLOAD)
    } else {
      router.push(ROUTES.ANALYSIS)
    }
  }, [isLoading, isError, analyses, router])

  if (isError) {
    // Will redirect, but render a fallback in case of render-before-redirect
    return (
      <PageState
        variant="error"
        message="Unable to load analyses. Redirecting to upload..."
      />
    )
  }

  return (
    <PageState variant="loading" rows={5} />
  )
}
