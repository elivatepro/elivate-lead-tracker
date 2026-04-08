import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// PATCH /api/stages/[id] — update a stage
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await ctx.supabase
    .from("stages")
    .update(body)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// DELETE /api/stages/[id] — delete a stage (only if no leads in it)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Check if any leads are in this stage
  const { count } = await ctx.supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete stage with ${count} lead(s). Move them first.` },
      { status: 400 }
    );
  }

  const { error } = await ctx.supabase
    .from("stages")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
