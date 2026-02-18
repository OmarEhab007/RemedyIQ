'use client'

/**
 * message-view.tsx — Single message component for the AI chat.
 *
 * User messages: right-aligned.
 * Assistant messages: left-aligned, rendered markdown (via dangerouslySetInnerHTML with DOMPurify),
 * copy button, skill badge, token count + latency.
 *
 * Usage:
 *   <MessageView message={msg} />
 */

import { useCallback, useState } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageViewProps {
  message: Message
  className?: string
}

// ---------------------------------------------------------------------------
// Minimal markdown → HTML conversion (no external dep needed beyond DOMPurify)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  // Very simple inline renderer for common patterns.
  // For production use, swap in `marked` or `react-markdown`.
  let html = text
    // Code blocks
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code: string) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<pre class="riq-code-block"><code class="language-${lang ?? 'text'}">${escaped}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="riq-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="riq-h3">$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="riq-h2">$1</h2>')
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="riq-h1">$1</h1>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Wrap adjacent li's in ul (simple heuristic)
    .replace(/(<li>.+<\/li>\n?)+/g, (match) => `<ul class="riq-ul">${match}</ul>`)
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs — wrap lines that aren't already wrapped
    .split('\n\n')
    .map((block) =>
      block.startsWith('<') ? block : `<p>${block.replace(/\n/g, '<br/>')}</p>`,
    )
    .join('\n')

  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied!' : 'Copy'}
      className="rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// MessageView
// ---------------------------------------------------------------------------

export function MessageView({ message, className }: MessageViewProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
      role="article"
      aria-label={`${isUser ? 'You' : 'AI assistant'}: message`}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isUser
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
        )}
        aria-hidden="true"
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={cn('flex max-w-[75%] flex-col gap-1.5', isUser && 'items-end')}>
        {/* Content bubble */}
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 text-sm shadow-sm',
            isUser
              ? 'bg-[var(--color-primary)] text-white rounded-br-sm'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-bl-sm border border-[var(--color-border)]',
            isError && 'border-[var(--color-error-light)] bg-[var(--color-error-light)] text-[var(--color-error)]',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              className="prose-riq"
              // DOMPurify-sanitized HTML
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <span
              className="ml-1 inline-flex items-center gap-0.5"
              aria-label="Streaming response"
              aria-live="polite"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-tertiary)]"
                  style={{ animationDelay: `${i * 150}ms` }}
                  aria-hidden="true"
                />
              ))}
            </span>
          )}
        </div>

        {/* Meta row: skill badge, tokens, latency, copy */}
        <div className={cn('flex items-center gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
          {/* Skill badge */}
          {message.skill_name && (
            <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
              {message.skill_name}
            </span>
          )}

          {/* Token count */}
          {message.tokens_used !== null && message.tokens_used !== undefined && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {message.tokens_used.toLocaleString()} tokens
            </span>
          )}

          {/* Latency */}
          {message.latency_ms !== null && message.latency_ms !== undefined && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {(message.latency_ms / 1000).toFixed(1)}s
            </span>
          )}

          {/* Copy button (assistant only) */}
          {!isUser && message.content && (
            <CopyButton text={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Streaming message (synthetic message object for in-progress stream)
// ---------------------------------------------------------------------------

interface StreamingMessageProps {
  content: string
  skillName?: string | null
  className?: string
}

export function StreamingMessage({ content, skillName, className }: StreamingMessageProps) {
  const syntheticMessage: Message = {
    id: '__streaming__',
    conversation_id: '',
    role: 'assistant',
    content,
    skill_name: skillName ?? null,
    follow_ups: [],
    tokens_used: null,
    latency_ms: null,
    status: 'streaming',
    error_message: null,
    created_at: new Date().toISOString(),
  }
  return <MessageView message={syntheticMessage} className={className} />
}
