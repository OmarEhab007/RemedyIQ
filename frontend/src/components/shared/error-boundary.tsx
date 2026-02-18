import React, { Component, type ErrorInfo, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Optional custom fallback. Receives the caught error and a reset function.
   * If omitted, the default error UI is rendered.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called when an error is caught, in addition to console.error. */
  onError?: (error: Error, info: ErrorInfo) => void
}

// ---------------------------------------------------------------------------
// Default fallback UI
// ---------------------------------------------------------------------------

interface DefaultFallbackProps {
  error: Error
  onReset: () => void
}

function DefaultFallback({ error, onReset }: DefaultFallbackProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950"
    >
      {/* Icon */}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-red-600 dark:text-red-400"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {/* Message */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-red-800 dark:text-red-200">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-red-600 dark:text-red-400">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600"
      >
        Try Again
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error Boundary class component
//
// React error boundaries must be class components — hooks cannot catch render
// errors. Use this at page or section boundaries to isolate failures.
//
// Usage:
//   <ErrorBoundary>
//     <SomeComponent />
//   </ErrorBoundary>
//
//   <ErrorBoundary fallback={(err, reset) => <MyCustomUI error={err} onReset={reset} />}>
//     <SomeComponent />
//   </ErrorBoundary>
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught unhandled error:', error, info)
    this.props.onError?.(error, info)
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (!hasError || !error) return children

    if (fallback) {
      return fallback(error, this.handleReset)
    }

    return <DefaultFallback error={error} onReset={this.handleReset} />
  }
}
