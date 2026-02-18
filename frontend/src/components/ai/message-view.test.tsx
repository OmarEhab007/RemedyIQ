/**
 * Tests for MessageView component.
 *
 * Covers: user message alignment and content, assistant message with markdown,
 * skill badge, copy button, token count, latency display, streaming indicator,
 * error state, and StreamingMessage synthetic wrapper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageView, StreamingMessage } from './message-view'
import type { Message } from '@/lib/api-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// DOMPurify is used server-side but has no real implementation in jsdom.
// Mock it to return the input HTML unchanged so we can assert on rendered content.
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'assistant',
    content: 'Hello from the assistant',
    skill_name: null,
    follow_ups: [],
    tokens_used: null,
    latency_ms: null,
    status: 'complete',
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // User messages
  // -------------------------------------------------------------------------

  describe('user message', () => {
    it('renders the user message content', () => {
      render(<MessageView message={makeMessage({ role: 'user', content: 'Hello there' })} />)
      expect(screen.getByText('Hello there')).toBeInTheDocument()
    })

    it('uses flex-row-reverse for user messages (right-aligned)', () => {
      render(<MessageView message={makeMessage({ role: 'user', content: 'Hi' })} />)
      const article = screen.getByRole('article')
      expect(article.className).toContain('flex-row-reverse')
    })

    it('shows "U" avatar for user messages', () => {
      render(<MessageView message={makeMessage({ role: 'user', content: 'Hi' })} />)
      // Avatar is aria-hidden, query by text content inside it
      const avatarEl = document.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(avatarEl).toBeTruthy()
      // The first aria-hidden div is the avatar for user
      const avatarDivs = document.querySelectorAll('[aria-hidden="true"]')
      const uAvatar = Array.from(avatarDivs).find((el) => el.textContent === 'U')
      expect(uAvatar).toBeTruthy()
    })

    it('has correct aria-label for user message', () => {
      render(<MessageView message={makeMessage({ role: 'user', content: 'Hi' })} />)
      expect(screen.getByRole('article', { name: /you: message/i })).toBeInTheDocument()
    })

    it('does not render a copy button for user messages', () => {
      render(<MessageView message={makeMessage({ role: 'user', content: 'Hi' })} />)
      expect(screen.queryByRole('button', { name: /copy message/i })).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Assistant messages
  // -------------------------------------------------------------------------

  describe('assistant message', () => {
    it('renders assistant message content', () => {
      render(<MessageView message={makeMessage({ content: 'I can help with that' })} />)
      expect(screen.getByText('I can help with that')).toBeInTheDocument()
    })

    it('uses flex-row for assistant messages (left-aligned)', () => {
      render(<MessageView message={makeMessage()} />)
      const article = screen.getByRole('article')
      expect(article.className).not.toContain('flex-row-reverse')
    })

    it('shows "AI" avatar for assistant messages', () => {
      render(<MessageView message={makeMessage()} />)
      const avatarDivs = document.querySelectorAll('[aria-hidden="true"]')
      const aiAvatar = Array.from(avatarDivs).find((el) => el.textContent === 'AI')
      expect(aiAvatar).toBeTruthy()
    })

    it('has correct aria-label for assistant message', () => {
      render(<MessageView message={makeMessage()} />)
      expect(screen.getByRole('article', { name: /ai assistant: message/i })).toBeInTheDocument()
    })

    it('renders markdown via dangerouslySetInnerHTML', () => {
      render(
        <MessageView
          message={makeMessage({ content: '**bold text**' })}
        />,
      )
      // DOMPurify is mocked to return as-is, markdown converts **bold** to <strong>
      const strongEl = document.querySelector('strong')
      expect(strongEl).toBeTruthy()
      expect(strongEl?.textContent).toBe('bold text')
    })

    it('renders a copy button for assistant messages', () => {
      render(<MessageView message={makeMessage({ content: 'Copy me' })} />)
      expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Skill badge
  // -------------------------------------------------------------------------

  it('shows skill badge when skill_name is present', () => {
    render(
      <MessageView
        message={makeMessage({ skill_name: 'slow_query_analyzer' })}
      />,
    )
    expect(screen.getByText('slow_query_analyzer')).toBeInTheDocument()
  })

  it('does not render skill badge when skill_name is null', () => {
    render(<MessageView message={makeMessage({ skill_name: null, content: 'Hello' })} />)
    // The skill badge renders the skill_name text inside a span. With null skill_name
    // there should be no element with the primary-light badge class.
    // We verify by confirming no span carries the specific badge background class.
    const badge = document.querySelector('span[class*="primary-light"]')
    expect(badge).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Token count and latency
  // -------------------------------------------------------------------------

  it('shows token count when tokens_used is provided', () => {
    render(<MessageView message={makeMessage({ tokens_used: 1234 })} />)
    expect(screen.getByText(/1,234 tokens/i)).toBeInTheDocument()
  })

  it('does not show token count when tokens_used is null', () => {
    render(<MessageView message={makeMessage({ tokens_used: null })} />)
    expect(screen.queryByText(/tokens/i)).not.toBeInTheDocument()
  })

  it('shows formatted latency when latency_ms is provided', () => {
    render(<MessageView message={makeMessage({ latency_ms: 2500 })} />)
    expect(screen.getByText('2.5s')).toBeInTheDocument()
  })

  it('does not show latency when latency_ms is null', () => {
    render(<MessageView message={makeMessage({ latency_ms: null })} />)
    expect(screen.queryByText(/s$/)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Copy button interaction
  // -------------------------------------------------------------------------

  it('copy button copies content to clipboard and shows "Copied" label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    // userEvent.setup() patches clipboard internally; bypass by using fireEvent
    // directly on the button and pre-configuring clipboard on the window object
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    })

    const { fireEvent } = await import('@testing-library/react')
    render(<MessageView message={makeMessage({ content: 'Copy this text' })} />)

    const copyBtn = screen.getByRole('button', { name: /copy message/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Copy this text')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Streaming indicator
  // -------------------------------------------------------------------------

  it('shows streaming indicator when status is "streaming"', () => {
    render(
      <MessageView
        message={makeMessage({ status: 'streaming' })}
      />,
    )
    expect(screen.getByLabelText(/streaming response/i)).toBeInTheDocument()
  })

  it('does not show streaming indicator when status is "complete"', () => {
    render(<MessageView message={makeMessage({ status: 'complete' })} />)
    expect(screen.queryByLabelText(/streaming response/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('applies error styling when status is "error"', () => {
    render(<MessageView message={makeMessage({ status: 'error', content: 'Oops' })} />)
    // The bubble div receives error class
    const bubble = document.querySelector('[class*="error"]')
    expect(bubble).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// StreamingMessage
// ---------------------------------------------------------------------------

describe('StreamingMessage', () => {
  it('renders with streaming status and provided content', () => {
    render(<StreamingMessage content="Loading response..." />)
    expect(screen.getByText('Loading response...')).toBeInTheDocument()
    expect(screen.getByLabelText(/streaming response/i)).toBeInTheDocument()
  })

  it('renders skill badge when skillName is provided', () => {
    render(<StreamingMessage content="Analyzing..." skillName="error_analyzer" />)
    expect(screen.getByText('error_analyzer')).toBeInTheDocument()
  })

  it('does not render skill badge when skillName is null', () => {
    render(<StreamingMessage content="Analyzing..." skillName={null} />)
    // The skill badge renders the skill_name text in a span with primary-light background.
    // With null skill_name there should be no such element.
    const badge = document.querySelector('span[class*="primary-light"]')
    expect(badge).toBeNull()
  })

  it('uses assistant role and left-aligned layout', () => {
    render(<StreamingMessage content="..." />)
    const article = screen.getByRole('article', { name: /ai assistant: message/i })
    expect(article).toBeInTheDocument()
    expect(article.className).not.toContain('flex-row-reverse')
  })
})
