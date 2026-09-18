import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";

type AuthContext = {
  supabase: SupabaseClient;
  user: Pick<User, "id" | "email">;
  workspace: Workspace;
};

// proxy.ts already verifies the JWT via getClaims() and forwards the
// verified id/email via trusted, client-unspoofable headers. Reuse that
// instead of verifying again on every request. Falls back to a direct
// getClaims() check if the headers are missing (e.g. a future proxy
// matcher change) — never rely on Proxy alone for authentication.
export async function getVerifiedUser(
  supabase: SupabaseClient
): Promise<Pick<User, "id" | "email"> | null> {
  const hdrs = await headers();
  const trustedId = hdrs.get("x-ltz-user-id");
  if (trustedId) {
    return { id: trustedId, email: hdrs.get("x-ltz-user-email") || undefined };
  }

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub, email: data.claims.email };
}

export async function getAuthenticatedContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) return null;

  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!data) return null;

  // Cast through unknown to work around RLS-induced type restrictions
  const workspace = data as unknown as Workspace;

  return { supabase: supabase as unknown as SupabaseClient, user, workspace };
}
