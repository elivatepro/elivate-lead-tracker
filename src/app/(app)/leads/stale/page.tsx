"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useLeads } from "@/hooks/use-leads";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadCard } from "@/components/leads/lead-card";
import { LayoutGrid, List, AlertCircle, PartyPopper } from "lucide-react";

export default function StalePage() {
  const { data: leads, isLoading } = useLeads({ stale: true });

  return (
    <>
      <Header title="Leads" />
      <div className="flex flex-col h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/60">
          <div className="flex items-center gap-1">
            <Link
              href="/leads"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Board</span>
            </Link>
            <Link
              href="/leads/list"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </Link>
            <Link
              href="/leads/stale"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md bg-secondary text-foreground"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stale</span>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          ) : !leads?.length ? (
            <EmptyState
              icon={<PartyPopper className="h-10 w-10" />}
              title="No stale leads"
              description="You're all caught up! Every lead is within its follow-up SLA."
            />
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {leads.length} lead{leads.length === 1 ? "" : "s"} past their
                follow-up SLA. Oldest first.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
