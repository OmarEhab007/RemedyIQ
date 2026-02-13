import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from './chat-panel'
import type { AIMessage } from '@/hooks/use-ai'

describe('ChatPanel', () => {
  const mockOnSend = vi.fn()
  const mockMessages: AIMessage[] = [
    { id: 'msg-1', role: 'user', content: 'What errors are in the log?' },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I found 5 errors in the log file.',
      followUps: ['What are the error codes?', 'Show me the stack traces'],
      latencyMs: 250,
      tokensUsed: 150,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders empty state message when no messages', () => {
    render(
      <ChatPanel messages={[]} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    expect(screen.getByText('Ask a question about your log analysis')).toBeInTheDocument()
  })

  it('renders user messages aligned right', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const userMessage = screen.getByText('What errors are in the log?')
    const container = userMessage.closest('.bg-primary')
    expect(container).toBeInTheDocument()
  })

  it('renders assistant messages aligned left', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const assistantMessage = screen.getByText('I found 5 errors in the log file.')
    const container = assistantMessage.closest('.bg-muted')
    expect(container).toBeInTheDocument()
  })

  it('displays message content', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    expect(screen.getByText('What errors are in the log?')).toBeInTheDocument()
    expect(screen.getByText('I found 5 errors in the log file.')).toBeInTheDocument()
  })

  it('shows follow-up questions for assistant messages', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    expect(screen.getByText('What are the error codes?')).toBeInTheDocument()
    expect(screen.getByText('Show me the stack traces')).toBeInTheDocument()
  })

  it('clicking follow-up calls onSend with the question text', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    fireEvent.click(screen.getByText('What are the error codes?'))
    expect(mockOnSend).toHaveBeenCalledWith('What are the error codes?', 'summarizer')
  })

  it('shows latency and tokens for assistant messages', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    expect(screen.getByText('250ms | 150 tokens')).toBeInTheDocument()
  })

  it('shows Thinking indicator when loading', () => {
    render(
      <ChatPanel messages={mockMessages} loading={true} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('disables input when loading', () => {
    render(
      <ChatPanel messages={mockMessages} loading={true} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const input = screen.getByPlaceholderText('Ask about your logs...')
    expect(input).toBeDisabled()
  })

  it('disables send button when input is empty', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('disables send button when loading', () => {
    render(
      <ChatPanel messages={mockMessages} loading={true} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('calls onSend with input text and selectedSkill on form submit', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const input = screen.getByPlaceholderText('Ask about your logs...')
    fireEvent.change(input, { target: { value: 'Show me the errors' } })
    fireEvent.submit(input.closest('form')!)
    expect(mockOnSend).toHaveBeenCalledWith('Show me the errors', 'summarizer')
  })

  it('clears input after submission', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const input = screen.getByPlaceholderText('Ask about your logs...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Show me the errors' } })
    fireEvent.submit(input.closest('form')!)
    expect(input.value).toBe('')
  })

  it('does not submit empty or whitespace-only input', () => {
    render(
      <ChatPanel messages={mockMessages} loading={false} onSend={mockOnSend} selectedSkill="summarizer" />
    )
    const input = screen.getByPlaceholderText('Ask about your logs...')
    const form = input.closest('form')!

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.submit(form)
    expect(mockOnSend).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(form)
    expect(mockOnSend).not.toHaveBeenCalled()
  })
})
