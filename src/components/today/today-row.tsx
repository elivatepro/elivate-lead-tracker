"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Mail,
  MoonStar,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLeadDetail } from "@/components/leads/lead-detail-viewer";
import { useUpdateLead, type LeadWithStage } from "@/hooks/use-leads";
import { buildMailtoHref, splitContactValues } from "@/lib/contacts";
import {
  daysSince,
  formatCompactCurrency,
  getLeadInitials,
  getLeadSlaState,
} from "@/lib/lead-utils";

type TodayRowProps = {
  lead: LeadWithStage;
};

export function TodayRow({ lead }: TodayRowProps) {
  const sla = getLeadSlaState(lead);
  const updateLead = useUpdateLead();
  const queryClient = useQueryClient();
  const { openLead } = useLeadDetail();
  const [busy, setBusy] = useState<null | "contact" | "snooze">(null);

  const emails = splitContactValues(lead.email);
  const phones = splitContactValues(lead.phone);
  const mailtoHref = buildMailtoHref(lead.email);

  function snooze(days: number) {
    setBusy("snooze");
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    updateLead.mutate(
      { id: lead.id, snoozed_until: until },
      {
        onSuccess: () => {
          toast(`Snoozed ${lead.name} for ${days} days`);
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        onSettled: () => setBusy(null),
      }
    );
  }

  function markContacted() {
    setBusy("contact");
    updateLead.mutate(
      { id: lead.id, last_activity_at: new Date().toISOString() },
      {
        onSuccess: () => {
          toast(`${lead.name} — last touch updated`);
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        onSettled: () => setBusy(null),
      }
    );
  }

  return (
    <article
      className={`group relative flex flex-col gap-3 border-b border-line/60 px-4 py-4 transition-colors last:border-b-0 hover:bg-paper-2/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-5 ${
        sla.stale ? "bg-[linear-gradient(90deg,rgba(185,79,46,0.04),transparent_60%)]" : ""
      }`}
    >
      {/* status rail */}
      <span
        aria-hidden
        className={`absolute left-0 top-4 bottom-4 w-[2px] ${
          sla.tone === "danger"
            ? "bg-stale"
            : sla.tone === "warm"
              ? "bg-gold"
              : "bg-line"
        }`}
      />

      {/* avatar + name + meta */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] text-[11px] font-semibold ${
            sla.stale ? "bg-stale/10 text-stale" : "bg-ember-tint text-ember"
          }`}
        >
          {getLeadInitials(lead.name)}
        </div>

        <div className="min-w-0 flex-1">
          <a
            href={`/leads/${lead.id}`}
            onClick={(e) => openLead(lead.id, e)}
            className="group/name inline-flex items-baseline gap-2"
          >
            <span className="truncate text-[15px] font-semibold text-ink">{lead.name}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-4 transition-transform group-hover/name:-translate-y-0.5 group-hover/name:translate-x-0.5" />
          </a>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-4">
            {lead.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span className="truncate max-w-[180px]">{lead.company}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: lead.stages.color || "#c4960a" }}
              />
              {lead.stages.name}
            </span>
            {lead.source && <span>· {lead.source}</span>}
          </div>
        </div>
      </div>

      {/* SLA + value, fixed-width on desktop so rows align */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center sm:gap-6">
        <div className="sm:w-[140px]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-4">Status</p>
          <p
            className={`numeric mt-0.5 text-sm font-medium ${
              sla.tone === "danger"
                ? "text-stale"
                : sla.tone === "warm"
                  ? "text-gold"
                  : "text-ink"
            }`}
          >
            {sla.label}
          </p>
        </div>
        <div className="sm:w-[100px]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-4">Value</p>
          <p className="numeric mt-0.5 text-sm font-medium text-ink">
            {formatCompactCurrency(lead.value)}
          </p>
        </div>
        <div className="hidden sm:block sm:w-[80px]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-4">Touch</p>
          <p className="numeric mt-0.5 text-sm font-medium text-ink">
            {daysSince(lead.last_activity_at)}
          </p>
        </div>
      </div>

      {/* row actions */}
      <div className="flex items-center gap-1.5 sm:ml-auto">
        <button
          type="button"
          onClick={markContacted}
          disabled={busy === "contact"}
          title="Mark as contacted (resets the SLA timer)"
          className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line bg-card px-2.5 text-[12px] font-medium text-ink-3 transition-colors hover:border-won/40 hover:text-won disabled:opacity-60"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Contacted</span>
        </button>
        <button
          type="button"
          onClick={() => snooze(3)}
          disabled={busy === "snooze"}
          title="Snooze 3 days"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-card text-ink-3 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-60"
        >
          <MoonStar className="h-3.5 w-3.5" />
        </button>
        {emails.length > 0 && mailtoHref && (
          <a
            href={mailtoHref}
            title={`Email ${emails[0]}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-card text-ink-3 transition-colors hover:border-ember/40 hover:text-ember"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-card text-ink-3 transition-colors hover:border-line-3 hover:text-ink">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href={`/leads/${lead.id}`} />}>
              Open lead
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(7)}>Snooze 1 week</DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(14)}>Snooze 2 weeks</DropdownMenuItem>
            {phones.length > 0 && (
              <DropdownMenuItem render={<a href={`tel:${phones[0]}`} />}>
                <Phone className="h-3.5 w-3.5" /> Call {phones[0]}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
