"use client";

import { ArrowUpRight, Building2, Clock3, Mail } from "lucide-react";
import type { LeadWithStage } from "@/hooks/use-leads";
import { buildMailtoHref, splitContactValues } from "@/lib/contacts";
import {
  daysSince,
  formatCompactCurrency,
  getLeadInitials,
  getLeadSlaState,
} from "@/lib/lead-utils";
import { useLeadDetail } from "./lead-detail-viewer";

export type LeadCardDensity = "compact" | "comfortable" | "rich";

export function LeadCard({
  lead,
  density = "rich",
}: {
  lead: LeadWithStage;
  density?: LeadCardDensity;
}) {
  if (density === "compact") return <CompactCard lead={lead} />;
  if (density === "comfortable") return <ComfortableCard lead={lead} />;
  return <RichCard lead={lead} />;
}

function statusClasses(tone: ReturnType<typeof getLeadSlaState>["tone"]) {
  if (tone === "danger") return "text-stale";
  if (tone === "warm") return "text-gold";
  return "text-ink-3";
}

function dotColor(tone: ReturnType<typeof getLeadSlaState>["tone"]) {
  if (tone === "danger") return "bg-stale";
  if (tone === "warm") return "bg-gold";
  return "bg-line-3";
}

function CompactCard({ lead }: { lead: LeadWithStage }) {
  const sla = getLeadSlaState(lead);
  const { openLead } = useLeadDetail();
  return (
    <a
      href={`/leads/${lead.id}`}
      onClick={(e) => openLead(lead.id, e)}
      className={`group flex items-center gap-2.5 rounded-[3px] border bg-card px-3 py-2 transition-colors ${
        sla.stale ? "border-stale/25 bg-[linear-gradient(90deg,rgba(185,79,46,0.04),white_60%)]" : "border-line hover:border-line-3"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-[2px] ${dotColor(sla.tone)}`} />
      <span className="truncate text-[13px] font-medium text-ink">{lead.name}</span>
      <span className="numeric ml-auto text-[12px] text-ink-4">
        {formatCompactCurrency(lead.value)}
      </span>
    </a>
  );
}

function ComfortableCard({ lead }: { lead: LeadWithStage }) {
  const sla = getLeadSlaState(lead);
  const { openLead } = useLeadDetail();
  return (
    <a
      href={`/leads/${lead.id}`}
      onClick={(e) => openLead(lead.id, e)}
      className={`group block rounded-[3px] border bg-card p-3 transition-colors ${
        sla.stale
          ? "border-stale/25 bg-[linear-gradient(180deg,rgba(255,252,249,0.96),rgba(249,232,226,0.92))]"
          : "border-line hover:border-line-3"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-semibold ${
            sla.stale ? "bg-stale/10 text-stale" : "bg-ember-tint text-ember"
          }`}
        >
          {getLeadInitials(lead.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-semibold text-ink">{lead.name}</p>
            <span className="numeric shrink-0 text-[12px] text-ink-3">
              {formatCompactCurrency(lead.value)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-ink-4">
            {lead.company || "Independent lead"}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className={`numeric inline-flex items-center gap-1 ${statusClasses(sla.tone)}`}>
          <Clock3 className="h-3 w-3" />
          {sla.label}
        </span>
        <span className="numeric text-ink-4">{daysSince(lead.last_activity_at)}</span>
      </div>
    </a>
  );
}

function RichCard({ lead }: { lead: LeadWithStage }) {
  const sla = getLeadSlaState(lead);
  const { openLead } = useLeadDetail();
  const emails = splitContactValues(lead.email);
  const hasEmail = emails.length > 0;
  const mailtoHref = buildMailtoHref(lead.email);

  return (
    <div
      className={`group rounded-[3px] border p-3.5 transition-colors ${
        sla.stale
          ? "border-stale/25 bg-[linear-gradient(180deg,rgba(255,252,249,0.96),rgba(249,232,226,0.92))]"
          : "border-line bg-card hover:border-line-3"
      }`}
    >
      <a
        href={`/leads/${lead.id}`}
        onClick={(e) => openLead(lead.id, e)}
        className="block"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] text-[11px] font-semibold ${
              sla.stale ? "bg-stale/10 text-stale" : "bg-ember-tint text-ember"
            }`}
          >
            {getLeadInitials(lead.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold leading-tight text-ink">
                  {lead.name}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-4">
                  {lead.stages.name}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            {lead.company && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-4">
                <Building2 className="h-3 w-3" />
                <p className="truncate">{lead.company}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[3px] border border-line/60 bg-paper-2/40 px-2.5 py-1.5">
            <p className="text-[9.5px] uppercase tracking-[0.16em] text-ink-4">Value</p>
            <p className="numeric mt-0.5 text-[13px] font-medium text-ink">
              {formatCompactCurrency(lead.value)}
            </p>
          </div>
          <div className="rounded-[3px] border border-line/60 bg-paper-2/40 px-2.5 py-1.5">
            <p className="text-[9.5px] uppercase tracking-[0.16em] text-ink-4">Last touch</p>
            <p className="numeric mt-0.5 text-[13px] font-medium text-ink">
              {daysSince(lead.last_activity_at)}
            </p>
          </div>
        </div>

        <div
          className={`numeric mt-2.5 inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 text-[11px] ${
            sla.tone === "danger"
              ? "bg-stale/10 text-stale"
              : sla.tone === "warm"
                ? "bg-gold/10 text-gold"
                : "bg-paper-2 text-ink-3"
          }`}
        >
          <Clock3 className="h-3 w-3" />
          <span>{sla.label}</span>
        </div>
      </a>

      <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2.5">
        {lead.source ? (
          <span className="rounded-[2px] border border-line/70 bg-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            {lead.source}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!hasEmail}
          title={
            hasEmail
              ? `Email ${emails.length > 1 ? `${emails.length} contacts` : lead.name}`
              : "No email saved"
          }
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!mailtoHref) return;
            window.location.href = mailtoHref;
          }}
          className="inline-flex items-center gap-1 rounded-[3px] border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-ink-3 transition-colors hover:border-ember/30 hover:text-ember disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Mail className="h-3 w-3" />
          <span>Email</span>
        </button>
      </div>
    </div>
  );
}
