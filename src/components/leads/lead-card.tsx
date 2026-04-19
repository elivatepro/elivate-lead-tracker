"use client";

import Link from "next/link";
import { DollarSign, Clock, Mail } from "lucide-react";
import type { LeadWithStage } from "@/hooks/use-leads";

function daysSince(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function isStale(lead: LeadWithStage) {
  const stage = lead.stages;
  if (stage.is_closed || !stage.sla_days) return false;
  if (lead.snoozed_until && new Date(lead.snoozed_until).getTime() > Date.now())
    return false;
  const dueAt =
    new Date(lead.last_activity_at).getTime() + stage.sla_days * 86400000;
  return Date.now() >= dueAt;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LeadCard({ lead }: { lead: LeadWithStage }) {
  const stale = isStale(lead);
  const email = lead.email?.trim() ?? "";
  const hasEmail = email.length > 0;

  return (
    <div
      className={`bg-card rounded-lg p-3.5 transition-all group border ${
        stale
          ? "border-stale/20 hover:border-stale/40 shadow-sm shadow-stale/5"
          : "border-border/60 hover:border-primary/30 hover:shadow-md hover:-translate-y-px shadow-sm"
      }`}
    >
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-start gap-3">
          {/* Avatar initials */}
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              stale
                ? "bg-stale/8 text-stale"
                : "bg-primary/8 text-primary"
            }`}
          >
            {getInitials(lead.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-medium truncate leading-tight">
                {lead.name}
              </p>
              {stale && (
                <span className="h-1.5 w-1.5 rounded-full bg-stale shrink-0" />
              )}
            </div>
            {lead.company && (
              <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                {lead.company}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2.5 pl-11">
          {lead.value && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
              <DollarSign className="h-3 w-3" />
              {Number(lead.value).toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/50">
            <Clock className="h-3 w-3" />
            {daysSince(lead.last_activity_at)}
          </span>
        </div>

        {lead.source && (
          <div className="mt-2 pl-11">
            <span className="text-[9px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/50 bg-secondary/80 px-1.5 py-0.5 rounded">
              {lead.source}
            </span>
          </div>
        )}
      </Link>

      <div className="mt-3 flex justify-end border-t border-border/50 pt-2.5">
        <button
          type="button"
          disabled={!hasEmail}
          title={hasEmail ? `Email ${lead.name}` : "No email address saved"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!hasEmail) return;
            window.location.href = `mailto:${email}`;
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </button>
      </div>
    </div>
  );
}
