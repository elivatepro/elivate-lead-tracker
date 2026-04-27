"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Rows3,
  Triangle,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "@/app/(app)/actions";
import type { Workspace } from "@/lib/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: Inbox },
  { href: "/leads", label: "Pipeline", icon: LayoutGrid },
  { href: "/leads/list", label: "Lead list", icon: Rows3 },
  { href: "/leads/stale", label: "Stale", icon: Triangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav({
  workspace,
  userEmail,
}: {
  workspace: Workspace;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Prevent page scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile header bar */}
      <div className="relative z-40 flex h-16 items-center justify-between border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(252,246,238,0.95))] px-4 lg:hidden">
        <div className="flex items-center gap-2.5 px-1">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={24}
            height={24}
          />
          <div className="min-w-0">
            <span className="block text-[14px] font-semibold leading-none tracking-tight text-ink">
              LeadTracker
            </span>
            <span className="font-display block text-[11px] italic leading-tight text-ink-4">
              by Elivate
            </span>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="-mr-1 flex h-9 w-9 items-center justify-center rounded-[3px] border border-line bg-card transition-colors hover:bg-paper-2"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Slide-in drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          open ? "visible" : "invisible"
        }`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-foreground/30 transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />

        {/* Drawer panel */}
        <div
          id="mobile-nav-drawer"
          className={`absolute inset-y-0 left-0 flex w-[min(320px,calc(100vw-1rem))] max-w-[88vw] flex-col overflow-y-auto border-r border-line/70 bg-[linear-gradient(180deg,rgba(255,252,246,1),rgba(244,235,223,0.98))] shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="border-b border-border/60 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/elivate-logo-icon.svg"
                  alt="Elivate"
                  width={26}
                  height={26}
                />
                <div>
                  <p className="leading-tight text-[16px] font-semibold tracking-tight">
                    LeadTracker
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    by Elivate
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-line bg-card transition-colors hover:bg-paper-2"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="px-5 pb-3 pt-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
              Workspace
            </p>
            <p className="mt-1 font-serif text-[24px] tracking-[-0.03em] text-foreground">
              {workspace.name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Follow-up timing, pipeline clarity, and one calm place to work.
            </p>
          </div>

          <nav className="flex-1 px-3 py-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`mb-0.5 flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                    isActive
                      ? "bg-ink text-paper"
                      : "text-ink-3 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  <item.icon
                    className="h-[18px] w-[18px]"
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/60 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-center gap-3 rounded-[3px] border border-line bg-card px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ember-tint text-[10px] font-bold text-ember">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {userEmail}
                </span>
                <span className="text-xs text-muted-foreground">Owner account</span>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="mt-2 flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-[13.5px] font-medium text-destructive/80 transition-colors hover:bg-destructive/5"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
