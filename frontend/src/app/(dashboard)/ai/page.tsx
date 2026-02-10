"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAI } from "@/hooks/use-ai";
import { ChatPanel } from "@/components/ai/chat-panel";
import { SkillSelector } from "@/components/ai/skill-selector";

export default function AIPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job") || "default";
  const { messages, loading, error, skills, sendMessage, clearMessages, fetchSkills } = useAI(jobId);
  const [selectedSkill, setSelectedSkill] = useState("nl_query");

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r p-4 space-y-6 hidden lg:block">
        <div>
          <h3 className="text-sm font-semibold mb-2">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">
            Ask questions about your log analysis using natural language.
          </p>
        </div>
        <SkillSelector
          skills={skills}
          selected={selectedSkill}
          onSelect={setSelectedSkill}
        />
        <button
          onClick={clearMessages}
          className="w-full px-3 py-1.5 text-xs border rounded hover:bg-muted transition-colors"
        >
          Clear conversation
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="p-3 m-4 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        <ChatPanel
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          selectedSkill={selectedSkill}
        />
      </div>
    </div>
  );
}
