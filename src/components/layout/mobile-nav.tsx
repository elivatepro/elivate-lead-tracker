"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "@/app/(app)/actions";
import type { Workspace } from "@/lib/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
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

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden flex items-center justify-between h-12 px-4 border-b border-border/60 bg-card">
        <div className="flex items-center gap-2">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={20}
            height={20}
          />
          <span className="font-serif text-[15px] tracking-tight">
            LeadTracker
          </span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-foreground/20 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed top-12 left-0 right-0 bg-card border-b border-border z-50 shadow-lg">
            {/* Workspace */}
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">
                Workspace
              </p>
              <p className="text-sm font-medium text-foreground/80 mt-0.5">
                {workspace.name}
              </p>
            </div>

            {/* Nav */}
            <nav className="px-3 pb-2 space-y-0.5">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                      isActive
                        ? "bg-primary/8 text-primary"
                        : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User */}
            <div className="px-3 py-3 border-t border-border/60">
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center text-[11px] font-semibold ring-1 ring-primary/10">
                    {userEmail[0].toUpperCase()}
                  </div>
                  <span className="text-[13px] text-muted-foreground truncate max-w-[200px]">
                    {userEmail}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-destructive hover:text-destructive/80 p-1.5"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
