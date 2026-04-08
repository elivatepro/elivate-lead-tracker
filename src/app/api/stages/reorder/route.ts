import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// POST /api/stages/reorder — bulk reorder stages
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stages } = await req.json();

  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages must be an array of { id, position }" }, { status: 400 });
  }

  // Update each stage's position
  const updates = stages.map(({ id, position }: { id: string; position: number }) =>
    ctx.supabase
      .from("stages")
      .update({ position })
      .eq("id", id)
      .eq("workspace_id", ctx.workspace.id)
  );

  await Promise.all(updates);

  return NextResponse.json({ success: true });
}
