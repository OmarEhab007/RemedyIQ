'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// QueryClientProvider wrapper
//
// Creates a stable QueryClient instance per component tree (using useState
// so each React tree gets its own client — required for RSC + streaming).
// ---------------------------------------------------------------------------

interface QueryProviderProps {
  children: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,          // 1 minute — fresh data window
            gcTime: 300_000,            // 5 minutes — cache retention
            retry: 1,                   // single retry on transient failure
            refetchOnWindowFocus: false, // avoid disruptive background refetches
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
