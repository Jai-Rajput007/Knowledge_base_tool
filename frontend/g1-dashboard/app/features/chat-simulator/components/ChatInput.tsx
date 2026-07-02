import React from "react";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  sendMessage: (prompt?: string) => void;
}

export function ChatInput({ input, setInput, isLoading, sendMessage }: ChatInputProps) {
  return (
    <div className="p-4 border-t border-border">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask anything about your documents... (Shift+Enter for new line)"
          rows={1}
          className="w-full px-4 py-3 pr-24 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          style={{ minHeight: "56px", maxHeight: "200px" }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">{input.length} chars</span>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
