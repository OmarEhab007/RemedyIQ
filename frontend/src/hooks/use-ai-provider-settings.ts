'use client'

/**
 * Persists AI provider / model / BYOK fields in localStorage for the AI Assistant page.
 * Keys are only stored in the browser; the backend uses them per request when provided.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'remedyiq-ai-provider-v1'

export type AIProviderChoice = 'gemini' | 'openai' | 'ollama'

export interface AIProviderUserSettings {
  provider: AIProviderChoice
  /** Model id override (e.g. gpt-4o-mini, llama3.2, gemini-2.5-flash). */
  model: string
  /** OpenAI-compatible API base URL (Ollama default includes /v1). */
  openaiBaseUrl: string
  /** Optional API key (OpenAI, Google AI Studio, or unused for local Ollama). */
  apiKey: string
}

export const defaultAIProviderUserSettings: AIProviderUserSettings = {
  provider: 'gemini',
  model: '',
  openaiBaseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
}

function normalizeProvider(v: unknown): AIProviderChoice {
  const s = String(v ?? '').toLowerCase()
  if (s === 'openai' || s === 'ollama' || s === 'gemini') return s
  return 'gemini'
}

function load(): AIProviderUserSettings {
  if (typeof window === 'undefined') return defaultAIProviderUserSettings
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultAIProviderUserSettings
    const v = JSON.parse(raw) as Partial<AIProviderUserSettings>
    return {
      provider: normalizeProvider(v.provider),
      model: typeof v.model === 'string' ? v.model : '',
      openaiBaseUrl:
        typeof v.openaiBaseUrl === 'string' ? v.openaiBaseUrl : defaultAIProviderUserSettings.openaiBaseUrl,
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
    }
  } catch {
    return defaultAIProviderUserSettings
  }
}

export function useAIProviderSettings() {
  const [settings, setSettingsState] = useState<AIProviderUserSettings>(defaultAIProviderUserSettings)

  useEffect(() => {
    setSettingsState(load())
  }, [])

  const setSettings = useCallback((next: AIProviderUserSettings) => {
    setSettingsState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore quota / private mode
    }
  }, [])

  return { settings, setSettings }
}
