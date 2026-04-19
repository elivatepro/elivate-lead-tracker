import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { normalizeContactField } from "@/lib/contacts";

// GET /api/leads/[id] — get a single lead with activities
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [leadResult, activitiesResult] = await Promise.all([
    ctx.supabase
      .from("leads")
      .select("*, stages!inner(name, sla_days, is_closed, color, position)")
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
      .single(),
    ctx.supabase
      .from("activities")
      .select("*")
      .eq("lead_id", id)
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  if (leadResult.error)
    return NextResponse.json({ error: leadResult.error.message }, { status: 404 });

  return NextResponse.json({
    ...leadResult.data,
    activities: activitiesResult.data ?? [],
  });
}

// PATCH /api/leads/[id] — update a lead
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Get the old lead to detect stage changes
  const { data: oldLead } = await ctx.supabase
    .from("leads")
    .select("stage_id, name")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .single();

  if (!oldLead)
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Handle closed_at when moving to a closed stage
  const updates: Record<string, unknown> = { ...body };
  if ("email" in body) {
    updates.email = normalizeContactField(body.email);
  }
  if ("phone" in body) {
    updates.phone = normalizeContactField(body.phone);
  }

  if (body.stage_id && body.stage_id !== oldLead.stage_id) {
    const { data: newStage } = await ctx.supabase
      .from("stages")
      .select("is_closed, name")
      .eq("id", body.stage_id)
      .single();

    if (newStage?.is_closed) {
      updates.closed_at = new Date().toISOString();
    } else {
      updates.closed_at = null;
    }

    // Get old stage name for activity log
    const { data: oldStage } = await ctx.supabase
      .from("stages")
      .select("name")
      .eq("id", oldLead.stage_id)
      .single();

    await ctx.supabase.from("activities").insert({
      workspace_id: ctx.workspace.id,
      lead_id: id,
      type: "stage_changed" as const,
      actor_id: ctx.user.id,
      payload: { from: oldStage?.name, to: newStage?.name },
    });
  } else {
    // Log field edit
    await ctx.supabase.from("activities").insert({
      workspace_id: ctx.workspace.id,
      lead_id: id,
      type: "field_edited" as const,
      actor_id: ctx.user.id,
      payload: { fields: Object.keys(body) },
    });
  }

  const { data, error } = await ctx.supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .select("*, stages!inner(name, sla_days, is_closed, color, position)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// DELETE /api/leads/[id] — delete a lead
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await ctx.supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
