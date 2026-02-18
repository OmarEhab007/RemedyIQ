'use client'

/**
 * conversation-list.tsx — Sidebar list of conversations.
 *
 * Shows title, message count, date. "New Conversation" button.
 * Delete with confirmation dialog.
 *
 * Usage:
 *   <ConversationList
 *     jobId={jobId}
 *     activeConversationId={activeId}
 *     onSelectConversation={(id) => setActiveConversation(id)}
 *   />
 */

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useConversations, useCreateConversation, useDeleteConversation } from '@/hooks/use-api'
import { useAIStore } from '@/stores/ai-store'
import { PageState } from '@/components/ui/page-state'
import type { Conversation } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationListProps {
  jobId?: string | null
  className?: string
}

// ---------------------------------------------------------------------------
// Format relative date
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMin = Math.floor(diffMs / (1000 * 60))
      return diffMin <= 1 ? 'just now' : `${diffMin}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// ConversationItem
// ---------------------------------------------------------------------------

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (confirmDelete) {
        onDelete(conversation.id)
      } else {
        setConfirmDelete(true)
        // Auto-cancel after 3s
        setTimeout(() => setConfirmDelete(false), 3000)
      }
    },
    [confirmDelete, conversation.id, onDelete],
  )

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 transition-colors',
        isActive
          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
          : 'hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
      )}
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onClick={() => onSelect(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(conversation.id)
        }
      }}
      aria-label={`Conversation: ${conversation.title}`}
    >
      {/* Icon */}
      <div
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          isActive ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
        )}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('truncate text-sm font-medium', isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]')}>
          {conversation.title || 'Untitled'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {conversation.message_count} msg{conversation.message_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {formatRelativeDate(conversation.updated_at)}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        aria-label={confirmDelete ? `Confirm delete "${conversation.title}"` : `Delete "${conversation.title}"`}
        title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        className={cn(
          'shrink-0 rounded p-1 text-[10px] font-medium transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          confirmDelete
            ? 'bg-[var(--color-error)] text-white'
            : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-error-light)] hover:text-[var(--color-error)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]',
        )}
      >
        {confirmDelete ? (
          <span className="px-1">Sure?</span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationList
// ---------------------------------------------------------------------------

export function ConversationList({ jobId, className }: ConversationListProps) {
  const { activeConversationId, setConversation } = useAIStore()
  const { data, isLoading, isError, refetch } = useConversations(jobId ?? undefined)
  const createMutation = useCreateConversation()
  const deleteMutation = useDeleteConversation()

  const conversations = data?.conversations ?? []

  const handleNew = useCallback(() => {
    createMutation.mutate(
      { jobId: jobId ?? undefined, title: 'New conversation' },
      {
        onSuccess: (conv) => {
          setConversation(conv.id)
        },
      },
    )
  }, [createMutation, jobId, setConversation])

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (activeConversationId === id) {
            setConversation(null)
          }
        },
      })
    },
    [deleteMutation, activeConversationId, setConversation],
  )

  return (
    <div
      className={cn('flex h-full flex-col gap-0', className)}
      role="listbox"
      aria-label="Conversations"
    >
      {/* Header + new button */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Conversations
        </span>
        <button
          type="button"
          onClick={handleNew}
          disabled={createMutation.isPending}
          aria-label="New conversation"
          title="New conversation"
          className="rounded p-1 text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {createMutation.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]" aria-hidden="true" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1" role="group">
        {isLoading && <PageState variant="loading" rows={3} />}

        {isError && (
          <PageState
            variant="error"
            message="Failed to load conversations."
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-xs text-[var(--color-text-tertiary)]">No conversations yet</p>
            <button
              type="button"
              onClick={handleNew}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none"
            >
              Start one
            </button>
          </div>
        )}

        {!isLoading && !isError && conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            onSelect={setConversation}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
