import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

/**
 * Custom render function that wraps components with common providers
 *
 * Usage:
 * ```tsx
 * import { renderWithProviders } from '@/test-utils'
 *
 * it('should render', () => {
 *   renderWithProviders(<MyComponent />)
 * })
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add common providers here as needed
  // For example: ClerkProvider, QueryClientProvider, etc.
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

/**
 * Mock data generators for testing
 */
export const mockData = {
  /**
   * Generate mock log entry
   */
  logEntry: (overrides = {}) => ({
    id: '1',
    timestamp: '2026-02-12T10:00:00Z',
    level: 'INFO',
    message: 'Test log message',
    thread: 'main',
    logger: 'com.example.App',
    ...overrides,
  }),

  /**
   * Generate mock log entries array
   */
  logEntries: (count: number = 10) =>
    Array.from({ length: count }, (_, i) =>
      mockData.logEntry({
        id: String(i + 1),
        message: `Log entry ${i + 1}`,
      })
    ),

  /**
   * Generate mock chart data
   */
  chartData: (count: number = 10) =>
    Array.from({ length: count }, (_, i) => ({
      name: `Point ${i}`,
      value: Math.floor(Math.random() * 100),
    })),

  /**
   * Generate mock statistics
   */
  statistics: (overrides = {}) => ({
    totalLogs: 1000,
    errorCount: 50,
    warningCount: 150,
    infoCount: 800,
    timeRange: {
      start: '2026-02-12T00:00:00Z',
      end: '2026-02-12T23:59:59Z',
    },
    ...overrides,
  }),

  /**
   * Generate mock analysis result
   */
  analysisResult: (overrides = {}) => ({
    id: '1',
    status: 'completed',
    summary: 'Analysis completed successfully',
    insights: ['Insight 1', 'Insight 2'],
    recommendations: ['Recommendation 1', 'Recommendation 2'],
    ...overrides,
  }),
}

/**
 * Common test helpers
 */
export const testHelpers = {
  /**
   * Wait for a specific amount of time
   */
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Create a mock API response
   */
  mockApiResponse: <T,>(data: T, options = {}) => ({
    ok: true,
    status: 200,
    json: async () => data,
    ...options,
  }),

  /**
   * Create a mock API error response
   */
  mockApiError: (message: string, status: number = 500) => ({
    ok: false,
    status,
    json: async () => ({ error: message }),
  }),

  /**
   * Suppress console errors during tests
   * Useful when testing error boundaries
   */
  suppressConsoleError: (callback: () => void | Promise<void>) => {
    const originalError = console.error
    console.error = () => {}
    try {
      return callback()
    } finally {
      console.error = originalError
    }
  },
}

/**
 * Re-export everything from @testing-library/react
 */
export * from '@testing-library/react'

/**
 * Re-export user-event with a simpler name
 */
export { default as userEvent } from '@testing-library/user-event'
