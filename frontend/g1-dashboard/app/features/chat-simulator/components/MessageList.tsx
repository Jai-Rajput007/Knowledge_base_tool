import React from "react";
import { Message } from "../types";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface MessageListProps {
  messages: Message[];
  showSources: string | null;
  setShowSources: (id: string | null) => void;
  sendMessage: (prompt: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const suggestedPrompts = [
  "Summarize my documents",
  "What are the key insights?",
  "Find related topics",
  "Explain the technical architecture",
  "Compare different approaches",
];

export function MessageList({ messages, showSources, setShowSources, sendMessage, messagesEndRef }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-card-foreground mb-2">Start a conversation</h3>
          <p className="text-muted-foreground max-w-sm">
            Ask questions about your documents and get AI-powered answers with source citations
          </p>
          <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-md">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(prompt)}
                className="px-4 py-2 bg-accent text-accent-foreground rounded-full text-sm hover:opacity-80 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] space-y-3",
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border text-card-foreground rounded-bl-md"
              )}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
                )}
              </div>

              {msg.role === "assistant" && msg.sources && !msg.isStreaming && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent rounded-full text-xs text-accent-foreground hover:opacity-80 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {msg.sources.length} Sources
                    <svg className={cn("w-3 h-3 transition-transform", showSources === msg.id && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {showSources === msg.id && msg.sources && (
                <div className="mt-2 space-y-2">
                  {msg.sources.map((source) => (
                    <div key={source.id} className="bg-accent/50 rounded-xl p-3 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {source.document}
                          {source.page && <span className="text-muted-foreground">• Page {source.page}</span>}
                        </span>
                        <span className="text-xs text-green-600 font-medium">{(source.score * 100).toFixed(0)}% match</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{source.excerpt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
