import { z } from "zod";
import { zodResponsesFunction, zodTextFormat } from "openai/helpers/zod";
import type { ParsedResponseFunctionToolCall } from "openai/resources/responses/responses";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Workspace } from "@/lib/types";
import { computeStaleLeads } from "@/lib/nov/stale";
import { createOpenAIClient, NOV_MODEL } from "@/lib/nov/openai";

type TypedSupabase = SupabaseClient<Database>;
type StageSummary = {
  name: string;
  sla_days: number | null;
  is_closed: boolean;
  color: string | null;
  position: number;
};

type LeadListItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  value: number | null;
  last_activity_at: string;
  created_at: string;
  stage_id: string;
  stages: StageSummary;
};

type LeadSearchItem = LeadListItem & {
  phone: string | null;
};

type LeadDetail = Database["public"]["Tables"]["leads"]["Row"] & {
  stages: StageSummary;
};

type PipelineLead = {
  id: string;
  name: string;
  company: string | null;
  value: number | null;
  stage_id: string;
  created_at: string;
  last_activity_at: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  stages: StageSummary;
};

export type NovToolContext = {
  supabase: TypedSupabase;
  user: User;
  workspace: Workspace;
};

const listLeadsSchema = z.object({
  stage: z.string().trim().min(1).nullable(),
  limit: z.number().int().min(1).max(50).nullable(),
  order_by: z.enum(["last_activity_at", "value", "created_at"]).nullable(),
  direction: z.enum(["asc", "desc"]).nullable(),
});

const searchLeadsSchema = z.object({
  query: z.string().trim().min(1),
});

const getLeadSchema = z.object({
  id: z.string().uuid(),
});

const getPipelineSummarySchema = z.object({});

const getStaleLeadsSchema = z.object({
  limit: z.number().int().min(1).max(50).nullable(),
});

const draftEmailSchema = z.object({
  lead_id: z.string().uuid(),
  intent: z.string().trim().min(1),
  tone: z.enum(["warm", "direct", "casual"]).nullable(),
});

const emailDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

const toolSchemas = {
  list_leads: listLeadsSchema,
  search_leads: searchLeadsSchema,
  get_lead: getLeadSchema,
  get_pipeline_summary: getPipelineSummarySchema,
  get_stale_leads: getStaleLeadsSchema,
  draft_email: draftEmailSchema,
};

export const NOV_TOOLS = [
  zodResponsesFunction({
    name: "list_leads",
    description:
      "List workspace leads, optionally filtered by stage, ordered for pipeline review.",
    parameters: listLeadsSchema,
  }),
  zodResponsesFunction({
    name: "search_leads",
    description: "Search leads by name, company, email, or phone.",
    parameters: searchLeadsSchema,
  }),
  zodResponsesFunction({
    name: "get_lead",
    description: "Fetch one lead with stage details and recent activities.",
    parameters: getLeadSchema,
  }),
  zodResponsesFunction({
    name: "get_pipeline_summary",
    description: "Summarize the workspace pipeline with stage counts and health signals.",
    parameters: getPipelineSummarySchema,
  }),
  zodResponsesFunction({
    name: "get_stale_leads",
    description: "List leads that are past their current stage SLA.",
    parameters: getStaleLeadsSchema,
  }),
  zodResponsesFunction({
    name: "draft_email",
    description: "Draft a follow-up email for a specific lead. This returns a draft only.",
    parameters: draftEmailSchema,
  }),
];

type ToolName = keyof typeof toolSchemas;

export async function runToolCall(call: ParsedResponseFunctionToolCall, ctx: NovToolContext) {
  if (!isToolName(call.name)) {
    return {
      error: `Unknown tool: ${call.name}`,
    };
  }

  return runTool(call.name, call.parsed_arguments, ctx);
}

export async function runTool(name: ToolName, rawArgs: unknown, ctx: NovToolContext) {
  try {
    switch (name) {
      case "list_leads":
        return await listLeads(listLeadsSchema.parse(rawArgs), ctx);
      case "search_leads":
        return await searchLeads(searchLeadsSchema.parse(rawArgs), ctx);
      case "get_lead":
        return await getLead(getLeadSchema.parse(rawArgs), ctx);
      case "get_pipeline_summary":
        return await getPipelineSummary(ctx);
      case "get_stale_leads":
        return await getStaleLeads(getStaleLeadsSchema.parse(rawArgs), ctx);
      case "draft_email":
        return await draftEmail(draftEmailSchema.parse(rawArgs), ctx);
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tool failed",
    };
  }
}

async function resolveStageId(stage: string, ctx: NovToolContext) {
  const trimmed = stage.trim();

  const { data: byId } = await ctx.supabase
    .from("stages")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("id", trimmed)
    .maybeSingle();

  const stageById = byId as { id: string } | null;
  if (stageById?.id) return stageById.id;

  const { data: byName } = await ctx.supabase
    .from("stages")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .ilike("name", trimmed)
    .maybeSingle();

  const stageByName = byName as { id: string } | null;
  return stageByName?.id ?? null;
}

async function listLeads(args: z.infer<typeof listLeadsSchema>, ctx: NovToolContext) {
  let query = ctx.supabase
    .from("leads")
    .select("id, name, company, email, value, last_activity_at, created_at, stage_id, stages!inner(name, sla_days, is_closed, color, position)")
    .eq("workspace_id", ctx.workspace.id)
    .limit(args.limit ?? 10)
    .order(args.order_by ?? "last_activity_at", {
      ascending: (args.direction ?? "desc") === "asc",
      nullsFirst: false,
    });

  if (args.stage) {
    const stageId = await resolveStageId(args.stage, ctx);
    if (!stageId) {
      return { leads: [], applied_stage: args.stage };
    }
    query = query.eq("stage_id", stageId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    leads: ((data ?? []) as unknown as LeadListItem[]),
  };
}

async function searchLeads(args: z.infer<typeof searchLeadsSchema>, ctx: NovToolContext) {
  const { data, error } = await ctx.supabase
    .from("leads")
    .select("id, name, company, email, phone, value, last_activity_at, stage_id, stages!inner(name, sla_days, is_closed, color, position)")
    .eq("workspace_id", ctx.workspace.id)
    .order("last_activity_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const query = args.query.trim().toLowerCase();
  const filtered = ((data ?? []) as unknown as LeadSearchItem[]).filter((lead) =>
    [lead.name, lead.company, lead.email, lead.phone].some(
      (value) => typeof value === "string" && value.toLowerCase().includes(query)
    )
  );

  return {
    leads: filtered.slice(0, 10),
  };
}

async function getLead(args: z.infer<typeof getLeadSchema>, ctx: NovToolContext) {
  const [leadResult, activitiesResult] = await Promise.all([
    ctx.supabase
      .from("leads")
      .select("*, stages!inner(name, sla_days, is_closed, color, position)")
      .eq("id", args.id)
      .eq("workspace_id", ctx.workspace.id)
      .maybeSingle(),
    ctx.supabase
      .from("activities")
      .select("*")
      .eq("lead_id", args.id)
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (leadResult.error) throw leadResult.error;
  if (!leadResult.data) {
    return { error: "Lead not found" };
  }

  if (activitiesResult.error) throw activitiesResult.error;

  return {
    lead: leadResult.data as unknown as LeadDetail,
    activities: activitiesResult.data ?? [],
  };
}

async function getPipelineSummary(ctx: NovToolContext) {
  const { data: leads, error } = await ctx.supabase
    .from("leads")
    .select("id, name, company, value, stage_id, created_at, last_activity_at, email, phone, notes, stages!inner(name, sla_days, is_closed, color, position)")
    .eq("workspace_id", ctx.workspace.id);

  if (error) throw error;

  const staleLeads = await computeStaleLeads(ctx.supabase, {
    workspaceId: ctx.workspace.id,
  });

  const pipelineLeads = (leads ?? []) as unknown as PipelineLead[];

  const missingRequiredFields = pipelineLeads.filter((lead) =>
    ctx.workspace.required_fields.some((field) => {
      const value = lead[field as keyof PipelineLead];
      if (typeof value === "string") return value.trim().length === 0;
      return value === null || value === undefined;
    })
  );

  const stageCounts = new Map<
    string,
    {
      count: number;
      open_value: number;
      is_closed: boolean;
    }
  >();

  let totalOpenValue = 0;

  for (const lead of pipelineLeads) {
    const stage = lead.stages;
    const existing = stageCounts.get(stage.name) ?? {
      count: 0,
      open_value: 0,
      is_closed: stage.is_closed,
    };

    existing.count += 1;
    if (!stage.is_closed && lead.value) {
      existing.open_value += Number(lead.value);
      totalOpenValue += Number(lead.value);
    }

    stageCounts.set(stage.name, existing);
  }

  return {
    workspace: ctx.workspace.name,
    total_leads: pipelineLeads.length,
    total_open_value: totalOpenValue,
    stale_count: staleLeads.length,
    missing_required_fields_count: missingRequiredFields.length,
    required_fields: ctx.workspace.required_fields,
    stages: Array.from(stageCounts.entries()).map(([name, summary]) => ({
      name,
      ...summary,
    })),
  };
}

async function getStaleLeads(args: z.infer<typeof getStaleLeadsSchema>, ctx: NovToolContext) {
  const staleLeads = await computeStaleLeads(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    limit: args.limit ?? 10,
  });

  return {
    leads: staleLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      value: lead.value,
      stage_name: lead.stage_name,
      sla_days: lead.sla_days,
      last_activity_at: lead.last_activity_at,
      due_at: lead.due_at,
    })),
  };
}

async function draftEmail(args: z.infer<typeof draftEmailSchema>, ctx: NovToolContext) {
  const leadData = await getLead({ id: args.lead_id }, ctx);

  if ("error" in leadData) {
    return leadData;
  }

  const openai = createOpenAIClient();
  const effectiveTone = args.tone ?? normalizeTone(ctx.workspace.nov_preferred_tone);

  const response = await openai.responses.parse({
    model: NOV_MODEL,
    instructions: [
      "You draft follow-up emails for a sales pipeline app.",
      "Return JSON only.",
      "This is a draft, not a sent message.",
      "Write natural business email copy with a clear next step.",
      "If workspace context is provided, use it naturally without sounding templated.",
      ctx.workspace.nov_company_summary
        ? `Business context: ${ctx.workspace.nov_company_summary}`
        : "Business context: not set.",
      ctx.workspace.nov_offer_summary
        ? `Offer context: ${ctx.workspace.nov_offer_summary}`
        : "Offer context: not set.",
      ctx.workspace.nov_target_customer
        ? `Target customer: ${ctx.workspace.nov_target_customer}`
        : "Target customer: not set.",
      ctx.workspace.nov_default_cta
        ? `Default CTA to favor: ${ctx.workspace.nov_default_cta}`
        : "Default CTA: use a natural low-friction next step.",
      ctx.workspace.nov_email_signoff
        ? `Preferred signoff: ${ctx.workspace.nov_email_signoff}`
        : "Preferred signoff: use a natural simple signoff.",
      ctx.workspace.nov_be_concise
        ? "Keep the draft concise."
        : "The draft can be a bit fuller when useful.",
      ctx.workspace.nov_avoid_pushy_language
        ? "Avoid pushy, overly salesy language."
        : "A more assertive sales tone is allowed if it still feels natural.",
      ctx.workspace.nov_include_booking_prompt
        ? "When it fits, include a gentle invitation to book a call or meeting."
        : "Do not force a booking ask unless the user's request clearly calls for it.",
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              intent: args.intent,
              tone: effectiveTone,
              lead: leadData.lead,
              activities: leadData.activities,
            }),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(emailDraftSchema, "nov_draft_email"),
    },
  });

  const draft = response.output_parsed;
  if (!draft) {
    return { error: "Failed to draft email" };
  }

  return {
    subject: draft.subject,
    body: draft.body,
    lead: {
      id: leadData.lead.id,
      name: leadData.lead.name,
      email: leadData.lead.email,
    },
  };
}

function isToolName(name: string): name is ToolName {
  return name in toolSchemas;
}

function normalizeTone(tone: string): "warm" | "direct" | "casual" {
  if (tone === "direct" || tone === "casual") return tone;
  return "warm";
}
