import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/login");

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar workspace={workspace} userEmail={user.email ?? ""} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile navigation */}
        <MobileNav workspace={workspace} userEmail={user.email ?? ""} />
        <KeyboardShortcuts />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
