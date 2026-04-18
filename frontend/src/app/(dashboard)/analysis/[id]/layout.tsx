import type { ReactNode } from 'react'
import { Outfit, JetBrains_Mono } from 'next/font/google'

// ---------------------------------------------------------------------------
// Analysis job subtree — typography scoped to log dashboards only
// (Outfit + JetBrains Mono). Root app layout keeps default sans for the rest
// of the product.
// ---------------------------------------------------------------------------

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-analysis-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-analysis-mono',
  display: 'swap',
})

interface AnalysisJobLayoutProps {
  children: ReactNode
}

export default function AnalysisJobLayout({ children }: AnalysisJobLayoutProps) {
  return (
    <div className={`${outfit.variable} ${jetbrainsMono.variable} analysis-dashboard-font`}>
      {children}
    </div>
  )
}
