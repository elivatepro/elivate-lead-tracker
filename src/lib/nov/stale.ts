import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const DAY_MS = 86_400_000;

type TypedSupabase = SupabaseClient<Database>;

type LeadWithRelations = Database["public"]["Tables"]["leads"]["Row"] & {
  stages: {
    name: string;
    sla_days: number | null;
    is_closed: boolean;
    color: string | null;
    position: number;
  };
  workspaces: {
    owner_id: string;
  };
};

export type ComputedStaleLead = Database["public"]["Tables"]["leads"]["Row"] & {
  stage_name: string;
  sla_days: number;
  due_at: string;
  owner_id: string;
};

type ComputeStaleLeadsOptions = {
  workspaceId?: string;
  limit?: number;
  now?: number;
  onlyUnreminded?: boolean;
};

export async function computeStaleLeads(
  supabase: TypedSupabase,
  opts: ComputeStaleLeadsOptions = {}
) {
  const now = opts.now ?? Date.now();

  let query = supabase
    .from("leads")
    .select(
      "*, stages!inner(name, sla_days, is_closed, color, position), workspaces!inner(owner_id)"
    )
    .order("last_activity_at", { ascending: true });

  if (opts.workspaceId) {
    query = query.eq("workspace_id", opts.workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const staleLeads = ((data ?? []) as unknown as LeadWithRelations[])
    .filter((lead) => {
      if (lead.stages.is_closed || !lead.stages.sla_days) return false;
      if (opts.onlyUnreminded && lead.reminder_sent_at) return false;
      if (lead.snoozed_until && new Date(lead.snoozed_until).getTime() > now) return false;

      const dueAt = new Date(lead.last_activity_at).getTime() + lead.stages.sla_days * DAY_MS;
      return now >= dueAt;
    })
    .map<ComputedStaleLead>((lead) => ({
      ...lead,
      stage_name: lead.stages.name,
      sla_days: lead.stages.sla_days!,
      due_at: new Date(
        new Date(lead.last_activity_at).getTime() + lead.stages.sla_days! * DAY_MS
      ).toISOString(),
      owner_id: lead.workspaces.owner_id,
    }));

  return typeof opts.limit === "number" ? staleLeads.slice(0, opts.limit) : staleLeads;
}
