import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// GET /api/dashboard — aggregated stats
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wsId = ctx.workspace.id;
  const requiredFields = ctx.workspace.required_fields ?? ["name"];

  const [statsResult, activitiesResult] = await Promise.all([
    ctx.supabase.rpc("get_dashboard_stats", {
      p_workspace_id: wsId,
      p_required_fields: requiredFields,
    }),
    ctx.supabase
      .from("activities")
      .select("*, leads(name)")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (statsResult.error) {
    return NextResponse.json({ error: statsResult.error.message }, { status: 500 });
  }

  const stats = statsResult.data?.[0] ?? {
    active_leads: 0,
    stale_leads: 0,
    incomplete_leads: 0,
    added_this_week: 0,
    pipeline_value: 0,
  };

  return NextResponse.json({
    activeLeads: stats.active_leads,
    staleLeads: stats.stale_leads,
    incompleteLeads: stats.incomplete_leads,
    addedThisWeek: stats.added_this_week,
    pipelineValue: stats.pipeline_value,
    recentActivities: activitiesResult.data ?? [],
  });
}
