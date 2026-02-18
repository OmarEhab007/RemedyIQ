import { describe, it, expect, beforeEach } from 'vitest'
import { useAIStore } from './ai-store'

// Reset the store to initial state before every test to prevent state leakage
// between tests. Zustand stores are module-level singletons.
beforeEach(() => {
  useAIStore.getState().reset()
})

describe('useAIStore — initial state', () => {
  it('has null activeConversationId', () => {
    expect(useAIStore.getState().activeConversationId).toBeNull()
  })

  it('has isStreaming=false', () => {
    expect(useAIStore.getState().isStreaming).toBe(false)
  })

  it('has empty streamContent', () => {
    expect(useAIStore.getState().streamContent).toBe('')
  })

  it('has null selectedSkill', () => {
    expect(useAIStore.getState().selectedSkill).toBeNull()
  })
})

describe('useAIStore — setConversation', () => {
  it('sets the activeConversationId', () => {
    useAIStore.getState().setConversation('conv-123')
    expect(useAIStore.getState().activeConversationId).toBe('conv-123')
  })

  it('resets isStreaming to false when switching conversations', () => {
    // Start streaming on a conversation
    useAIStore.getState().setConversation('conv-abc')
    useAIStore.getState().startStreaming()
    expect(useAIStore.getState().isStreaming).toBe(true)

    // Switch conversation — streaming must stop
    useAIStore.getState().setConversation('conv-xyz')
    expect(useAIStore.getState().isStreaming).toBe(false)
  })

  it('clears streamContent when switching conversations', () => {
    useAIStore.getState().setConversation('conv-abc')
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('hello')
    expect(useAIStore.getState().streamContent).toBe('hello')

    useAIStore.getState().setConversation('conv-xyz')
    expect(useAIStore.getState().streamContent).toBe('')
  })

  it('accepts null to clear the active conversation', () => {
    useAIStore.getState().setConversation('conv-123')
    useAIStore.getState().setConversation(null)
    expect(useAIStore.getState().activeConversationId).toBeNull()
  })

  it('can be called multiple times with different ids', () => {
    useAIStore.getState().setConversation('conv-1')
    useAIStore.getState().setConversation('conv-2')
    useAIStore.getState().setConversation('conv-3')
    expect(useAIStore.getState().activeConversationId).toBe('conv-3')
  })
})

describe('useAIStore — startStreaming', () => {
  it('sets isStreaming to true', () => {
    useAIStore.getState().startStreaming()
    expect(useAIStore.getState().isStreaming).toBe(true)
  })

  it('clears any existing streamContent', () => {
    // Manually put content in the buffer via appendToken
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('old content')
    expect(useAIStore.getState().streamContent).toBe('old content')

    // Second startStreaming should clear the buffer
    useAIStore.getState().startStreaming()
    expect(useAIStore.getState().streamContent).toBe('')
  })

  it('does not change activeConversationId', () => {
    useAIStore.getState().setConversation('conv-keep')
    useAIStore.getState().startStreaming()
    expect(useAIStore.getState().activeConversationId).toBe('conv-keep')
  })
})

describe('useAIStore — appendToken', () => {
  it('appends a token to an empty streamContent', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('Hello')
    expect(useAIStore.getState().streamContent).toBe('Hello')
  })

  it('concatenates multiple tokens in order', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('Hello')
    useAIStore.getState().appendToken(', ')
    useAIStore.getState().appendToken('world')
    useAIStore.getState().appendToken('!')
    expect(useAIStore.getState().streamContent).toBe('Hello, world!')
  })

  it('handles empty string tokens without breaking state', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('start')
    useAIStore.getState().appendToken('')
    useAIStore.getState().appendToken('end')
    expect(useAIStore.getState().streamContent).toBe('startend')
  })

  it('handles tokens with newlines and whitespace', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('line 1\n')
    useAIStore.getState().appendToken('line 2\n')
    expect(useAIStore.getState().streamContent).toBe('line 1\nline 2\n')
  })
})

describe('useAIStore — stopStreaming', () => {
  it('sets isStreaming to false', () => {
    useAIStore.getState().startStreaming()
    expect(useAIStore.getState().isStreaming).toBe(true)

    useAIStore.getState().stopStreaming()
    expect(useAIStore.getState().isStreaming).toBe(false)
  })

  it('preserves streamContent after stopping', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('final answer')
    useAIStore.getState().stopStreaming()

    expect(useAIStore.getState().streamContent).toBe('final answer')
  })

  it('is a no-op when already not streaming', () => {
    expect(useAIStore.getState().isStreaming).toBe(false)
    useAIStore.getState().stopStreaming()
    expect(useAIStore.getState().isStreaming).toBe(false)
  })
})

describe('useAIStore — setSkill', () => {
  it('sets selectedSkill to the provided slug', () => {
    useAIStore.getState().setSkill('anomaly-detection')
    expect(useAIStore.getState().selectedSkill).toBe('anomaly-detection')
  })

  it('can update selectedSkill to a different slug', () => {
    useAIStore.getState().setSkill('anomaly-detection')
    useAIStore.getState().setSkill('root-cause')
    expect(useAIStore.getState().selectedSkill).toBe('root-cause')
  })

  it('can deselect a skill by passing null', () => {
    useAIStore.getState().setSkill('anomaly-detection')
    useAIStore.getState().setSkill(null)
    expect(useAIStore.getState().selectedSkill).toBeNull()
  })

  it('does not affect other state slices', () => {
    useAIStore.getState().setConversation('conv-123')
    useAIStore.getState().startStreaming()
    useAIStore.getState().setSkill('summarize')

    expect(useAIStore.getState().activeConversationId).toBe('conv-123')
    expect(useAIStore.getState().isStreaming).toBe(true)
    expect(useAIStore.getState().selectedSkill).toBe('summarize')
  })
})

describe('useAIStore — reset', () => {
  it('clears activeConversationId back to null', () => {
    useAIStore.getState().setConversation('conv-xyz')
    useAIStore.getState().reset()
    expect(useAIStore.getState().activeConversationId).toBeNull()
  })

  it('clears isStreaming back to false', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().reset()
    expect(useAIStore.getState().isStreaming).toBe(false)
  })

  it('clears streamContent back to empty string', () => {
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('some tokens')
    useAIStore.getState().reset()
    expect(useAIStore.getState().streamContent).toBe('')
  })

  it('clears selectedSkill back to null', () => {
    useAIStore.getState().setSkill('anomaly-detection')
    useAIStore.getState().reset()
    expect(useAIStore.getState().selectedSkill).toBeNull()
  })

  it('resets all state at once from a fully-populated store', () => {
    useAIStore.getState().setConversation('conv-full')
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('partial')
    useAIStore.getState().setSkill('root-cause')

    useAIStore.getState().reset()

    const state = useAIStore.getState()
    expect(state.activeConversationId).toBeNull()
    expect(state.isStreaming).toBe(false)
    expect(state.streamContent).toBe('')
    expect(state.selectedSkill).toBeNull()
  })
})

describe('useAIStore — conversation switching resets streaming', () => {
  it('clears an in-progress stream when switching to a new conversation', () => {
    useAIStore.getState().setConversation('conv-a')
    useAIStore.getState().startStreaming()
    useAIStore.getState().appendToken('partial response...')

    useAIStore.getState().setConversation('conv-b')

    expect(useAIStore.getState().activeConversationId).toBe('conv-b')
    expect(useAIStore.getState().isStreaming).toBe(false)
    expect(useAIStore.getState().streamContent).toBe('')
  })

  it('preserves selectedSkill when switching conversations', () => {
    useAIStore.getState().setSkill('summarize')
    useAIStore.getState().setConversation('conv-a')
    useAIStore.getState().setConversation('conv-b')
    expect(useAIStore.getState().selectedSkill).toBe('summarize')
  })
})
