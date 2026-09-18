import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function safeVerify(token: string) {
  try {
    return verifyUnsubscribeToken(token);
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const verified = safeVerify(token);

  // Opening this page (a GET) never unsubscribes anyone — mail scanners
  // prefetch links. Only the button below, a POST, writes.
  async function confirm() {
    "use server";
    const v = safeVerify(token);
    if (!v) redirect(`/unsubscribe/${encodeURIComponent(token)}`);

    const { error } = await createServiceClient().rpc("suppress_email", {
      p_workspace_id: v.workspaceId,
      p_email: v.email,
      p_reason: "unsubscribe",
    });
    if (error) throw new Error("Couldn't process your request. Please try again.");

    redirect(`/unsubscribe/${encodeURIComponent(token)}?done=1`);
  }

  if (!verified) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl tracking-[-0.02em]">Link not valid</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This unsubscribe link is invalid or incomplete. If you keep getting
          emails you don&apos;t want, reply to one and ask to be removed.
        </p>
      </Shell>
    );
  }

  const { data: workspace } = await createServiceClient()
    .from("workspaces")
    .select("name, email_from_name")
    .eq("id", verified.workspaceId)
    .maybeSingle();
  const sender =
    (workspace as { email_from_name: string | null; name: string } | null)?.email_from_name ||
    (workspace as { name: string } | null)?.name ||
    "this sender";

  if (done) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl tracking-[-0.02em]">You&apos;re unsubscribed</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {maskEmail(verified.email)} won&apos;t receive any more emails from {sender}.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-serif text-2xl tracking-[-0.02em]">Unsubscribe</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Stop all emails from {sender} to{" "}
        <span className="font-medium text-foreground">{maskEmail(verified.email)}</span>?
      </p>
      <form action={confirm} className="mt-6">
        <Button type="submit" className="w-full">
          Yes, unsubscribe me
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-[4px] border border-border/70 bg-card/80 p-8 text-center">
        {children}
      </div>
    </main>
  );
}
