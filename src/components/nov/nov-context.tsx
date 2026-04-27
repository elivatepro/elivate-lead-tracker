"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type NovRole = "user" | "assistant" | "system";

export type NovMessage = {
  id: string;
  role: NovRole;
  content: string;
  pending?: boolean;
  // Optional context: leads referenced when the message was sent.
  leadRefs?: { id: string; name: string }[];
  createdAt: number;
};

type SendOptions = {
  leadRefs?: { id: string; name: string }[];
};

type NovContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
  messages: NovMessage[];
  send: (content: string, options?: SendOptions) => void;
  reset: () => void;
  focusInput: () => void;
  registerInputFocuser: (fn: () => void) => () => void;
  isStreaming: boolean;
};

const NovContext = createContext<NovContextValue | null>(null);

const STORAGE_KEY_OPEN = "leadtracker.nov.open";
const STORAGE_KEY_MIN = "leadtracker.nov.minimized";

export function NovProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [minimized, setMinimizedState] = useState(false);
  const [messages, setMessages] = useState<NovMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const inputFocuserRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef<NovMessage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Hydrate state from localStorage.
  useEffect(() => {
    try {
      const o = window.localStorage.getItem(STORAGE_KEY_OPEN);
      if (o === "true") setOpenState(true);
      const m = window.localStorage.getItem(STORAGE_KEY_MIN);
      if (m === "true") setMinimizedState(true);
    } catch {}
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_OPEN, String(next));
    } catch {}
  }, []);

  const setMinimized = useCallback((next: boolean) => {
    setMinimizedState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY_MIN, String(next));
    } catch {}
  }, []);

  const focusInput = useCallback(() => {
    setOpen(true);
    setMinimized(false);
    // Give the panel a frame to mount, then focus.
    requestAnimationFrame(() => {
      inputFocuserRef.current?.();
    });
  }, [setOpen, setMinimized]);

  const registerInputFocuser = useCallback((fn: () => void) => {
    inputFocuserRef.current = fn;
    return () => {
      if (inputFocuserRef.current === fn) inputFocuserRef.current = null;
    };
  }, []);

  const send = useCallback(
    (content: string, options?: SendOptions) => {
      const trimmed = content.trim();
      if (!trimmed) return;

       abortControllerRef.current?.abort();

      if (activeRequestIdRef.current) {
        setMessages((prev) =>
          prev.map((message) =>
            message.pending ? { ...message, pending: false } : message
          )
        );
      }

      const userMsg: NovMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        leadRefs: options?.leadRefs,
        createdAt: Date.now(),
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: NovMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      const requestId = crypto.randomUUID();
      abortControllerRef.current = controller;
      activeRequestIdRef.current = requestId;

      const requestMessages = [...messagesRef.current, userMsg]
        .filter((message) => message.role !== "assistant" || !message.pending)
        .map((message) => ({
          role: message.role,
          content: message.content,
          leadRefs: message.leadRefs,
        }));

      void (async () => {
        try {
          const response = await fetch("/api/nov", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: requestMessages,
              leadRefs: options?.leadRefs ?? [],
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const contentType = response.headers.get("content-type") ?? "";
            const errorText = await response.text();
            const normalizedError =
              contentType.includes("text/html") || /<html|<!doctype/i.test(errorText)
                ? "Nov hit a server error. Check your app env and try again."
                : errorText;

            if (response.status === 401) {
              throw new Error("Please sign in to use Nov.");
            }
            if (response.status === 429) {
              throw new Error("Nov is getting hit pretty hard. Try again in a moment.");
            }
            if (response.status === 500 && normalizedError.includes("OPENAI_API_KEY")) {
              throw new Error(
                "Server AI is not configured yet. Add OPENAI_API_KEY and restart the app."
              );
            }
            throw new Error(normalizedError || "Nov couldn’t respond.");
          }

          if (!response.body) {
            throw new Error("Nov stream unavailable.");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const event of events) {
              const dataLine = event
                .split("\n")
                .find((line) => line.startsWith("data: "));

              if (!dataLine) continue;

              const payload = JSON.parse(dataLine.slice(6)) as {
                type: "delta" | "done" | "error";
                text?: string;
              };

              if (payload.type === "delta") {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? { ...message, content: `${message.content}${payload.text ?? ""}` }
                      : message
                  )
                );
              }

              if (payload.type === "done") {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, pending: false } : message
                  )
                );
              }

              if (payload.type === "error") {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          content:
                            message.content || payload.text || "Nov hit an error while responding.",
                          pending: false,
                        }
                      : message
                  )
                );
              }
            }
          }
        } catch (error) {
          if (controller.signal.aborted) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId ? { ...message, pending: false } : message
              )
            );
            return;
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content:
                      message.content ||
                      (error instanceof Error ? error.message : "Nov hit an unexpected error."),
                    pending: false,
                  }
                : message
            )
          );
        } finally {
          if (activeRequestIdRef.current === requestId) {
            activeRequestIdRef.current = null;
            abortControllerRef.current = null;
            setIsStreaming(false);
          }
        }
      })();
    },
    []
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeRequestIdRef.current = null;
    setIsStreaming(false);
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ⌘J anywhere — open + focus input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        focusInput();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusInput]);

  const value = useMemo<NovContextValue>(
    () => ({
      open,
      setOpen,
      minimized,
      setMinimized,
      messages,
      send,
      reset,
      focusInput,
      registerInputFocuser,
      isStreaming,
    }),
    [open, setOpen, minimized, setMinimized, messages, send, reset, focusInput, registerInputFocuser, isStreaming]
  );

  return <NovContext.Provider value={value}>{children}</NovContext.Provider>;
}

export function useNov() {
  const ctx = useContext(NovContext);
  if (!ctx) throw new Error("useNov must be used within NovProvider");
  return ctx;
}
