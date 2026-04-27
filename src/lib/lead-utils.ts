import type { LeadWithStage } from "@/hooks/use-leads";

const DAY_MS = 86_400_000;

export function getLeadInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatCompactCurrency(value: number | null | undefined) {
  if (!value) return "No value";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatFullCurrency(value: number | null | undefined) {
  if (!value) return "--";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / DAY_MS);

  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function getLeadSlaState(lead: LeadWithStage, now = Date.now()) {
  const stage = lead.stages;

  if (stage.is_closed) {
    return {
      stale: false,
      label: "Closed out",
      tone: "neutral" as const,
      detail: "No reminder cadence on closed stages.",
    };
  }

  if (lead.snoozed_until && new Date(lead.snoozed_until).getTime() > now) {
    const diff = new Date(lead.snoozed_until).getTime() - now;
    const days = Math.ceil(diff / DAY_MS);
    return {
      stale: false,
      label: `Snoozed for ${days}d`,
      tone: "warm" as const,
      detail: "Reminders are paused until the snooze window ends.",
    };
  }

  if (!stage.sla_days) {
    return {
      stale: false,
      label: "No SLA",
      tone: "neutral" as const,
      detail: "This stage does not have a follow-up timer.",
    };
  }

  const dueAt = new Date(lead.last_activity_at).getTime() + stage.sla_days * DAY_MS;
  const diff = dueAt - now;

  if (diff <= 0) {
    const overdueDays = Math.max(1, Math.ceil(Math.abs(diff) / DAY_MS));
    return {
      stale: true,
      label: overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`,
      tone: "danger" as const,
      detail: "This lead has passed its follow-up window.",
    };
  }

  const daysLeft = Math.ceil(diff / DAY_MS);
  return {
    stale: false,
    label: daysLeft === 1 ? "Due in 1 day" : `Due in ${daysLeft} days`,
    tone: "ok" as const,
    detail: "Next reminder is still within the stage SLA.",
  };
}

export function groupLeadsByStage(leads: LeadWithStage[], stageIds: string[]) {
  const grouped = Object.fromEntries(stageIds.map((stageId) => [stageId, [] as LeadWithStage[]]));

  for (const lead of leads) {
    if (grouped[lead.stage_id]) grouped[lead.stage_id].push(lead);
  }

  return grouped;
}
