import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import type { Workspace } from "@/lib/types";

function serializeWorkspace(workspace: Workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    required_fields: workspace.required_fields,
    nov_company_summary: workspace.nov_company_summary,
    nov_offer_summary: workspace.nov_offer_summary,
    nov_target_customer: workspace.nov_target_customer,
    nov_default_cta: workspace.nov_default_cta,
    nov_email_signoff: workspace.nov_email_signoff,
    nov_preferred_tone: workspace.nov_preferred_tone,
    nov_be_concise: workspace.nov_be_concise,
    nov_avoid_pushy_language: workspace.nov_avoid_pushy_language,
    nov_include_booking_prompt: workspace.nov_include_booking_prompt,
    created_at: workspace.created_at,
    updated_at: workspace.updated_at,
  };
}

const NOV_TONES = new Set(["warm", "direct", "casual"]);

function sanitizeOptionalText(value: unknown, max = 280) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// GET /api/workspace — get current workspace
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(serializeWorkspace(ctx.workspace));
}

// PATCH /api/workspace — update workspace settings
export async function PATCH(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.required_fields !== undefined) updates.required_fields = body.required_fields;
  if (body.nov_company_summary !== undefined) {
    updates.nov_company_summary = sanitizeOptionalText(body.nov_company_summary, 400);
  }
  if (body.nov_offer_summary !== undefined) {
    updates.nov_offer_summary = sanitizeOptionalText(body.nov_offer_summary, 400);
  }
  if (body.nov_target_customer !== undefined) {
    updates.nov_target_customer = sanitizeOptionalText(body.nov_target_customer, 320);
  }
  if (body.nov_default_cta !== undefined) {
    updates.nov_default_cta = sanitizeOptionalText(body.nov_default_cta, 220);
  }
  if (body.nov_email_signoff !== undefined) {
    updates.nov_email_signoff = sanitizeOptionalText(body.nov_email_signoff, 120);
  }
  if (body.nov_preferred_tone !== undefined && NOV_TONES.has(body.nov_preferred_tone)) {
    updates.nov_preferred_tone = body.nov_preferred_tone;
  }
  if (body.nov_be_concise !== undefined) {
    updates.nov_be_concise = Boolean(body.nov_be_concise);
  }
  if (body.nov_avoid_pushy_language !== undefined) {
    updates.nov_avoid_pushy_language = Boolean(body.nov_avoid_pushy_language);
  }
  if (body.nov_include_booking_prompt !== undefined) {
    updates.nov_include_booking_prompt = Boolean(body.nov_include_booking_prompt);
  }

  const { data, error } = await ctx.supabase
    .from("workspaces")
    .update(updates)
    .eq("id", ctx.workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(serializeWorkspace(data));
}
