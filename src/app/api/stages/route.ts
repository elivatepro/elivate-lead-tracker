import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// GET /api/stages — list stages for current workspace
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("stages")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST /api/stages — create a stage
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Get the max position to place the new stage at the end
  const { data: existing } = await ctx.supabase
    .from("stages")
    .select("position")
    .eq("workspace_id", ctx.workspace.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 1;

  const { data, error } = await ctx.supabase
    .from("stages")
    .insert({
      workspace_id: ctx.workspace.id,
      name: body.name,
      position: nextPosition,
      sla_days: body.sla_days ?? null,
      is_closed: body.is_closed ?? false,
      color: body.color ?? "#c4960a",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
