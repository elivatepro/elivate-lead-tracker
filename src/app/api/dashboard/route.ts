import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// GET /api/dashboard — aggregated stats
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wsId = ctx.workspace.id;

  // Fetch all leads with stage info
  const { data: leads } = await ctx.supabase
    .from("leads")
    .select("*, stages!inner(sla_days, is_closed)")
    .eq("workspace_id", wsId);

  const allLeads = leads ?? [];
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  const activeLeads = allLeads.filter(
    (l) => !(l.stages as unknown as { is_closed: boolean }).is_closed
  );

  const staleLeads = activeLeads.filter((l) => {
    const stage = l.stages as unknown as { sla_days: number | null; is_closed: boolean };
    if (!stage.sla_days) return false;
    if (l.snoozed_until && new Date(l.snoozed_until).getTime() > now) return false;
    const dueAt = new Date(l.last_activity_at).getTime() + stage.sla_days * 86400000;
    return now >= dueAt;
  });

  const requiredFields = ctx.workspace.required_fields ?? ["name"];
  const incompleteLeads = activeLeads.filter((l) => {
    return requiredFields.some((field: string) => {
      const val = l[field as keyof typeof l];
      return val === null || val === undefined || val === "";
    });
  });

  const addedThisWeek = allLeads.filter(
    (l) => new Date(l.created_at).getTime() >= weekAgo
  );

  const pipelineValue = activeLeads.reduce(
    (sum, l) => sum + (Number(l.value) || 0),
    0
  );

  // Recent activities
  const { data: activities } = await ctx.supabase
    .from("activities")
    .select("*, leads(name)")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    activeLeads: activeLeads.length,
    staleLeads: staleLeads.length,
    incompleteLeads: incompleteLeads.length,
    addedThisWeek: addedThisWeek.length,
    pipelineValue,
    recentActivities: activities ?? [],
  });
}
