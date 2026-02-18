'use client'

/**
 * ai-store.ts — Zustand v5 store for AI Assistant UI state.
 *
 * Manages the active conversation, streaming state, accumulated token buffer,
 * and the selected AI skill. Kept separate from server state (React Query) so
 * streaming and ephemeral UI state never cause cache invalidation.
 *
 * Usage:
 *   const isStreaming = useAIStore((s) => s.isStreaming)
 *   const streamContent = useAIStore((s) => s.streamContent)
 *
 *   // Start streaming a response
 *   useAIStore.getState().startStreaming()
 *   useAIStore.getState().appendToken(chunk)
 *   useAIStore.getState().stopStreaming()
 *
 *   // Switch conversation
 *   useAIStore.getState().setConversation(conversationId)
 */

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIState {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * The ID of the conversation currently open in the panel.
   * Null when no conversation is selected (empty / new chat state).
   */
  activeConversationId: string | null

  /**
   * True while the server is streaming a response token-by-token.
   * Used to show a loading indicator and disable the send button.
   */
  isStreaming: boolean

  /**
   * Accumulated text of the in-progress streamed response.
   * Reset to '' when streaming stops or when switching conversations.
   */
  streamContent: string

  /**
   * The skill slug currently selected in the skill selector UI.
   * Null means the default (general) assistant.
   */
  selectedSkill: string | null

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Set or clear the active conversation. Resets streaming state. */
  setConversation: (id: string | null) => void

  /** Mark the beginning of a streaming response. Clears any previous buffer. */
  startStreaming: () => void

  /** Append a single token chunk to the stream buffer. */
  appendToken: (token: string) => void

  /** Mark the end of a streaming response. */
  stopStreaming: () => void

  /** Select or deselect an AI skill. */
  setSkill: (skill: string | null) => void

  /**
   * Reset all state to initial values.
   * Call when navigating away from the AI page or signing out.
   */
  reset: () => void
}

// ---------------------------------------------------------------------------
// Initial state snapshot (used by reset())
// ---------------------------------------------------------------------------

const initialState: Pick<
  AIState,
  'activeConversationId' | 'isStreaming' | 'streamContent' | 'selectedSkill'
> = {
  activeConversationId: null,
  isStreaming: false,
  streamContent: '',
  selectedSkill: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAIStore = create<AIState>()((set) => ({
  ...initialState,

  setConversation: (id) =>
    set({
      activeConversationId: id,
      // Clear any in-progress stream when switching conversations
      isStreaming: false,
      streamContent: '',
    }),

  startStreaming: () =>
    set({
      isStreaming: true,
      streamContent: '',
    }),

  appendToken: (token) =>
    set((state) => ({
      streamContent: state.streamContent + token,
    })),

  stopStreaming: () =>
    set({
      isStreaming: false,
    }),

  setSkill: (skill) => set({ selectedSkill: skill }),

  reset: () => set({ ...initialState }),
}))
