import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const mappingRaw = formData.get("mapping") as string | null;

  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!mappingRaw)
    return NextResponse.json(
      { error: "No column mapping provided" },
      { status: 400 }
    );

  const mapping: Record<string, string> = JSON.parse(mappingRaw);

  // Parse file
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

  if (rows.length === 0)
    return NextResponse.json({ error: "File is empty" }, { status: 400 });

  if (rows.length > 500)
    return NextResponse.json(
      { error: "Maximum 500 rows per import" },
      { status: 400 }
    );

  // Get default stage (first non-closed stage)
  const { data: stages } = await ctx.supabase
    .from("stages")
    .select("id, is_closed, position")
    .eq("workspace_id", ctx.workspace.id)
    .eq("is_closed", false)
    .order("position", { ascending: true })
    .limit(1);

  const defaultStageId = stages?.[0]?.id;
  if (!defaultStageId)
    return NextResponse.json(
      { error: "No active stages found. Create a stage first." },
      { status: 400 }
    );

  // Build lead records from rows using the column mapping
  const leads = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, data starts at 2

    const name = mapping.name ? String(row[mapping.name] ?? "").trim() : "";
    if (!name) {
      errors.push(`Row ${rowNum}: missing name — skipped`);
      continue;
    }

    const valueRaw = mapping.value
      ? String(row[mapping.value] ?? "").trim()
      : "";
    let value: number | null = null;
    if (valueRaw) {
      // Strip currency symbols and commas
      const cleaned = valueRaw.replace(/[^0-9.\-]/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) value = parsed;
    }

    leads.push({
      workspace_id: ctx.workspace.id,
      stage_id: defaultStageId,
      name,
      company: mapping.company
        ? String(row[mapping.company] ?? "").trim() || null
        : null,
      email: mapping.email
        ? String(row[mapping.email] ?? "").trim() || null
        : null,
      phone: mapping.phone
        ? String(row[mapping.phone] ?? "").trim() || null
        : null,
      source: mapping.source
        ? String(row[mapping.source] ?? "").trim() || null
        : null,
      value,
      notes: mapping.notes
        ? String(row[mapping.notes] ?? "").trim() || null
        : null,
      tags: [] as string[],
    });
  }

  if (leads.length === 0)
    return NextResponse.json(
      {
        error: "No valid leads found in file",
        details: errors.slice(0, 10),
      },
      { status: 400 }
    );

  // Insert in batches of 50
  let imported = 0;
  const batchSize = 50;

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const { data, error } = await ctx.supabase
      .from("leads")
      .insert(batch)
      .select("id, name");

    if (error) {
      return NextResponse.json(
        {
          error: `Import failed at row ${i + 2}: ${error.message}`,
          imported,
        },
        { status: 500 }
      );
    }

    // Log activities for imported leads
    if (data) {
      const activities = data.map((lead: { id: string; name: string }) => ({
        workspace_id: ctx.workspace.id,
        lead_id: lead.id,
        type: "created" as const,
        actor_id: ctx.user.id,
        payload: { name: lead.name, source: "csv_import" },
      }));
      await ctx.supabase.from("activities").insert(activities);
      imported += data.length;
    }
  }

  return NextResponse.json({
    imported,
    skipped: rows.length - imported,
    errors: errors.slice(0, 10),
  });
}
