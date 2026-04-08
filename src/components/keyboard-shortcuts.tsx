"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs, textareas, or selects
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "n": {
          e.preventDefault();
          // Dispatch custom event for NewLeadDialog to listen to
          window.dispatchEvent(new CustomEvent("open-new-lead-dialog"));
          break;
        }
        case "s": {
          e.preventDefault();
          router.push("/leads/stale");
          break;
        }
        case "/": {
          e.preventDefault();
          // Focus the header search input
          const headerSearch = document.querySelector<HTMLInputElement>(
            'header input[placeholder*="Search"]'
          );
          if (headerSearch) {
            headerSearch.focus();
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
