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
  Command,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(app)/actions";
import type { Workspace } from "@/lib/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, note: "Overview" },
  { href: "/today", label: "Today", icon: Inbox, note: "Triage inbox" },
  { href: "/leads", label: "Pipeline", icon: LayoutGrid, note: "Board" },
  { href: "/leads/list", label: "Lead list", icon: Rows3, note: "Bulk edit" },
  { href: "/leads/stale", label: "Stale", icon: Triangle, note: "Needs attention" },
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
    <aside className="flex h-full w-[260px] flex-col border-r border-line bg-paper px-3 py-4">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <Image
          src="/elivate-logo-icon.svg"
          alt="Elivate"
          width={24}
          height={24}
        />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-none tracking-tight text-ink">
            LeadTracker
          </p>
          <p className="font-display text-[11px] italic leading-tight text-ink-4">
            by Elivate
          </p>
        </div>
      </div>

      {/* workspace */}
      <div className="mb-4 border-y border-line/70 px-2 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
          Workspace
        </p>
        <p className="mt-1 truncate font-display text-[18px] leading-tight tracking-[-0.01em] text-ink">
          {workspace.name}
        </p>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-px">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-[13px] transition-colors ${
                isActive
                  ? "bg-ink text-paper"
                  : "text-ink-3 hover:bg-paper-2 hover:text-ink"
              }`}
            >
              <item.icon
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={isActive ? 2 : 1.7}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-tight">{item.label}</span>
                {item.note ? (
                  <span
                    className={`block truncate text-[10.5px] leading-tight ${
                      isActive ? "text-paper/55" : "text-ink-4/85"
                    }`}
                  >
                    {item.note}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* shortcuts */}
      <div className="mb-3 border-y border-line/70 px-2 py-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-4">
          <span>Shortcuts</span>
          <Command className="h-3 w-3" />
        </div>
        <div className="mt-2.5 space-y-1.5 text-[12px] text-ink-2">
          <ShortcutRow label="Command palette" keys={["⌘", "K"]} />
          <ShortcutRow label="Ask Nov" keys={["⌘", "J"]} />
          <ShortcutRow label="New lead" keys={["N"]} />
          <ShortcutRow label="Today" keys={["T"]} />
        </div>
      </div>

      {/* user */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-[3px] border border-line bg-card px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-paper-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ember-tint text-[10px] font-bold text-ember">
            {userEmail[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium leading-tight text-ink">{userEmail}</span>
            <span className="block text-[10.5px] leading-tight text-ink-4">Owner</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
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

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </span>
    </div>
  );
}
