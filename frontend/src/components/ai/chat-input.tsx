'use client'

/**
 * chat-input.tsx — Text input for the AI chat panel.
 *
 * - Shift+Enter inserts newline; Enter submits.
 * - Disabled during streaming.
 * - "Stop" button during streaming.
 * - Auto-grows up to 5 lines.
 *
 * Usage:
 *   <ChatInput
 *     onSubmit={(text) => handleSend(text)}
 *     onStop={() => stopStreaming()}
 *     isStreaming={isStreaming}
 *     disabled={!selectedConversation}
 *     placeholder="Ask about your logs..."
 *   />
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatInputProps {
  onSubmit: (message: string) => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

export function ChatInput({
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask about your logs…',
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px` // max ~5 lines
  }, [value])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming || disabled) return
    onSubmit(trimmed)
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSubmit = value.trim().length > 0 && !isStreaming && !disabled

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-[var(--color-primary)]',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isStreaming}
        placeholder={isStreaming ? 'Waiting for response…' : placeholder}
        rows={1}
        aria-label="Message input"
        aria-disabled={disabled || isStreaming}
        aria-multiline="true"
        className={cn(
          'w-full resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
          'focus-visible:outline-none',
          'min-h-[36px] max-h-[120px]',
          'leading-relaxed px-2 py-1',
          (disabled || isStreaming) && 'cursor-not-allowed',
        )}
      />

      {/* Footer row */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          Shift+Enter for newline
        </span>

        <div className="flex items-center gap-2">
          {/* Character count */}
          {value.length > 0 && (
            <span className="text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
              {value.length}
            </span>
          )}

          {/* Stop button (streaming only) */}
          {isStreaming && onStop && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop streaming response"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-error)] bg-[var(--color-error-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <rect x="1" y="1" width="8" height="8" rx="1" />
              </svg>
              Stop
            </button>
          )}

          {/* Submit button */}
          {!isStreaming && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-label="Send message"
              aria-disabled={!canSubmit}
              className={cn(
                'inline-flex items-center justify-center rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                canSubmit
                  ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed',
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
