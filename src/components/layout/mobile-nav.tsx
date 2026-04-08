"use client";

import { useState, useEffect } from "react";
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

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border/60 bg-card relative z-50">
        <div className="flex items-center gap-2.5">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={22}
            height={22}
          />
          <span className="text-[15px] font-semibold tracking-tight">
            LeadTracker
          </span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors -mr-1"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Slide-in drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${
          open ? "visible" : "invisible"
        }`}
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
          className={`absolute top-0 left-0 bottom-0 w-[280px] bg-card flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Drawer header */}
          <div className="px-5 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <Image
                src="/elivate-logo-icon.svg"
                alt="Elivate"
                width={26}
                height={26}
              />
              <div>
                <p className="text-[16px] font-semibold tracking-tight leading-tight">
                  LeadTracker
                </p>
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  by Elivate
                </p>
              </div>
            </div>
          </div>

          {/* Workspace */}
          <div className="px-5 pt-5 pb-3">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-[0.12em]">
              Workspace
            </p>
            <p className="text-[14px] font-semibold text-foreground mt-1 truncate">
              {workspace.name}
            </p>
          </div>

          {/* Nav */}
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all mb-0.5 ${
                    isActive
                      ? "bg-primary/8 text-primary shadow-[inset_3px_0_0_0] shadow-primary"
                      : "text-foreground/60 hover:bg-secondary hover:text-foreground active:bg-secondary/80"
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

          {/* User section */}
          <div className="px-3 py-4 border-t border-border/60">
            <div className="flex items-center gap-3 px-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {userEmail[0].toUpperCase()}
              </div>
              <span className="text-[13px] text-muted-foreground truncate flex-1">
                {userEmail}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 px-3 py-2.5 mt-2 w-full rounded-lg text-[14px] font-medium text-destructive/80 hover:bg-destructive/5 transition-colors"
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
