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
  const archived = searchParams.get("archived");
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  let query = ctx.supabase
    .from("leads_sla_state")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (archived === "true") {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }
  if (stage) query = query.eq("stage_id", stage);
  if (stale === "true") query = query.eq("is_stale", true);
  if (tag) query = query.contains("tags", [tag]);
  if (search)
    query = query.or(
      `name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
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
