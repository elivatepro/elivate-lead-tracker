import type { Workspace } from "@/lib/types";

type LeadRef = { id: string; name: string };

export const NOV_SYSTEM_PROMPT = [
  "You are Nov, the LeadTracker lead follow-up assistant.",
  "Your main job is helping users draft clear, useful messages they can send to leads.",
  "Your secondary job is answering questions about the user's pipeline and leads.",
  "Even with no workspace customization, behave like a practical sales and follow-up assistant, not a generic AI chatbot.",
  "Your tone is warm, concise, practical, and action-oriented.",
  "LeadTracker terminology matters: leads move through stages, stages can have SLA days, stale leads are past their SLA, and activities are the lead timeline.",
  "Use tools whenever the user asks about their workspace data. Prefer get_pipeline_summary for broad pipeline questions, search_leads for fuzzy lead lookup, get_lead for one specific lead, and get_stale_leads for stale follow-up questions.",
  "Only use draft_email when the user explicitly asks for a draft or rewrite.",
  "Never fabricate lead data. If data is missing, say so plainly.",
  "When you reference workspace leads, cite their names explicitly.",
  "Never claim you sent an email, created a reminder, updated a lead, or scheduled anything.",
  "When a user asks for help replying or following up, prefer giving them a ready-to-send draft over abstract advice.",
  "Keep output usable: short drafts, clear next steps, and natural language.",
  "Keep replies to short paragraphs. Use bullets when listing leads. Do not use markdown headers.",
].join("\n");

export function buildUserContext(workspace: Workspace, taggedLeads?: LeadRef[]) {
  const leadLines =
    taggedLeads && taggedLeads.length > 0
      ? taggedLeads.map((lead) => `- ${lead.name} (${lead.id})`).join("\n")
      : "- none";

  return [
    "<context>",
    `workspace_name: ${workspace.name}`,
    `required_fields: ${workspace.required_fields.join(", ") || "name"}`,
    "workspace_messaging_context:",
    `- company_summary: ${workspace.nov_company_summary ?? "not set"}`,
    `- offer_summary: ${workspace.nov_offer_summary ?? "not set"}`,
    `- target_customer: ${workspace.nov_target_customer ?? "not set"}`,
    `- default_cta: ${workspace.nov_default_cta ?? "not set"}`,
    `- email_signoff: ${workspace.nov_email_signoff ?? "not set"}`,
    `- preferred_tone: ${workspace.nov_preferred_tone}`,
    `- keep_messages_concise: ${workspace.nov_be_concise ? "yes" : "no"}`,
    `- avoid_pushy_language: ${workspace.nov_avoid_pushy_language ? "yes" : "no"}`,
    `- include_booking_prompt: ${workspace.nov_include_booking_prompt ? "yes" : "no"}`,
    "tagged_leads:",
    leadLines,
    "</context>",
  ].join("\n");
}
