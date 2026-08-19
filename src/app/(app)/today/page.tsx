"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Triangle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { TodayRow } from "@/components/today/today-row";
import { useLeads, type LeadWithStage } from "@/hooks/use-leads";
import { getLeadSlaState } from "@/lib/lead-utils";

const DAY_MS = 86_400_000;

type Bucket = {
  key: "overdue" | "due-soon" | "fresh";
  title: string;
  leads: LeadWithStage[];
};

export default function TodayPage() {
  const { data: leads = [], isLoading } = useLeads();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const buckets = useMemo<Bucket[]>(() => {
    const overdue: LeadWithStage[] = [];
    const dueSoon: LeadWithStage[] = [];
    const fresh: LeadWithStage[] = [];

    for (const lead of leads) {
      // Skip closed and snoozed leads.
      if (lead.stages.is_closed) continue;
      if (lead.snoozed_until && new Date(lead.snoozed_until).getTime() > now) continue;

      const sla = getLeadSlaState(lead, now);
      if (sla.stale) {
        overdue.push(lead);
        continue;
      }

      if (lead.stages.sla_days) {
        const dueAt = new Date(lead.last_activity_at).getTime() + lead.stages.sla_days * DAY_MS;
        if (dueAt - now <= 2 * DAY_MS) {
          dueSoon.push(lead);
          continue;
        }
      }

      // Newly added in the last 3 days that haven't been nudged anywhere yet.
      if (now - new Date(lead.created_at).getTime() <= 3 * DAY_MS) {
        fresh.push(lead);
      }
    }

    overdue.sort(
      (a, b) =>
        new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
    );
    dueSoon.sort((a, b) => {
      const aDue = new Date(a.last_activity_at).getTime() + (a.stages.sla_days ?? 0) * DAY_MS;
      const bDue = new Date(b.last_activity_at).getTime() + (b.stages.sla_days ?? 0) * DAY_MS;
      return aDue - bDue;
    });
    fresh.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return [
      {
        key: "overdue",
        title: "Overdue",
        leads: overdue,
      },
      {
        key: "due-soon",
        title: "Due soon",
        leads: dueSoon,
      },
      {
        key: "fresh",
        title: "Recently added",
        leads: fresh.slice(0, 8),
      },
    ];
  }, [leads, now]);

  const total = buckets.reduce((sum, b) => sum + b.leads.length, 0);
  const overdueCount = buckets[0].leads.length;

  return (
    <>
      <Header
        title="Today"
        actions={
          <div className="flex items-center gap-2">
            <ImportLeadsDialog />
            <NewLeadDialog />
          </div>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="In focus"
            value={total}
            tone="neutral"
          />
          <SummaryTile
            label="Overdue"
            value={overdueCount}
            tone={overdueCount === 0 ? "neutral" : "danger"}
          />
          <SummaryTile
            label="Due soon"
            value={buckets[1].leads.length}
            tone="warm"
          />
        </section>

        {isLoading ? (
          <div className="surface-panel flex min-h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading the desk…</p>
          </div>
        ) : total === 0 ? (
          <EmptyDesk hasAnyLeads={leads.length > 0} />
        ) : (
          <div className="space-y-5">
            {buckets.map((bucket) =>
              bucket.leads.length === 0 ? null : (
                <TodaySection key={bucket.key} bucket={bucket} />
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TodaySection({ bucket }: { bucket: Bucket }) {
  const isOverdue = bucket.key === "overdue";

  return (
    <section
      className={`overflow-hidden rounded-[4px] border bg-card ${
        isOverdue
          ? "border-stale/25 shadow-[0_8px_30px_rgba(185,79,46,0.06)]"
          : "border-line shadow-[0_8px_30px_rgba(38,28,18,0.04)]"
      }`}
    >
      <header className="flex items-center justify-between gap-4 border-b border-line/70 bg-paper-2/40 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[20px] tracking-[-0.01em] text-ink">{bucket.title}</h2>
          <span className="numeric rounded-[2px] border border-line bg-card px-1.5 py-px text-[11px] font-medium text-ink-3">
            {bucket.leads.length}
          </span>
        </div>
      </header>

      <div>
        {bucket.leads.map((lead) => (
          <TodayRow key={lead.id} lead={lead} />
        ))}
      </div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "warm" | "danger";
}) {
  const accent =
    tone === "danger"
      ? "border-stale/30 bg-stale/[0.04]"
      : tone === "warm"
        ? "border-gold/30 bg-gold/[0.04]"
        : "border-line bg-card";
  const valueClass =
    tone === "danger" ? "text-stale" : tone === "warm" ? "text-gold" : "text-ink";

  return (
    <div className={`rounded-[3px] border px-5 py-4 ${accent}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">{label}</p>
      <p className={`numeric mt-2 font-display text-[36px] leading-none tracking-[-0.03em] ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyDesk({ hasAnyLeads }: { hasAnyLeads: boolean }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-5 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-ember-tint text-ember">
        <Sparkles className="h-4 w-4" />
      </div>
      <h2 className="font-display text-[22px] tracking-[-0.01em] text-ink">
        {hasAnyLeads ? "The desk is clear." : "Add your first lead."}
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-line-3"
        >
          Open the board <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/leads/stale"
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-line-3"
        >
          <Triangle className="h-3.5 w-3.5" /> Stale
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-line bg-paper-2/60 px-3 py-1.5 text-[12px] text-ink-4">
          <kbd>⌘K</kbd> command palette
        </span>
      </div>
    </div>
  );
}
