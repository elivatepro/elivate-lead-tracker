"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  if (!resolvedTheme) {
    return (
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
        aria-label="Toggle theme"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}