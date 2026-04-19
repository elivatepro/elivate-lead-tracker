import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { normalizeContactField } from "@/lib/contacts";

// GET /api/leads — list leads with optional filters
export async function GET(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const stale = searchParams.get("stale");
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");

  let query = ctx.supabase
    .from("leads")
    .select("*, stages!inner(name, sla_days, is_closed, color, position)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  if (stage) query = query.eq("stage_id", stage);
  if (tag) query = query.contains("tags", [tag]);
  if (search)
    query = query.or(
      `name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter stale leads in JS (requires stage SLA calculation)
  let leads = data ?? [];
  if (stale === "true") {
    const now = Date.now();
    leads = leads.filter((lead) => {
      const stage = lead.stages as unknown as { sla_days: number | null; is_closed: boolean };
      if (stage.is_closed || !stage.sla_days) return false;
      if (lead.snoozed_until && new Date(lead.snoozed_until).getTime() > now) return false;
      const dueAt = new Date(lead.last_activity_at).getTime() + stage.sla_days * 86400000;
      return now >= dueAt;
    });
  }

  return NextResponse.json(leads);
}

// POST /api/leads — create a lead
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      workspace_id: ctx.workspace.id,
      stage_id: body.stage_id,
      name: body.name,
      company: body.company || null,
      email: normalizeContactField(body.email),
      phone: normalizeContactField(body.phone),
      source: body.source || null,
      value: body.value || null,
      notes: body.notes || null,
      tags: body.tags || [],
    })
    .select("*, stages!inner(name, sla_days, is_closed, color, position)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  await ctx.supabase.from("activities").insert({
    workspace_id: ctx.workspace.id,
    lead_id: data.id,
    type: "created" as const,
    actor_id: ctx.user.id,
    payload: { name: data.name },
  });

  return NextResponse.json(data, { status: 201 });
}
