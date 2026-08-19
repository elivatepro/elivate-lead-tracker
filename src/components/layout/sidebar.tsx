"use client";

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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: Inbox },
  { href: "/leads", label: "Pipeline", icon: LayoutGrid },
  { href: "/leads/list", label: "List", icon: Rows3 },
  { href: "/leads/stale", label: "Stale", icon: Triangle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-line bg-paper px-2.5 py-3">
      {/* brand */}
      <div className="flex items-center gap-2 px-2 pb-4">
        <Image src="/elivate-logo-icon.svg" alt="Elivate" width={22} height={22} />
        <p className="text-[13px] font-semibold leading-none tracking-tight text-ink">
          LeadTracker
        </p>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-[3px] px-2.5 py-[7px] text-[13px] transition-colors ${
                isActive
                  ? "bg-ink text-paper"
                  : "text-ink-3 hover:bg-paper-2 hover:text-ink"
              }`}
            >
              <item.icon
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={isActive ? 2 : 1.7}
              />
              <span className="truncate font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* user */}
      <div className="mb-2 flex items-center justify-end pr-1">
        <ThemeToggle />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-[3px] border border-line bg-card px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-paper-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ember-tint text-[10px] font-bold text-ember">
            {userEmail[0].toUpperCase()}
          </div>
          <span className="min-w-0 flex-1 truncate font-medium leading-tight text-ink">
            {userEmail}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={() => signOut()}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}