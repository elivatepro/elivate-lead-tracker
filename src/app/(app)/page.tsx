"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { useLeads } from "@/hooks/use-leads";
import { formatCompactCurrency, getLeadSlaState } from "@/lib/lead-utils";

type DashboardData = {
  activeLeads: number;
  staleLeads: number;
  incompleteLeads: number;
  addedThisWeek: number;
  pipelineValue: number;
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });
  const { data: leads = [] } = useLeads();

  const stale = leads
    .filter((l) => getLeadSlaState(l).stale)
    .sort(
      (a, b) =>
        new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
    )
    .slice(0, 4);

  const active = data?.activeLeads ?? 0;
  const staleCount = data?.staleLeads ?? 0;

  return (
    <>
      <Header
        eyebrow="Dashboard"
        title={
          isLoading
            ? "Loading your pipeline…"
            : `${active} leads in motion, ${staleCount} going stale.`
        }
        actions={
          <div className="flex items-center gap-2">
            <ImportLeadsDialog />
            <NewLeadDialog />
          </div>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Active"
            value={isLoading ? "--" : active}
            delta={data?.addedThisWeek ? `+${data.addedThisWeek} this week` : undefined}
            tone="ember"
            href="/leads"
          />
          <Stat
            label="Stale"
            value={isLoading ? "--" : staleCount}
            delta={staleCount > 0 ? "Needs touch" : "All caught up"}
            tone="stale"
            href="/leads/stale"
          />
          <Stat
            label="Incomplete"
            value={isLoading ? "--" : data?.incompleteLeads ?? 0}
            delta={
              (data?.incompleteLeads ?? 0) > 0 ? "Missing fields" : "Clean records"
            }
            tone="gold"
          />
          <Stat
            label="Pipeline"
            value={
              isLoading
                ? "--"
                : formatCompactCurrency(data?.pipelineValue ?? 0).replace("No value", "$0")
            }
            tone="ink"
          />
        </section>

        <section className="overflow-hidden rounded-[4px] border border-line bg-card">
          <header className="flex items-center justify-between gap-4 px-5 py-3.5">
            <h2 className="font-display text-[18px] tracking-[-0.01em] text-ink">
              Stalest follow-ups
            </h2>
            <Link
              href="/leads/stale"
              className="text-[12px] font-medium text-ink-4 hover:text-ember"
            >
              Open all →
            </Link>
          </header>
          {stale.length === 0 ? (
            <p className="border-t border-line/70 px-5 py-10 text-center text-[13px] text-ink-4">
              Nothing is stale right now. Open the board to keep momentum.
            </p>
          ) : (
            <ul className="divide-y divide-line/60 border-t border-line/70">
              {stale.map((lead) => {
                const sla = getLeadSlaState(lead);
                const overdueDays = sla.label.match(/\d+/)?.[0];
                return (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper-2/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {lead.name}
                        </p>
                        <p className="truncate text-[12px] text-ink-4">
                          {[lead.company, lead.stages.name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <StageBadge stage={lead.stages.name} />
                      <p className="numeric w-16 text-right text-[13px] font-medium text-ink-2">
                        {formatCompactCurrency(lead.value)}
                      </p>
                      <p className="numeric w-10 text-right text-[12px] text-ink-4">
                        {overdueDays ? `${overdueDays}d` : "—"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  delta,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone: "ember" | "stale" | "gold" | "ink";
  href?: string;
}) {
  const deltaColor = {
    ember: "text-ember",
    stale: "text-stale",
    gold: "text-gold",
    ink: "text-ink-4",
  }[tone];

  const body = (
    <div className="rounded-[3px] border border-line bg-card px-4 py-3.5 transition-colors hover:border-line-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
        {label}
      </p>
      <p className="numeric mt-1.5 font-display text-[28px] leading-none tracking-[-0.02em] text-ink">
        {value}
      </p>
      {delta ? (
        <p className={`mt-1.5 text-[11px] ${deltaColor}`}>{delta}</p>
      ) : (
        <p className="mt-1.5 text-[11px] text-ink-4">&nbsp;</p>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function StageBadge({ stage }: { stage: string }) {
  const lower = stage.toLowerCase();
  const tone = lower.includes("won")
    ? "won"
    : lower.includes("lost")
      ? "lost"
      : lower.includes("propos") || lower.includes("negot")
        ? "ember"
        : lower.includes("qualif") || lower.includes("contact")
          ? "gold"
          : "neutral";

  const styles = {
    ember: "bg-ember-tint text-ember",
    gold: "bg-gold/12 text-gold",
    won: "bg-won/12 text-won",
    lost: "bg-lost/15 text-lost",
    neutral: "bg-paper-2 text-ink-3",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] ${styles}`}
    >
      {stage}
    </span>
  );
}
