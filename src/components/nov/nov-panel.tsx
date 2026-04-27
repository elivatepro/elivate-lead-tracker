"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  GripVertical,
  Minimize2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useNov, type NovMessage } from "./nov-context";

type Variant = "rail" | "overlay";

const PANEL_WIDTH_KEY = "leadtracker.nov.width";
const PANEL_HEIGHT_KEY = "leadtracker.nov.height";
const DEFAULT_DESKTOP_WIDTH = 360;
const DEFAULT_MOBILE_HEIGHT = 560;
const MIN_DESKTOP_WIDTH = 320;
const MAX_DESKTOP_WIDTH = 640;
const MIN_MOBILE_HEIGHT = 420;
const THINKING_PHASES = [
  [
    "Heh, gimme a sec here",
    "I'm pokin' around the leads",
    "Hang on, I'm doin' the thing",
    "I'm shufflin' through the pipeline here",
    "Lemme find the good stuff",
    "I'm diggin' for the useful bits",
    "Hold up, I'm gettin' the angle",
    "This is like, a whole lead situation",
  ],
  [
    "Cookin' up a follow-up",
    "Alright, alright, drafting it now",
    "I'm buildin' a pretty solid opener",
    "Just puttin' the message together real nice",
    "I'm workin' the lead magic here",
    "Lemme squeeze a decent message outta this",
    "Alright, this follow-up's gotta sing",
    "I'm gettin' the follow-up vibes right",
  ],
  [
    "Gonna make this sound wicked smart",
    "Lemme not embarrass us with a bad draft",
    "I'm tryin' to make this sound like you got it together",
    "This draft's gonna be a beaut",
    "Just tunin' the message so it lands",
    "I'm making this less awkward than usual",
    "This is where I do the clever part",
    "I'm lining up something sendable",
  ],
];

function getInitialPanelWidth() {
  if (typeof window === "undefined") return DEFAULT_DESKTOP_WIDTH;

  const savedWidth = Number(window.localStorage.getItem(PANEL_WIDTH_KEY));
  if (!Number.isFinite(savedWidth)) return DEFAULT_DESKTOP_WIDTH;

  return Math.min(MAX_DESKTOP_WIDTH, Math.max(MIN_DESKTOP_WIDTH, savedWidth));
}

function getInitialPanelHeight() {
  if (typeof window === "undefined") return DEFAULT_MOBILE_HEIGHT;

  const savedHeight = Number(window.localStorage.getItem(PANEL_HEIGHT_KEY));
  if (!Number.isFinite(savedHeight)) return DEFAULT_MOBILE_HEIGHT;

  return Math.max(MIN_MOBILE_HEIGHT, savedHeight);
}

export function NovPanel({ variant }: { variant: Variant }) {
  const {
    open,
    setOpen,
    minimized,
    setMinimized,
    messages,
    send,
    reset,
    registerInputFocuser,
    isStreaming,
  } = useNov();

  const [draft, setDraft] = useState("");
  const [contextLead, setContextLead] = useState<{ id: string; name: string } | null>(null);
  const [panelWidth, setPanelWidth] = useState(getInitialPanelWidth);
  const [panelHeight, setPanelHeight] = useState(getInitialPanelHeight);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    mode: "width" | "height";
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Register the input-focuser so ⌘J works.
  useEffect(() => {
    return registerInputFocuser(() => {
      inputRef.current?.focus();
    });
  }, [registerInputFocuser]);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  // Auto-grow textarea.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      if (dragState.mode === "width") {
        const nextWidth = dragState.startWidth + (dragState.startX - event.clientX);
        const clampedWidth = Math.min(MAX_DESKTOP_WIDTH, Math.max(MIN_DESKTOP_WIDTH, nextWidth));
        setPanelWidth(clampedWidth);
        try {
          window.localStorage.setItem(PANEL_WIDTH_KEY, String(clampedWidth));
        } catch {}
        return;
      }

      const viewportHeight = window.innerHeight;
      const nextHeight = dragState.startHeight + (dragState.startY - event.clientY);
      const clampedHeight = Math.min(
        viewportHeight - 72,
        Math.max(MIN_MOBILE_HEIGHT, nextHeight)
      );
      setPanelHeight(clampedHeight);
      try {
        window.localStorage.setItem(PANEL_HEIGHT_KEY, String(clampedHeight));
      } catch {}
    };

    const stopDragging = () => {
      dragStateRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, []);

  function submit() {
    if (!draft.trim()) return;
    send(draft, contextLead ? { leadRefs: [contextLead] } : undefined);
    setDraft("");
  }

  // The overlay renders only when explicitly opened (mobile); the rail
  // renders inline whenever NovPanel is mounted by the layout.
  if (variant === "overlay" && !open) return null;
  if (variant === "rail" && (!open || minimized)) {
    return null;
  }

  const isOverlay = variant === "overlay";

  const containerClass = isOverlay
    ? "fixed inset-x-2 bottom-2 z-50 flex flex-col overflow-hidden rounded-[6px] border border-line bg-card shadow-[0_30px_80px_rgba(20,16,12,0.32)] sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-[min(92vw,460px)]"
    : "relative hidden xl:flex xl:flex-col xl:border-l xl:border-line xl:bg-card";

  const panelStyle = isOverlay
    ? ({ height: `min(calc(100dvh - 80px), ${panelHeight}px)` } satisfies CSSProperties)
    : ({ width: `${panelWidth}px` } satisfies CSSProperties);

  const startWidthDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      mode: "width",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelWidth,
      startHeight: panelHeight,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  };

  const startHeightDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      mode: "height",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelWidth,
      startHeight: panelHeight,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
  };

  return (
    <>
      {isOverlay && (
        <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}
      <aside className={containerClass} style={panelStyle}>
        {isOverlay ? (
          <button
            type="button"
            aria-label="Resize Nov"
            onPointerDown={startHeightDrag}
            className="flex h-6 w-full cursor-ns-resize items-center justify-center bg-paper-2/50 text-ink-4"
          >
            <span className="h-1.5 w-12 rounded-full bg-line-2" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Resize Nov"
            onPointerDown={startWidthDrag}
            className="absolute inset-y-0 left-0 z-10 hidden w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center text-ink-4 xl:flex"
          >
            <GripVertical className="h-4 w-4 rounded-full bg-card shadow-sm" />
          </button>
        )}
        {/* header */}
        <header className="flex items-center justify-between gap-3 border-b border-line/70 bg-paper-2/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-ember text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold leading-tight text-ink">Nov</p>
              <p className="text-[10px] leading-tight text-ink-4">AI lead agent · Live</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                title="New conversation"
                className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-4 hover:bg-paper-2 hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {!isOverlay && (
              <button
                type="button"
                onClick={() => setMinimized(true)}
                title="Minimize"
                className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-4 hover:bg-paper-2 hover:text-ink"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              title={isOverlay ? "Close" : "Close rail"}
              className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-4 hover:bg-paper-2 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          {messages.length === 0 ? (
            <div className="h-full min-h-24" />
          ) : (
            <div className="space-y-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="border-t border-line/70 bg-paper-2/30 px-3 py-2.5">
          {contextLead && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-white px-2 py-1 text-[11px] text-ink-2">
              <span className="font-medium">@{contextLead.name}</span>
              <button
                type="button"
                onClick={() => setContextLead(null)}
                className="text-ink-4 hover:text-ink"
                aria-label="Remove lead context"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-[3px] border border-line bg-card px-2.5 py-2 focus-within:border-ember/50">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask Nov to draft, summarize, or surface…"
              className="flex-1 resize-none bg-transparent text-[13px] leading-5 text-ink placeholder:text-ink-4 focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ink text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-line-2 disabled:text-ink-4"
              title="Send (⏎)"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 flex items-center justify-between text-[10px] text-ink-4">
            <span>
              <kbd>⏎</kbd> send · <kbd>⇧⏎</kbd> newline
            </span>
            {!isOverlay ? <span className="font-display italic">drag to resize</span> : null}
          </p>
        </div>
      </aside>
    </>
  );
}

function MessageBubble({ message }: { message: NovMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[3px] border border-ember/20 bg-ember-tint/60 px-3 py-2 text-[13px] leading-5 text-ink">
          {message.leadRefs && message.leadRefs.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {message.leadRefs.map((ref) => (
                <span
                  key={ref.id}
                  className="rounded-[2px] border border-ember/30 bg-white px-1.5 py-px text-[10px] font-medium text-ember"
                >
                  @{ref.name}
                </span>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-ember text-white">
        <Sparkles className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <AssistantMessageContent message={message} />
      </div>
    </div>
  );
}

function AssistantMessageContent({ message }: { message: NovMessage }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(
    () => Math.floor(Math.random() * THINKING_PHASES[0].length)
  );

  useEffect(() => {
    if (!message.pending || message.content.length > 0) return;

    const interval = window.setInterval(() => {
      setPhaseIndex((currentPhase) => {
        setPhraseIndex((currentPhrase) => {
          const phrases = THINKING_PHASES[currentPhase];
          return (currentPhrase + 1) % phrases.length;
        });

        if (Math.random() < 0.45) {
          return currentPhase;
        }

        return Math.min(currentPhase + 1, THINKING_PHASES.length - 1);
      });
    }, 1200);

    return () => window.clearInterval(interval);
  }, [message.pending, message.content.length]);

  const phrases = THINKING_PHASES[phaseIndex];
  const phrase = phrases[phraseIndex] ?? THINKING_PHASES[0][0];

  return (
    <div className="space-y-1">
      {message.content.length > 0 ? (
        <p className="whitespace-pre-wrap text-[13px] leading-5 text-ink-2 transition-all duration-200 ease-out">
          {message.content}
          {message.pending && (
            <span className="ml-1 inline-flex items-center gap-1 align-middle text-ember">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
              <span className="text-[11px] text-ink-4">writing</span>
            </span>
          )}
        </p>
      ) : null}

      {message.pending && message.content.length === 0 ? (
        <div className="rounded-[3px] bg-paper-2/45 px-3 py-2 text-[12px] text-ink-4">
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember" />
            </span>
            <span className="font-medium text-ink-2 transition-opacity duration-300">
              {phrase}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
