"use client";

import { Search } from "lucide-react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  function openPalette() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <header className="border-b border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,249,241,0.92))] px-4 py-5 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <span className="ember-eyebrow">{eyebrow}</span>
          ) : null}
          <div className="space-y-1">
            <h1 className="font-display display-heading text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-[13.5px] leading-6 text-ink-4 sm:text-[14.5px]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openPalette}
            className="group inline-flex h-9 min-w-0 items-center gap-2.5 rounded-[3px] border border-line bg-card px-3 text-[12.5px] text-ink-4 transition-colors hover:border-line-3 hover:text-ink-2 sm:w-72"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-4 group-hover:text-ink-3" />
            <span className="flex-1 truncate text-left">Search leads, jump anywhere…</span>
            <kbd className="hidden shrink-0 sm:inline-flex">⌘K</kbd>
          </button>
          {actions}
        </div>
      </div>
    </header>
  );
}
