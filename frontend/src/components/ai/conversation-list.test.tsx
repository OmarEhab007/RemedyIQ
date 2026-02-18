/**
 * Tests for ConversationList component.
 *
 * Covers: renders conversation titles and metadata, "New Conversation" button,
 * click to select a conversation, two-click delete with confirmation,
 * empty state, loading state, error state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationList } from './conversation-list'
import type { Conversation } from '@/lib/api-types'
import { useConversations, useCreateConversation, useDeleteConversation } from '@/hooks/use-api'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-api', () => ({
  useConversations: vi.fn(),
  useCreateConversation: vi.fn(),
  useDeleteConversation: vi.fn(),
}))

vi.mock('@/stores/ai-store', () => ({
  useAIStore: vi.fn(() => ({
    activeConversationId: null,
    setConversation: vi.fn(),
  })),
}))

vi.mock('@/components/ui/page-state', () => ({
  PageState: ({
    variant,
    message,
    rows,
    onRetry,
  }: {
    variant: string
    message?: string
    rows?: number
    onRetry?: () => void
  }) => (
    <div data-testid={`page-state-${variant}`} data-rows={rows}>
      {message}
      {onRetry && (
        <button onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}))

const mockUseConversations = vi.mocked(useConversations)
const mockUseCreateConversation = vi.mocked(useCreateConversation)
const mockUseDeleteConversation = vi.mocked(useDeleteConversation)

// ---------------------------------------------------------------------------
// Import useAIStore after mocking so we can change its return value per test
// ---------------------------------------------------------------------------

import { useAIStore } from '@/stores/ai-store'
const mockUseAIStore = vi.mocked(useAIStore)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    tenant_id: 't-1',
    user_id: 'u-1',
    job_id: 'job-1',
    title: 'My Conversation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 3,
    messages: [],
    ...overrides,
  }
}

function makeCreateMutation(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  }
}

function makeDeleteMutation(overrides = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationList', () => {
  const setConversation = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAIStore.mockReturnValue({
      activeConversationId: null,
      setConversation,
    } as unknown as ReturnType<typeof useAIStore>)
    mockUseCreateConversation.mockReturnValue(
      makeCreateMutation() as unknown as ReturnType<typeof useCreateConversation>,
    )
    mockUseDeleteConversation.mockReturnValue(
      makeDeleteMutation() as unknown as ReturnType<typeof useDeleteConversation>,
    )
    mockUseConversations.mockReturnValue({
      data: { conversations: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)
  })

  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  it('renders "Conversations" header', () => {
    render(<ConversationList />)
    expect(screen.getByText('Conversations')).toBeInTheDocument()
  })

  it('renders "New conversation" button', () => {
    render(<ConversationList />)
    expect(screen.getByRole('button', { name: /new conversation/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading state while fetching', () => {
    mockUseConversations.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByTestId('page-state-loading')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error state on fetch failure', () => {
    mockUseConversations.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByTestId('page-state-error')).toBeInTheDocument()
    expect(screen.getByText(/failed to load conversations/i)).toBeInTheDocument()
  })

  it('retry button in error state calls refetch', async () => {
    const refetch = vi.fn()
    mockUseConversations.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useConversations>)

    const user = userEvent.setup()
    render(<ConversationList />)
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(refetch).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when no conversations exist', () => {
    render(<ConversationList />)
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start one/i })).toBeInTheDocument()
  })

  it('"Start one" button triggers createMutation', async () => {
    const mutate = vi.fn()
    mockUseCreateConversation.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateConversation>)

    const user = userEvent.setup()
    render(<ConversationList />)
    await user.click(screen.getByRole('button', { name: /start one/i }))

    expect(mutate).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Conversation list
  // -------------------------------------------------------------------------

  it('renders conversation titles', () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [
          makeConversation({ id: 'c-1', title: 'First chat' }),
          makeConversation({ id: 'c-2', title: 'Second chat' }),
        ],
        pagination: { page: 1, page_size: 20, total: 2, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByText('First chat')).toBeInTheDocument()
    expect(screen.getByText('Second chat')).toBeInTheDocument()
  })

  it('shows message count for each conversation', () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ message_count: 5 })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByText(/5 msgs/i)).toBeInTheDocument()
  })

  it('shows singular "msg" for 1 message', () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ message_count: 1 })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByText('1 msg')).toBeInTheDocument()
  })

  it('falls back to "Untitled" when conversation title is empty', () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ title: '' })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    render(<ConversationList />)
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Select conversation
  // -------------------------------------------------------------------------

  it('clicking a conversation calls setConversation with its id', async () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ id: 'conv-42', title: 'Click me' })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    const user = userEvent.setup()
    render(<ConversationList />)
    await user.click(screen.getByRole('option', { name: /conversation: click me/i }))

    expect(setConversation).toHaveBeenCalledWith('conv-42')
  })

  it('marks the active conversation as selected', () => {
    const conversations = [
      makeConversation({ id: 'conv-active', title: 'Active chat' }),
    ]
    mockUseConversations.mockReturnValue({
      data: { conversations, pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)
    mockUseAIStore.mockReturnValue({
      activeConversationId: 'conv-active',
      setConversation,
    } as unknown as ReturnType<typeof useAIStore>)

    render(<ConversationList />)
    const option = screen.getByRole('option', { name: /conversation: active chat/i })
    expect(option).toHaveAttribute('aria-selected', 'true')
  })

  // -------------------------------------------------------------------------
  // Delete conversation (two-click confirmation)
  // -------------------------------------------------------------------------

  it('first delete click shows confirmation text', async () => {
    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ id: 'c-1', title: 'Delete me' })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    const user = userEvent.setup()
    render(<ConversationList />)

    const deleteBtn = screen.getByRole('button', { name: /delete "delete me"/i })
    await user.click(deleteBtn)

    expect(screen.getByText('Sure?')).toBeInTheDocument()
  })

  it('second delete click calls deleteMutation.mutate', async () => {
    const mutate = vi.fn()
    mockUseDeleteConversation.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteConversation>)

    mockUseConversations.mockReturnValue({
      data: {
        conversations: [makeConversation({ id: 'c-1', title: 'Delete me' })],
        pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConversations>)

    const user = userEvent.setup()
    render(<ConversationList />)

    // First click
    const deleteBtn = screen.getByRole('button', { name: /delete "delete me"/i })
    await user.click(deleteBtn)
    // Second click — button now reads "Confirm delete"
    const confirmBtn = screen.getByRole('button', { name: /confirm delete "delete me"/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith('c-1', expect.any(Object))
    })
  })

  // -------------------------------------------------------------------------
  // New conversation button
  // -------------------------------------------------------------------------

  it('clicking "New conversation" button calls createMutation.mutate', async () => {
    const mutate = vi.fn()
    mockUseCreateConversation.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateConversation>)

    const user = userEvent.setup()
    render(<ConversationList jobId="job-123" />)
    await user.click(screen.getByRole('button', { name: /new conversation/i }))

    expect(mutate).toHaveBeenCalledWith(
      { jobId: 'job-123', title: 'New conversation' },
      expect.any(Object),
    )
  })

  it('"New conversation" button is disabled while creating', () => {
    mockUseCreateConversation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useCreateConversation>)

    render(<ConversationList />)
    expect(screen.getByRole('button', { name: /new conversation/i })).toBeDisabled()
  })
})
