"use client";

import { useState, useCallback } from "react";
import type { Conversation, Message } from "@/lib/ai-types";
import { getApiHeaders } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export function useConversations(jobId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/conversations?job_id=${jobId}`, {
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const createConversation = useCallback(async (title?: string): Promise<Conversation | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/conversations`, {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ job_id: jobId, title }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setCurrentConversation(conv);
      return conv;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create conversation");
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const getConversation = useCallback(async (conversationId: string): Promise<Conversation | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/conversations/${conversationId}`, {
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const conv: Conversation = await res.json();
      setCurrentConversation(conv);
      return conv;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/ai/conversations/${conversationId}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setCurrentConversation((prev) => (prev?.id === conversationId ? null : prev));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete conversation");
      return false;
    }
  }, []);

  const updateConversationMessages = useCallback((conversationId: string, messages: Message[]) => {
    setCurrentConversation((prev) => {
      if (prev && prev.id === conversationId) {
        return { ...prev, messages };
      }
      return prev;
    });

    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, message_count: messages.length } : c))
    );
  }, []);

  const addMessageToConversation = useCallback((conversationId: string, message: Message) => {
    setCurrentConversation((prev) => {
      if (prev && prev.id === conversationId) {
        return {
          ...prev,
          messages: [...(prev.messages || []), message],
          message_count: (prev.message_count || 0) + 1,
        };
      }
      return prev;
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, message_count: (c.message_count || 0) + 1 } : c
      )
    );
  }, []);

  return {
    conversations,
    currentConversation,
    loading,
    error,
    fetchConversations,
    createConversation,
    getConversation,
    deleteConversation,
    setCurrentConversation,
    updateConversationMessages,
    addMessageToConversation,
  };
}
