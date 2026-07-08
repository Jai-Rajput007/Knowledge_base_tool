import React from "react";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface ChatSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: ChatSidebarProps) {
  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Previous Chats
        </h3>
        
        {sessions.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No previous chats
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors",
                activeSessionId === session.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex-1 truncate text-sm">
                {session.title || "New Chat"}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity"
                title="Delete chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
