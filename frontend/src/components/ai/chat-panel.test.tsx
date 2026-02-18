/**
 * Tests for ChatPanel component.
 *
 * Covers: empty state, message rendering, no-conversation state,
 * loading state, error state, skill selector presence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatPanel } from './chat-panel'
import type { Conversation, Message } from '@/lib/api-types'

// Polyfill scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn()

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({
    getToken: vi.fn().mockResolvedValue('test-token'),
  })),
}))

vi.mock('@/lib/api', () => ({
  streamAI: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

vi.mock('@/hooks/use-api', () => ({
  useConversation: vi.fn(),
  queryKeys: {
    conversation: (id: string) => ['conversations', 'detail', id],
  },
}))

vi.mock('@/stores/ai-store', () => ({
  useAIStore: vi.fn(() => ({
    isStreaming: false,
    streamContent: '',
    selectedSkill: null,
    startStreaming: vi.fn(),
    appendToken: vi.fn(),
    stopStreaming: vi.fn(),
    setSkill: vi.fn(),
  })),
}))

vi.mock('./skill-selector', () => ({
  SkillSelector: ({ selectedSkill }: { selectedSkill: string | null; onSelectSkill: (s: string | null) => void }) => (
    <div data-testid="skill-selector" data-selected={selectedSkill ?? 'auto'} />
  ),
}))

vi.mock('./message-view', () => ({
  MessageView: ({ message }: { message: Message }) => (
    <div data-testid="message-view" data-role={message.role}>{message.content}</div>
  ),
  StreamingMessage: ({ content }: { content: string }) => (
    <div data-testid="streaming-message">{content}</div>
  ),
}))

vi.mock('./chat-input', () => ({
  ChatInput: ({ disabled, isStreaming }: { onSubmit: (s: string) => void; disabled?: boolean; isStreaming?: boolean }) => (
    <div data-testid="chat-input" data-disabled={String(disabled)} data-streaming={String(isStreaming)} />
  ),
}))

vi.mock('./follow-up-suggestions', () => ({
  FollowUpSuggestions: ({ suggestions }: { suggestions: string[]; onSelect: (s: string) => void }) => (
    <div data-testid="follow-up-suggestions">{suggestions.join(', ')}</div>
  ),
}))

vi.mock('@/components/ui/page-state', () => ({
  PageState: ({ variant, message }: { variant: string; message?: string; rows?: number; onRetry?: () => void }) => (
    <div data-testid={`page-state-${variant}`}>{message}</div>
  ),
}))

// ---------------------------------------------------------------------------
// Type imports
// ---------------------------------------------------------------------------

import { useConversation } from '@/hooks/use-api'

const mockUseConversation = vi.mocked(useConversation)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'assistant',
    content: 'Hello there',
    skill_name: null,
    follow_ups: [],
    tokens_used: 100,
    latency_ms: 500,
    status: 'complete',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeConversation(messages: Message[] = []): Conversation {
  return {
    id: 'conv-1',
    tenant_id: 't-1',
    user_id: 'u-1',
    job_id: 'job-1',
    title: 'Test conversation',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    message_count: messages.length,
    messages,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "no conversation" message when conversationId is null', () => {
    mockUseConversation.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId={null} />)
    expect(screen.getByText(/select a conversation/i)).toBeInTheDocument()
  })

  it('shows loading state while fetching conversation', () => {
    mockUseConversation.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByTestId('page-state-loading')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', () => {
    mockUseConversation.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByTestId('page-state-error')).toBeInTheDocument()
  })

  it('shows empty state with starters when conversation has no messages', () => {
    mockUseConversation.mockReturnValue({
      data: makeConversation([]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByText(/remedyiq ai assistant/i)).toBeInTheDocument()
  })

  it('renders messages from the conversation', () => {
    const messages = [
      makeMessage({ id: 'msg-1', role: 'user', content: 'User says hi' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Assistant reply' }),
    ]
    mockUseConversation.mockReturnValue({
      data: makeConversation(messages),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getAllByTestId('message-view')).toHaveLength(2)
  })

  it('renders SkillSelector', () => {
    mockUseConversation.mockReturnValue({
      data: makeConversation([]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByTestId('skill-selector')).toBeInTheDocument()
  })

  it('renders ChatInput', () => {
    mockUseConversation.mockReturnValue({
      data: makeConversation([]),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
  })

  it('renders follow-up suggestions from last assistant message', () => {
    const messages = [
      makeMessage({
        id: 'msg-1',
        role: 'assistant',
        content: 'Here is info',
        follow_ups: ['Tell me more', 'Show examples'],
      }),
    ]
    mockUseConversation.mockReturnValue({
      data: makeConversation(messages),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversation>)

    render(<ChatPanel jobId="job-1" conversationId="conv-1" />)
    expect(screen.getByTestId('follow-up-suggestions')).toBeInTheDocument()
  })
})
