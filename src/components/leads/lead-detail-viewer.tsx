"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, PanelRight, Square, X } from "lucide-react";
import { LeadDetailContent } from "./lead-detail-content";

export type LeadPeekMode = "side" | "center" | "full";

const PEEK_MODES: LeadPeekMode[] = ["side", "center", "full"];
const STORAGE_KEY = "leadtracker.lead-detail.mode";
const URL_PARAM = "lead";
const MOBILE_QUERY = "(max-width: 767px)";

function isPeekMode(value: unknown): value is LeadPeekMode {
  return typeof value === "string" && (PEEK_MODES as string[]).includes(value);
}

function readStoredMode(): LeadPeekMode {
  if (typeof window === "undefined") return "side";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isPeekMode(raw)) return raw;
  } catch {
    /* localStorage unavailable */
  }
  return "side";
}

type Ctx = {
  mode: LeadPeekMode;
  setMode: (mode: LeadPeekMode) => void;
  openLead: (leadId: string, event?: MouseEvent) => void;
  closePeek: () => void;
};

const LeadDetailContext = createContext<Ctx | null>(null);

export function useLeadDetail() {
  const ctx = useContext(LeadDetailContext);
  if (!ctx) {
    throw new Error("useLeadDetail must be used within <LeadDetailProvider>");
  }
  return ctx;
}

export function LeadDetailProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<LeadPeekMode>("side");
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Subscribe to the mobile breakpoint. The subscription callback is what
  // primes both `mounted` and `isMobile` — keeping setState out of the
  // effect body itself satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (matches: boolean) => {
      setIsMobile(matches);
      setMounted(true);
      setModeState(readStoredMode());
    };
    const onChange = (e: MediaQueryListEvent) => update(e.matches);
    update(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: LeadPeekMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const peekLeadId = searchParams.get(URL_PARAM);

  const closePeek = useCallback(() => {
    if (!peekLeadId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete(URL_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [peekLeadId, pathname, router, searchParams]);

  const openLead = useCallback(
    (leadId: string, event?: MouseEvent) => {
      // ⌘/Ctrl/Shift/middle-click → let the browser handle the link normally.
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1)) {
        return;
      }
      event?.preventDefault();

      const effectiveMode: LeadPeekMode = isMobile ? "full" : mode;

      if (effectiveMode === "full") {
        router.push(`/leads/${leadId}`);
        return;
      }

      const next = new URLSearchParams(searchParams.toString());
      next.set(URL_PARAM, leadId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [isMobile, mode, pathname, router, searchParams]
  );

  // Close peek with Escape.
  useEffect(() => {
    if (!peekLeadId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePeek();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peekLeadId, closePeek]);

  // If mode flips to "full" while a peek is open, navigate to the route.
  useEffect(() => {
    if (!peekLeadId) return;
    if (mode === "full" || isMobile) {
      const targetId = peekLeadId;
      closePeek();
      router.push(`/leads/${targetId}`);
    }
  }, [mode, isMobile, peekLeadId, closePeek, router]);

  // Lock body scroll while peek is open.
  useEffect(() => {
    if (!peekLeadId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [peekLeadId]);

  const value = useMemo<Ctx>(
    () => ({ mode, setMode, openLead, closePeek }),
    [mode, setMode, openLead, closePeek]
  );

  const showPeek = mounted && peekLeadId && !isMobile && mode !== "full";

  return (
    <LeadDetailContext.Provider value={value}>
      {children}
      {showPeek
        ? createPortal(
            <LeadPeekShell
              leadId={peekLeadId}
              mode={mode}
              setMode={setMode}
              onClose={closePeek}
            />,
            document.body
          )
        : null}
    </LeadDetailContext.Provider>
  );
}

function LeadPeekShell({
  leadId,
  mode,
  setMode,
  onClose,
}: {
  leadId: string;
  mode: LeadPeekMode;
  setMode: (mode: LeadPeekMode) => void;
  onClose: () => void;
}) {
  const isSide = mode === "side";

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close lead detail"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30 supports-backdrop-filter:backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Lead detail"
        className={
          isSide
            ? "absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-paper shadow-[0_30px_80px_rgba(20,16,12,0.32)] sm:w-[min(94vw,560px)]"
            : "absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(96vw,860px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[6px] border border-line bg-paper shadow-[0_30px_80px_rgba(20,16,12,0.32)]"
        }
      >
        <PeekHeader
          leadId={leadId}
          mode={mode}
          setMode={setMode}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto">
          <LeadDetailContent leadId={leadId} mode="peek" onAfterDelete={onClose} />
        </div>
      </aside>
    </div>
  );
}

function PeekHeader({
  leadId,
  mode,
  setMode,
  onClose,
}: {
  leadId: string;
  mode: LeadPeekMode;
  setMode: (mode: LeadPeekMode) => void;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-line/70 bg-paper-2/40 px-3 py-2.5">
      <div className="flex items-center gap-1 rounded-[3px] bg-paper-2 p-0.5">
        <ModeButton
          active={mode === "side"}
          label="Side peek"
          onClick={() => setMode("side")}
          icon={<PanelRight className="h-3.5 w-3.5" />}
        />
        <ModeButton
          active={mode === "center"}
          label="Center peek"
          onClick={() => setMode("center")}
          icon={<Square className="h-3.5 w-3.5" />}
        />
        <ModeButton
          active={false}
          label="Full page"
          onClick={() => setMode("full")}
          icon={<ExternalLink className="h-3.5 w-3.5" />}
        />
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/leads/${leadId}`}
          onClick={onClose}
          className="hidden items-center gap-1.5 rounded-[3px] border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink-3 transition-colors hover:border-line-3 hover:text-ink sm:inline-flex"
        >
          Open full page
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-4 hover:bg-paper-2 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

function ModeButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-white text-ink shadow-sm" : "text-ink-4 hover:text-ink"
      }`}
    >
      {icon}
    </button>
  );
}
