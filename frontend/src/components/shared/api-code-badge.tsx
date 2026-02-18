'use client'

/**
 * ApiCodeBadge — Shared component for displaying AR API codes with tooltips.
 *
 * Wraps cryptic API abbreviations (RE, CE, SE, etc.) with a tooltip showing
 * the full name and description from the AR_API_CODES constant map.
 *
 * Falls back to plain text when the code is unrecognized.
 *
 * Usage:
 *   <ApiCodeBadge code="RE" />
 *   // Renders: RE with tooltip "Retrieve Entry — Retrieves an existing record"
 */

import { AR_API_CODES } from '@/lib/constants'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

interface ApiCodeBadgeProps {
  /** The API abbreviation code (e.g., "RE", "CE", "SE") */
  code: string
  /** Optional className for the outer wrapper */
  className?: string
}

export function ApiCodeBadge({ code, className }: ApiCodeBadgeProps) {
  if (!code) return <span className={className}>—</span>

  const decoded = AR_API_CODES[code]

  if (!decoded) {
    return (
      <span className={className} data-testid="api-code-plain">
        {code}
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={className}
          data-testid="api-code-badge"
          role="term"
          aria-label={`${code}: ${decoded.name}`}
        >
          <span className="underline decoration-dotted decoration-[var(--color-text-tertiary)] underline-offset-2 cursor-help">
            {code}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <p className="font-semibold">{decoded.name}</p>
        <p className="text-[11px] opacity-80">{decoded.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}
