"use client";

import { useCallback, useRef, useState } from "react";
import type { StreamState, Message } from "@/lib/ai-types";
import { API_BASE, getApiHeaders } from "@/lib/api";

interface UseAIStreamOptions {
  jobId: string;
  onMessage?: (message: Message) => void;
  onError?: (error: string) => void;
}

export function useAIStream({ jobId, onMessage, onError }: UseAIStreamOptions) {
  const [streamState, setStreamState] = useState<StreamState>({
    conversationId: null,
    messageId: null,
    skillName: null,
    content: "",
    tokensUsed: 0,
    latencyMs: 0,
    followUps: [],
    isStreaming: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const streamQuery = useCallback(
    async (query: string, options?: { skillName?: string; conversationId?: string; autoRoute?: boolean }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setStreamState({
        conversationId: null,
        messageId: null,
        skillName: null,
        content: "",
        tokensUsed: 0,
        latencyMs: 0,
        followUps: [],
        isStreaming: true,
        error: null,
      });

      try {
        const response = await fetch(`${API_BASE}/ai/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getApiHeaders(),
          },
          body: JSON.stringify({
            query,
            job_id: jobId,
            conversation_id: options?.conversationId,
            skill_name: options?.skillName,
            auto_route: options?.autoRoute ?? true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let currentContent = "";
        const currentState: StreamState = {
          conversationId: null,
          messageId: null,
          skillName: null,
          content: "",
          tokensUsed: 0,
          latencyMs: 0,
          followUps: [],
          isStreaming: true,
          error: null,
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              continue;
            }
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);

                if (event.conversation_id) {
                  currentState.conversationId = event.conversation_id;
                  currentState.messageId = event.message_id;
                }
                if (event.skill_name) {
                  currentState.skillName = event.skill_name;
                }
                if (event.text) {
                  currentContent += event.text;
                  currentState.content = currentContent;
                }
                if (event.tokens_used !== undefined) {
                  currentState.tokensUsed = event.tokens_used;
                  currentState.latencyMs = event.latency_ms;
                  currentState.skillName = event.skill_name;
                }
                if (event.follow_ups) {
                  currentState.followUps = event.follow_ups;
                }
                if (event.message && event.code) {
                  currentState.error = event.message;
                  currentState.isStreaming = false;
                  onError?.(event.message);
                }

                setStreamState({ ...currentState });
              } catch {
                // Skip unparseable lines
              }
            }
          }
        }

        if (currentState.content && currentState.messageId) {
          onMessage?.({
            id: currentState.messageId,
            conversation_id: currentState.conversationId || "",
            role: "assistant",
            content: currentState.content,
            skill_name: currentState.skillName || undefined,
            follow_ups: currentState.followUps,
            tokens_used: currentState.tokensUsed,
            latency_ms: currentState.latencyMs,
            status: "complete",
            created_at: new Date().toISOString(),
          });
        }

        currentState.isStreaming = false;
        setStreamState({ ...currentState });

        return currentState;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Stream failed";
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setStreamState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }));
        onError?.(errorMessage);
      }
    },
    [jobId, onMessage, onError]
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamState((prev) => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  return {
    streamState,
    streamQuery,
    stopStreaming,
  };
}
