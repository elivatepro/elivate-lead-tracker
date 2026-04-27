"use client";

import { AlertCircle, PartyPopper } from "lucide-react";
import { Header } from "@/components/layout/header";
import { LeadViewNav } from "@/components/layout/lead-view-nav";
import { useLeads } from "@/hooks/use-leads";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadCard } from "@/components/leads/lead-card";
import { daysSince, formatFullCurrency } from "@/lib/lead-utils";

export default function StalePage() {
  const { data: leads = [], isLoading } = useLeads({ stale: true });
  const totalValue = leads.reduce((sum, lead) => sum + (lead.value ?? 0), 0);

  return (
    <>
      <Header
        eyebrow="Stale"
        title="A focused catch-up view for overdue leads."
        subtitle="Everything here has passed its stage SLA. Work from oldest to newest and clear the queue before opening new tabs."
      />

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <LeadViewNav />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Overdue leads", value: leads.length },
              { label: "Oldest touch", value: leads[0] ? daysSince(leads[0].last_activity_at) : "--" },
              { label: "Value at risk", value: formatFullCurrency(totalValue) },
            ].map((item) => (
              <div key={item.label} className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-serif text-2xl tracking-[-0.03em]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel p-4 sm:p-5">
          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading stale leads…</p>
            </div>
          ) : !leads.length ? (
            <EmptyState
              icon={<PartyPopper className="h-8 w-8" />}
              title="No stale leads"
              description="You’re all caught up. Every live opportunity is still within its follow-up window."
            />
          ) : (
            <div className="space-y-5">
              <div className="rounded-[4px] border border-stale/20 bg-stale/8 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-stale" />
                  <div>
                    <p className="font-medium text-stale">Catch-up mode is on</p>
                    <p className="mt-1 text-sm leading-6 text-stale/85">
                      Start with the oldest lead below. Once it has a note, reminder, or stage move, it will leave this view automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
