"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/ai-types";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  loading,
}: ConversationListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onCreate}
        className="w-full px-3 py-2 text-sm border rounded-md hover:bg-muted transition-colors flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New conversation
      </button>

      {conversations.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                activeId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {conv.title || "Untitled conversation"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conv.message_count || 0} messages
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(conv.id, e)}
                className={cn(
                  "p-1 rounded transition-colors",
                  confirmDelete === conv.id
                    ? "bg-destructive text-destructive-foreground"
                    : "opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10"
                )}
                title={confirmDelete === conv.id ? "Click again to delete" : "Delete"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
