"use client";

import { Sparkles } from "lucide-react";
import { useNov } from "./nov-context";

// Floating launcher: shown bottom-right when Nov is closed or minimized.
// On desktop it reopens the rail; on mobile it opens the overlay.
export function NovLauncher() {
  const { open, minimized, setOpen, setMinimized, focusInput, messages, isStreaming } = useNov();

  // Hide when an open, non-minimized rail is already taking the space.
  if (open && !minimized) return null;

  function activate() {
    setOpen(true);
    setMinimized(false);
    focusInput();
  }

  return (
    <button
      type="button"
      onClick={activate}
      className="fixed bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-[3px] border border-line bg-ink px-3 py-2 text-[12px] font-medium text-paper shadow-[0_10px_30px_rgba(20,16,12,0.25)] transition-colors hover:bg-ink-2 sm:bottom-4 sm:right-4"
      aria-label="Open Nov"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-[2px] bg-ember">
        <Sparkles className="h-3 w-3 text-white" />
      </span>
      <span>Nov</span>
      {isStreaming && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
      )}
      {!isStreaming && messages.length > 0 && (
        <span className="numeric rounded-[2px] bg-paper/15 px-1 text-[10px] font-medium text-paper/70">
          {messages.filter((m) => m.role === "assistant" && !m.pending).length}
        </span>
      )}
      <kbd className="numeric hidden border-paper/20 bg-paper/10 text-paper/70 sm:inline-flex">⌘J</kbd>
    </button>
  );
}
