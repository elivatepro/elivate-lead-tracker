"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";

const tabs = [
  { href: "/settings", label: "General" },
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
      <Header title="Settings" />
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <nav className="flex gap-1 border-b border-border">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/settings"
                ? pathname === "/settings"
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </>
  );
}
