"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Global keymap. ⌘K is owned by CommandPalette, ⌘J by NovProvider —
// this component owns the single-letter navigation hotkeys.
export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (inField) return;

      switch (e.key) {
        case "n": {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("open-new-lead-dialog"));
          break;
        }
        case "s": {
          e.preventDefault();
          router.push("/leads/stale");
          break;
        }
        case "t": {
          e.preventDefault();
          router.push("/today");
          break;
        }
        case "b": {
          e.preventDefault();
          router.push("/leads");
          break;
        }
        case "d": {
          e.preventDefault();
          router.push("/");
          break;
        }
        case "/": {
          // Slash opens the palette as a search-first entry point.
          e.preventDefault();
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
          );
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
