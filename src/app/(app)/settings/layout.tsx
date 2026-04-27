"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";

const tabs = [
  { href: "/settings", label: "General" },
  { href: "/settings/nov", label: "Nov" },
  { href: "/settings/stages", label: "Stages" },
  { href: "/settings/profile", label: "Profile" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <Header
        eyebrow="Settings"
        title="Tune the workspace around your process."
        subtitle="Adjust workspace defaults, stage timing, and account details without losing the editorial rhythm of the app."
      />
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <nav className="inline-flex rounded-[3px] border border-border/70 bg-white/80 p-1 shadow-sm">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/settings"
                ? pathname === "/settings"
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-[3px] px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="max-w-4xl">{children}</div>
      </div>
    </>
  );
}
