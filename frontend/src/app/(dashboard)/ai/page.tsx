'use client'

/**
 * ai/page.tsx — AI Assistant page.
 *
 * Layout: ConversationList sidebar (left) + ChatPanel (right).
 * Job picker at the top to scope conversations.
 */

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAnalyses } from '@/hooks/use-api'
import { useAIStore } from '@/stores/ai-store'
import { PageState } from '@/components/ui/page-state'
import { ConversationList } from '@/components/ai/conversation-list'
import { ChatPanel } from '@/components/ai/chat-panel'

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams inside Suspense)
// ---------------------------------------------------------------------------

function AIPageContent() {
  const searchParams = useSearchParams()
  const [selectedJobId, setSelectedJobId] = useState<string>(
    searchParams.get('job') ?? '',
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { activeConversationId } = useAIStore()
  const { data: analysesData, isLoading: analysesLoading } = useAnalyses()
  const jobs = analysesData?.jobs ?? []

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col overflow-hidden">
      {/* Top bar: job picker + sidebar toggle */}
      <div className="shrink-0 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2">
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Collapse conversation list' : 'Expand conversation list'}
          aria-expanded={sidebarOpen}
          aria-controls="ai-sidebar"
          className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {sidebarOpen ? (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {/* Page title */}
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Assistant</h1>

        <div className="h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />

        {/* Job picker */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="ai-job-picker"
            className="shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Job:
          </label>
          {analysesLoading ? (
            <div className="h-7 w-40 animate-pulse rounded bg-[var(--color-border)]" aria-hidden="true" />
          ) : (
            <select
              id="ai-job-picker"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Select analysis job for AI context"
            >
              <option value="">-- No job selected --</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.id.slice(0, 12)} — {job.status}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Active conversation indicator */}
        {activeConversationId && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-success)]" aria-hidden="true" />
            Active
          </span>
        )}
      </div>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Conversation list sidebar */}
        <aside
          id="ai-sidebar"
          className={cn(
            'flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-primary)] transition-all duration-200',
            sidebarOpen ? 'w-64 shrink-0' : 'w-0 overflow-hidden',
          )}
          aria-label="Conversations"
          aria-hidden={!sidebarOpen}
        >
          {sidebarOpen && (
            <ConversationList jobId={selectedJobId || undefined} />
          )}
        </aside>

        {/* Chat panel */}
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          {selectedJobId ? (
            <ChatPanel
              jobId={selectedJobId}
              conversationId={activeConversationId}
              className="flex-1"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-2xl" aria-hidden="true">
                🤖
              </div>
              <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
                Select an analysis job above to start chatting with the AI assistant about your logs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function AIPage() {
  return (
    <Suspense fallback={<PageState variant="loading" rows={6} />}>
      <AIPageContent />
    </Suspense>
  )
}
