'use client'

/**
 * chat-panel.tsx — Main AI chat area.
 *
 * - Message list (scrollable, auto-scroll to bottom)
 * - SkillSelector above the input
 * - ChatInput at the bottom
 * - Streaming via streamAI() async generator from api.ts
 * - Renders StreamingMessage for in-progress tokens
 *
 * Usage:
 *   <ChatPanel jobId={jobId} conversationId={activeConversationId} />
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

function useGetToken() {
  if (IS_DEV_MODE) {
    return () => Promise.resolve(null as string | null)
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { getToken } = useAuth()
  return getToken
}
import { streamAI } from '@/lib/api'
import { queryKeys } from '@/hooks/use-api'
import { useConversation } from '@/hooks/use-api'
import { useAIStore } from '@/stores/ai-store'
import { MessageView, StreamingMessage } from './message-view'
import { ChatInput } from './chat-input'
import { SkillSelector } from './skill-selector'
import { FollowUpSuggestions } from './follow-up-suggestions'
import { PageState } from '@/components/ui/page-state'
import type { Message } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  jobId: string
  conversationId: string | null
  className?: string
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyChat({ onSuggest }: { onSuggest: (msg: string) => void }) {
  const starters = [
    'What are the slowest SQL queries?',
    'Summarize the top errors in this log.',
    'Are there any performance anomalies?',
    'Which users had the most API calls?',
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-3xl" aria-hidden="true">
        🤖
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">RemedyIQ AI Assistant</h2>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">
          Ask anything about your AR Server logs. I can analyze performance, errors, traces, and more.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export function ChatPanel({ jobId, conversationId, className }: ChatPanelProps) {
  const getToken = useGetToken()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)

  const {
    isStreaming,
    streamContent,
    selectedSkill,
    startStreaming,
    appendToken,
    stopStreaming,
    setSkill,
  } = useAIStore()

  const { data: conversation, isLoading, isError, refetch } = useConversation(conversationId)
  const messages: Message[] = conversation?.messages ?? []

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, streamContent, scrollToBottom])

  // Get last message's follow-ups
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant' && m.follow_ups?.length > 0)

  const handleSend = useCallback(
    async (text: string) => {
      if (!conversationId || isStreaming) return

      // Optimistically show user message
      setPendingMessage(text)
      setStreamError(null)
      startStreaming()

      try {
        const token = await getToken()
        const gen = streamAI(jobId, conversationId, text, selectedSkill ?? undefined, token ?? undefined)

        // Set up abort capability
        let aborted = false
        abortRef.current = () => {
          aborted = true
        }

        for await (const event of gen) {
          if (aborted) break

          if (event.type === 'token' && event.content) {
            appendToken(event.content)
          } else if (event.type === 'done') {
            break
          } else if (event.type === 'error') {
            setStreamError(event.error ?? 'An error occurred while streaming.')
            break
          }
          // start, skill, metadata events are informational — ignore
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect to AI service.'
        setStreamError(message)
      } finally {
        stopStreaming()
        abortRef.current = null
        // Keep pendingMessage visible until server state is refreshed
        void queryClient.invalidateQueries({
          queryKey: queryKeys.conversation(conversationId ?? ''),
        }).then(() => {
          setPendingMessage(null)
        })
      }
    },
    [
      conversationId,
      isStreaming,
      jobId,
      selectedSkill,
      getToken,
      startStreaming,
      appendToken,
      stopStreaming,
      queryClient,
    ],
  )

  const handleStop = useCallback(() => {
    abortRef.current?.()
    stopStreaming()
    setPendingMessage(null)
  }, [stopStreaming])

  // No conversation selected
  if (!conversationId) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-[var(--color-text-secondary)]',
          className,
        )}
      >
        <p>Select a conversation from the sidebar or create a new one to start chatting.</p>
      </div>
    )
  }

  // Loading
  if (isLoading) {
    return <PageState variant="loading" rows={5} />
  }

  // Error
  if (isError) {
    return (
      <PageState
        variant="error"
        message="Failed to load conversation."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div
      className={cn('flex flex-col h-full overflow-hidden', className)}
      aria-label="AI chat"
      role="main"
    >
      {/* Skill selector */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2">
        <SkillSelector selectedSkill={selectedSkill} onSelectSkill={setSkill} />
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {/* Empty state with starters */}
        {messages.length === 0 && !isStreaming && !pendingMessage && (
          <EmptyChat onSuggest={(s) => void handleSend(s)} />
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <MessageView key={msg.id} message={msg} />
        ))}

        {/* Optimistic user message */}
        {pendingMessage && (
          <MessageView
            message={{
              id: '__pending_user__',
              conversation_id: conversationId,
              role: 'user',
              content: pendingMessage,
              skill_name: null,
              follow_ups: [],
              tokens_used: null,
              latency_ms: null,
              status: 'pending',
              error_message: null,
              created_at: new Date().toISOString(),
            }}
          />
        )}

        {/* Streaming response */}
        {isStreaming && streamContent && (
          <StreamingMessage content={streamContent} skillName={selectedSkill} />
        )}

        {/* Streaming indicator (no content yet) */}
        {isStreaming && !streamContent && (
          <div className="flex gap-3 px-4 py-3" aria-label="AI is thinking" aria-live="polite">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-xs font-bold text-[var(--color-text-secondary)]" aria-hidden="true">
              AI
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-tertiary)]"
                  style={{ animationDelay: `${i * 150}ms` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        )}

        {/* Stream error */}
        {streamError && !isStreaming && (
          <div className="flex gap-3 px-4 py-3" role="alert">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-error-light)] text-xs font-bold text-[var(--color-error)]" aria-hidden="true">
              !
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl rounded-bl-sm border border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-3">
              <p className="text-sm font-medium text-[var(--color-error)]">Failed to get AI response</p>
              <p className="text-xs text-[var(--color-error)]">{streamError}</p>
              <button
                type="button"
                onClick={() => setStreamError(null)}
                className="self-start rounded px-2 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Follow-up suggestions */}
        {lastAssistantMessage && !isStreaming && (
          <FollowUpSuggestions
            suggestions={lastAssistantMessage.follow_ups}
            onSelect={(s) => void handleSend(s)}
            disabled={isStreaming}
          />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--color-border)] p-3">
        <ChatInput
          onSubmit={(text) => void handleSend(text)}
          onStop={handleStop}
          isStreaming={isStreaming}
          disabled={!conversationId}
        />
      </div>
    </div>
  )
}
