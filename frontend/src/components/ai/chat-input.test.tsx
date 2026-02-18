/**
 * Tests for ChatInput component.
 *
 * Covers: rendering, submit on Enter, newline on Shift+Enter,
 * disabled state, stop button, submit button state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './chat-input'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(props: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const onSubmit = vi.fn()
  const onStop = vi.fn()
  const user = userEvent.setup()

  const result = render(
    <ChatInput
      onSubmit={onSubmit}
      onStop={onStop}
      {...props}
    />,
  )
  return { onSubmit, onStop, user, ...result }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the textarea', () => {
    setup()
    expect(screen.getByRole('textbox', { name: /message input/i })).toBeInTheDocument()
  })

  it('renders the send button', () => {
    setup()
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('displays the default placeholder', () => {
    setup()
    expect(screen.getByPlaceholderText(/ask about your logs/i)).toBeInTheDocument()
  })

  it('displays a custom placeholder', () => {
    setup({ placeholder: 'Type something…' })
    expect(screen.getByPlaceholderText('Type something…')).toBeInTheDocument()
  })

  it('calls onSubmit with the trimmed message on Enter', async () => {
    const { user, onSubmit } = setup()
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello world')
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('Hello world')
  })

  it('does not call onSubmit on Shift+Enter', async () => {
    const { user, onSubmit } = setup()
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears the textarea after submit', async () => {
    const { user } = setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.type(textarea, 'Test message')
    await user.keyboard('{Enter}')
    expect(textarea.value).toBe('')
  })

  it('does not call onSubmit when textarea is empty', async () => {
    const { user, onSubmit } = setup()
    const textarea = screen.getByRole('textbox')
    await user.click(textarea)
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not call onSubmit when disabled', async () => {
    const { user, onSubmit } = setup({ disabled: true })
    const textarea = screen.getByRole('textbox')
    // Textarea is disabled so typing should not work
    expect(textarea).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables textarea and shows stop button during streaming', () => {
    setup({ isStreaming: true })
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
  })

  it('calls onStop when stop button is clicked', async () => {
    const { user, onStop } = setup({ isStreaming: true })
    await user.click(screen.getByRole('button', { name: /stop/i }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('send button is disabled when textarea is empty', () => {
    setup()
    expect(screen.getByRole('button', { name: /send message/i })).toHaveAttribute('aria-disabled', 'true')
  })

  it('send button is enabled when textarea has content', async () => {
    const { user } = setup()
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'some text')
    expect(screen.getByRole('button', { name: /send message/i })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('shows streaming placeholder when streaming', () => {
    setup({ isStreaming: true })
    expect(screen.getByPlaceholderText(/waiting for response/i)).toBeInTheDocument()
  })

  it('shows "Shift+Enter for newline" hint', () => {
    setup()
    expect(screen.getByText(/shift\+enter for newline/i)).toBeInTheDocument()
  })
})
