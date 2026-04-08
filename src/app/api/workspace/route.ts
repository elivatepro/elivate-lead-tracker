import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// GET /api/workspace — get current workspace
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(ctx.workspace);
}

// PATCH /api/workspace — update workspace name or required_fields
export async function PATCH(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.required_fields !== undefined) updates.required_fields = body.required_fields;

  const { data, error } = await ctx.supabase
    .from("workspaces")
    .update(updates)
    .eq("id", ctx.workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
