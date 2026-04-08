"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function signUp(email: string, password: string) {
  const supabase = await createClient();

  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!data.user) {
    return { error: "Failed to create account. Please try again." };
  }

  // Create workspace + default stages using service role (bypasses RLS)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name: "My Workspace", owner_id: data.user.id })
    .select("id")
    .single();

  if (wsError) {
    return { error: `Account created but workspace setup failed: ${wsError.message}` };
  }

  const stages = [
    { workspace_id: workspace.id, name: "New", position: 1, sla_days: 2, is_closed: false },
    { workspace_id: workspace.id, name: "Contacted", position: 2, sla_days: 3, is_closed: false },
    { workspace_id: workspace.id, name: "Engaged", position: 3, sla_days: 5, is_closed: false },
    { workspace_id: workspace.id, name: "Proposal Sent", position: 4, sla_days: 7, is_closed: false },
    { workspace_id: workspace.id, name: "Won", position: 5, sla_days: null, is_closed: true },
    { workspace_id: workspace.id, name: "Lost", position: 6, sla_days: null, is_closed: true },
  ];

  const { error: stagesError } = await admin.from("stages").insert(stages);

  if (stagesError) {
    return { error: `Account created but stages setup failed: ${stagesError.message}` };
  }

  return { error: null };
}
