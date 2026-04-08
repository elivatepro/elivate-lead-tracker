import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

type AuthContext = {
  supabase: SupabaseClient;
  user: User;
  workspace: Workspace;
};

export async function getAuthenticatedContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
