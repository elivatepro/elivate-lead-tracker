"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(app)/actions";
import type { Workspace } from "@/lib/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  workspace,
  userEmail,
}: {
  workspace: Workspace;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-[232px] border-r border-border bg-gradient-to-b from-card to-card/80 flex flex-col h-full">
      {/* Logo + branding */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <Image
            src="/elivate-logo-icon.svg"
            alt="Elivate"
            width={22}
            height={22}
          />
          <span className="font-serif text-[17px] tracking-tight">
            LeadTracker
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground pl-[30px] mt-0.5 tracking-wide uppercase">
          by Elivate
        </p>
      </div>

      {/* Workspace name */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.1em]">
          Workspace
        </p>
        <p className="text-sm font-medium text-foreground/80 mt-0.5 truncate">
          {workspace.name}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                isActive
                  ? "bg-primary/8 text-primary shadow-[inset_3px_0_0_0] shadow-primary"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              <item.icon
                className={`h-[18px] w-[18px] ${isActive ? "text-primary" : ""}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-all">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center text-[11px] font-semibold ring-1 ring-primary/10">
              {userEmail[0].toUpperCase()}
            </div>
            <span className="truncate text-left flex-1">{userEmail}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
