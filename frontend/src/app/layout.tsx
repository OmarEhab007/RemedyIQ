import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import React from 'react'

import { QueryProvider } from '@/providers/query-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import './globals.css'

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default: 'RemedyIQ',
    template: '%s | RemedyIQ',
  },
  description: 'Cloud SaaS log analysis platform for BMC Remedy AR Server',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// ---------------------------------------------------------------------------
// FOUC-prevention script — runs before React hydration
// Reads localStorage and applies .dark class synchronously so the browser
// never paints with the wrong theme.
// ---------------------------------------------------------------------------

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored ? JSON.parse(stored).state && JSON.parse(stored).state.theme : stored;
    if (!theme) theme = stored;
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldBeDark = theme === 'dark' || (theme !== 'light' && prefersDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`.trim()

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  const inner = (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Synchronous theme script — must run before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.variable} suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider defaultTheme="system">
            {children}
            <Toaster
              richColors
              position="bottom-right"
              closeButton
              duration={4000}
            />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )

  // In dev mode, skip ClerkProvider to avoid auth-related loading issues
  if (IS_DEV_MODE) {
    return inner
  }

  return <ClerkProvider>{inner}</ClerkProvider>
}
