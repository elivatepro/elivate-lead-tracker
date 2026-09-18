import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { NovProvider } from "@/components/nov/nov-context";
import { NovPanel } from "@/components/nov/nov-panel";
import { NovLauncher } from "@/components/nov/nov-launcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthenticatedContext();

  if (!ctx) redirect("/login");

  const { user, workspace } = ctx;

  return (
    <NovProvider>
      <Suspense fallback={null}>
        <div className="flex h-screen bg-paper">
          <div className="hidden lg:block">
            <Sidebar userEmail={user.email ?? ""} />
          </div>

          <div className="flex min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <MobileNav workspace={workspace} userEmail={user.email ?? ""} />
              <KeyboardShortcuts />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
            {/* Desktop rail */}
            <NovPanel variant="rail" />
          </div>

          {/* Mobile / tablet overlay — hidden when the desktop rail is visible */}
          <div className="xl:hidden">
            <NovPanel variant="overlay" />
          </div>
          <NovLauncher />
        </div>
      </Suspense>
    </NovProvider>
  );
}
