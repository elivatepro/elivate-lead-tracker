import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";

// GET /api/tags — distinct tags across the workspace (for filtering + suggestions)
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("leads")
    .select("tags")
    .eq("workspace_id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tags = new Set<string>();
  for (const row of data ?? []) {
    for (const tag of row.tags ?? []) {
      if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
    }
  }

  return NextResponse.json({ tags: [...tags].sort() });
}