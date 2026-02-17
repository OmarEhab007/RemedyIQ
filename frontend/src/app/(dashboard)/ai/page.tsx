"use client";

import { Suspense, useEffect, useRef, useState, useCallback, Component, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAIStream } from "@/hooks/use-ai-stream";
import { useConversations } from "@/hooks/use-conversations";
import { ChatPanel } from "@/components/ai/chat-panel";
import { SkillSelector } from "@/components/ai/skill-selector";
import { ConversationList } from "@/components/ai/conversation-list";
import type { Message, Skill } from "@/lib/ai-types";
import { API_BASE, getApiHeaders } from "@/lib/api";

class ChatErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-6">
            <p className="text-destructive mb-4">Something went wrong in the chat</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onReset(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AIPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading AI assistant...</div>}>
      <AIContent />
    </Suspense>
  );
}

function AIContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const jobId = searchParams.get("job_id") || "";
  const conversationIdParam = searchParams.get("conversation_id");

  const [messages, setMessages] = useState<Message[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState("auto");
  const [error, setError] = useState<string | null>(null);

  const {
    conversations,
    currentConversation,
    loading: conversationsLoading,
    fetchConversations,
    createConversation,
    getConversation,
    deleteConversation,
    addMessageToConversation,
  } = useConversations(jobId);

  const activeConversationId = currentConversation?.id || null;

  const handleNewMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
    if (message.conversation_id) {
      addMessageToConversation(message.conversation_id, message);
    }
  }, [addMessageToConversation]);

  const handleStreamError = useCallback((err: string) => {
    setError(err);
  }, []);

  const { streamState, streamQuery, stopStreaming } = useAIStream({
    jobId,
    onMessage: handleNewMessage,
    onError: handleStreamError,
  });

  useEffect(() => {
    async function fetchSkills() {
      try {
        const res = await fetch(`${API_BASE}/ai/skills`, { headers: getApiHeaders() });
        if (res.ok) {
          const data = await res.json();
          setSkills(data.skills || []);
        }
      } catch {
        // Skills listing is optional
      }
    }
    fetchSkills();
  }, []);

  useEffect(() => {
    if (jobId) {
      fetchConversations();
    }
  }, [jobId, fetchConversations]);

  // Refresh conversation list after streaming completes (backend creates conversation during stream)
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !streamState.isStreaming) {
      fetchConversations();
    }
    prevStreamingRef.current = streamState.isStreaming;
  }, [streamState.isStreaming, fetchConversations]);

  useEffect(() => {
    if (conversationIdParam && (!currentConversation || currentConversation.id !== conversationIdParam)) {
      getConversation(conversationIdParam).then((conv) => {
        if (conv && conv.messages) {
          setMessages(conv.messages);
        }
      });
    }
  }, [conversationIdParam, currentConversation, getConversation]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      getConversation(id).then((conv) => {
        if (conv) {
          setMessages(conv.messages || []);
          router.push(`${pathname}?job_id=${jobId}&conversation_id=${id}`);
        }
      });
    },
    [getConversation, jobId, pathname, router]
  );

  const handleCreateConversation = useCallback(async () => {
    const conv = await createConversation();
    if (conv) {
      setMessages([]);
      router.push(`${pathname}?job_id=${jobId}&conversation_id=${conv.id}`);
    }
  }, [createConversation, jobId, pathname, router]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (currentConversation?.id === id) {
        setMessages([]);
        router.push(`${pathname}?job_id=${jobId}`);
      }
    },
    [deleteConversation, currentConversation, jobId, pathname, router]
  );

  const handleSend = useCallback(
    (query: string) => {
      setError(null);

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        conversation_id: currentConversation?.id || "",
        role: "user",
        content: query,
        status: "complete",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const skillName = selectedSkill === "auto" ? undefined : selectedSkill;
      const convId = currentConversation?.id;

      void streamQuery(query, {
        skillName,
        autoRoute: selectedSkill === "auto",
        conversationId: convId,
      });
    },
    [selectedSkill, streamQuery, currentConversation]
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-muted-foreground gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-lg font-medium">No Analysis Selected</p>
        <p className="text-sm">Select or upload a log analysis to use the AI assistant</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-64 border-r p-4 space-y-6 hidden lg:block overflow-y-auto">
        <div>
          <h3 className="text-sm font-semibold mb-2">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Ask questions about your log analysis.</p>
        </div>

        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onCreate={handleCreateConversation}
          onDelete={handleDeleteConversation}
          loading={conversationsLoading}
        />

        <SkillSelector skills={skills} selected={selectedSkill} onSelect={setSelectedSkill} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="p-3 m-4 bg-destructive/10 text-destructive rounded-md text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">✕</button>
          </div>
        )}
        <ChatErrorBoundary onReset={handleReset}>
          <ChatPanel
            messages={messages}
            streamState={streamState}
            onSend={handleSend}
            onStop={stopStreaming}
          />
        </ChatErrorBoundary>
      </div>
    </div>
  );
}
