import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// POST /api/leads/[id]/notes — add a note to a lead
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { note } = await req.json();

  if (!note?.trim()) {
    return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
  }

  // Log the note as an activity
  const { error: activityError } = await ctx.supabase.from("activities").insert({
    workspace_id: ctx.workspace.id,
    lead_id: id,
    type: "note_added" as const,
    actor_id: ctx.user.id,
    payload: { note: note.trim() },
  });

  if (activityError)
    return NextResponse.json({ error: activityError.message }, { status: 500 });

  // Touch the lead so note activity resets stale state without overwriting
  // the dedicated lead summary stored in `leads.notes`.
  const { error: leadError } = await ctx.supabase
    .from("leads")
    .update({
      last_activity_at: new Date().toISOString(),
      reminder_sent_at: null,
    })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (leadError)
    return NextResponse.json({ error: leadError.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 201 });
}
