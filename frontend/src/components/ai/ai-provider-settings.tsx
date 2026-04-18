'use client'

/**
 * AI provider configuration: Gemini (Google), OpenAI, or local Ollama (OpenAI-compatible /v1).
 */

import { useCallback, useId, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AIProviderChoice, AIProviderUserSettings } from '@/hooks/use-ai-provider-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIProviderSettingsProps {
  settings: AIProviderUserSettings
  onChange: (next: AIProviderUserSettings) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIProviderSettings({ settings, onChange, className }: AIProviderSettingsProps) {
  const baseId = useId()
  const [showKey, setShowKey] = useState(false)

  const patch = useCallback(
    (partial: Partial<AIProviderUserSettings>) => {
      onChange({ ...settings, ...partial })
    },
    [onChange, settings],
  )

  const providerLabel = (p: AIProviderChoice) => {
    switch (p) {
      case 'gemini':
        return 'Google Gemini'
      case 'openai':
        return 'OpenAI'
      case 'ollama':
        return 'Ollama (local)'
      default:
        return p
    }
  }

  return (
    <div className={cn('flex flex-col gap-3 text-xs', className)}>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${baseId}-provider`} className="font-semibold text-[var(--color-text-secondary)]">
          Provider
        </label>
        <select
          id={`${baseId}-provider`}
          value={settings.provider}
          onChange={(e) => {
            const p = e.target.value as AIProviderChoice
            if (p === 'openai') {
              onChange({ ...settings, provider: p, openaiBaseUrl: 'https://api.openai.com/v1' })
              return
            }
            if (p === 'ollama') {
              onChange({ ...settings, provider: p, openaiBaseUrl: 'http://127.0.0.1:11434/v1' })
              return
            }
            onChange({ ...settings, provider: p })
          }}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {(['gemini', 'openai', 'ollama'] as const).map((p) => (
            <option key={p} value={p}>
              {providerLabel(p)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${baseId}-model`} className="font-semibold text-[var(--color-text-secondary)]">
          Model{' '}
          <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
        </label>
        <input
          id={`${baseId}-model`}
          type="text"
          value={settings.model}
          onChange={(e) => patch({ model: e.target.value })}
          placeholder={
            settings.provider === 'gemini'
              ? 'e.g. gemini-2.5-flash'
              : settings.provider === 'openai'
                ? 'e.g. gpt-4o-mini'
                : 'e.g. llama3.2'
          }
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          autoComplete="off"
        />
      </div>

      {(settings.provider === 'ollama' || settings.provider === 'openai') && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-base`} className="font-semibold text-[var(--color-text-secondary)]">
            Base URL
          </label>
          <input
            id={`${baseId}-base`}
            type="url"
            value={settings.openaiBaseUrl}
            onChange={(e) => patch({ openaiBaseUrl: e.target.value })}
            placeholder={settings.provider === 'ollama' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1'}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            autoComplete="off"
          />
          <p className="text-[10px] leading-snug text-[var(--color-text-tertiary)]">
            Ollama exposes an OpenAI-compatible API at <span className="font-mono">/v1</span>. Use your LAN host if Ollama runs on another machine.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={`${baseId}-key`} className="font-semibold text-[var(--color-text-secondary)]">
            API key{' '}
            <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
          </label>
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-[10px] font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id={`${baseId}-key`}
          type={showKey ? 'text' : 'password'}
          value={settings.apiKey}
          onChange={(e) => patch({ apiKey: e.target.value })}
          placeholder={
            settings.provider === 'gemini'
              ? 'Google AI Studio / Gemini API key'
              : settings.provider === 'openai'
                ? 'sk-…'
                : 'Usually empty for Ollama'
          }
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          autoComplete="off"
        />
        <p className="text-[10px] leading-snug text-[var(--color-text-tertiary)]">
          Stored only in this browser and sent with chat requests. Server defaults apply when fields are empty.
        </p>
      </div>
    </div>
  )
}
