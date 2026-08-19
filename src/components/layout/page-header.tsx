"use client";

import { Search } from "lucide-react";

type PageHeaderProps = {
  title: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, actions }: PageHeaderProps) {
  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <header className="border-b border-line/70 bg-card/80 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
          {title}
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPalette}
            className="group inline-flex h-9 min-w-0 items-center gap-2 rounded-[3px] border border-line bg-card px-3 text-[12.5px] text-ink-4 transition-colors hover:border-line-3 hover:text-ink-2 sm:w-64"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-4 group-hover:text-ink-3" />
            <span className="flex-1 truncate text-left">Search…</span>
            <kbd className="hidden shrink-0 sm:inline-flex">⌘K</kbd>
          </button>
          {actions}
        </div>
      </div>
    </header>
  );
}