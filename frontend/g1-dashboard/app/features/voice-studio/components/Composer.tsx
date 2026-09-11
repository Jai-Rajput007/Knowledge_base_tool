"use client";

import { useRef, useState } from "react";
import { FileText, ListPlus, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_TOTAL_CHARS, MAX_TXT_FILE_BYTES } from "../constants";

interface Props {
  busy: boolean;
  onSpeak: (text: string, source: string) => void;
  onAddToPlaylist: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * Free-text box. Type (or load a .txt script into it), then Speak — the robot reads it
 * in the selected language with the voice from Settings -> Voice. Ctrl/Cmd+Enter speaks.
 */
export function Composer({ busy, onSpeak, onAddToPlaylist, onError }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<{ name: string; lines: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  const tooLong = text.length > MAX_TOTAL_CHARS;

  const loadFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".txt") || (f.type && f.type !== "text/plain")) {
      onError(`"${f.name}" is not a .txt file. Only plain-text scripts can be uploaded.`);
      return;
    }
    if (f.size > MAX_TXT_FILE_BYTES) {
      onError(`"${f.name}" is ${(f.size / 1024).toFixed(0)} KB — scripts can be at most ${MAX_TXT_FILE_BYTES / 1024} KB.`);
      return;
    }
    const content = (await f.text()).replace(/\r\n/g, "\n").trim();
    if (!content) {
      onError(`"${f.name}" is empty.`);
      return;
    }
    setText(content);
    setFile({ name: f.name, lines: content.split("\n").filter((l) => l.trim()).length });
  };

  const speak = () => {
    if (!trimmed || tooLong || busy) return;
    onSpeak(trimmed, file ? file.name : "Typed text");
  };

  return (
    <section className="rounded-2xl border border-border bg-card/40 flex flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-foreground">Say something</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Type a line or load a script, then send it to the robot.</p>
        </div>
      </header>

      {file && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{file.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground shrink-0">{file.lines} lines</span>
          <button
            type="button"
            onClick={() => { setFile(null); setText(""); }}
            aria-label="Remove script"
            className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="px-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              speak();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const f = e.dataTransfer.files?.[0];
            if (f) { e.preventDefault(); loadFile(f); }
          }}
          rows={9}
          placeholder="Good morning! Welcome to the lab. Today I'll show you around…"
          className="w-full resize-y min-h-[180px] rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50"
        />
      </div>

      <footer className="flex items-center gap-2 px-5 py-4 flex-wrap">
        <input
          ref={fileInput}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          title="Upload a .txt script"
          aria-label="Upload a .txt script"
          className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <span
          className={cn(
            "font-mono text-[10px] tabular-nums uppercase tracking-widest",
            tooLong ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {text.length.toLocaleString()} / {MAX_TOTAL_CHARS.toLocaleString()}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => { onAddToPlaylist(trimmed); setText(""); setFile(null); }}
            disabled={!trimmed || tooLong}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ListPlus className="h-4 w-4" /> Add to playlist
          </button>
          <button
            type="button"
            onClick={speak}
            disabled={!trimmed || tooLong || busy}
            title="Speak (Ctrl+Enter)"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" /> Speak
          </button>
        </div>
      </footer>
    </section>
  );
}
