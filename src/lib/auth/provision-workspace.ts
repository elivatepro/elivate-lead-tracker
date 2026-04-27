import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const DEFAULT_STAGES = [
  { name: "New", position: 1, sla_days: 2, is_closed: false, color: "#e56a34" },
  { name: "Contacted", position: 2, sla_days: 3, is_closed: false, color: "#d17b2b" },
  { name: "Engaged", position: 3, sla_days: 5, is_closed: false, color: "#c08d2b" },
  { name: "Proposal Sent", position: 4, sla_days: 7, is_closed: false, color: "#9c7d46" },
  { name: "Won", position: 5, sla_days: null, is_closed: true, color: "#628363" },
  { name: "Lost", position: 6, sla_days: null, is_closed: true, color: "#8a6f63" },
] as const;

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function provisionWorkspaceForUser(userId: string) {
  const admin = getAdminClient();

  const { data: existingWorkspace, error: existingError } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  if (existingWorkspace) {
    return { error: null, workspaceId: existingWorkspace.id, created: false };
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({ name: "My Workspace", owner_id: userId })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return {
      error: workspaceError?.message || "Failed to create workspace",
      workspaceId: null,
      created: false,
    };
  }

  const { error: stagesError } = await admin.from("stages").insert(
    DEFAULT_STAGES.map((stage) => ({
      workspace_id: workspace.id,
      ...stage,
    }))
  );

  if (stagesError) {
    return {
      error: stagesError.message,
      workspaceId: workspace.id,
      created: true,
    };
  }

  return { error: null, workspaceId: workspace.id, created: true };
}
