"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Rows3, Triangle } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/leads", label: "Pipeline", icon: LayoutGrid },
  { href: "/leads/list", label: "List", icon: Rows3 },
  { href: "/leads/stale", label: "Stale", icon: Triangle },
];

export function LeadViewNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-[3px] border border-line bg-card p-0.5">
      {items.map((item) => {
        const active =
          item.href === "/leads"
            ? pathname === "/leads"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-ink-4 hover:text-ink"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
