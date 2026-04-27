"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { LeadViewNav } from "@/components/layout/lead-view-nav";
import { useLeads, useUpdateLead } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { useLeadDetail } from "@/components/leads/lead-detail-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysSince, formatFullCurrency, getLeadInitials, getLeadSlaState } from "@/lib/lead-utils";

export default function ListPage() {
  return (
    <Suspense fallback={<ListPageFallback />}>
      <ListPageContent />
    </Suspense>
  );
}

function ListPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState<string | undefined>(undefined);
  const [stageFilter, setStageFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: stages = [] } = useStages();
  const updateLead = useUpdateLead();
  const { openLead } = useLeadDetail();
  const search = searchDraft ?? searchParams.get("q") ?? "";

  const { data: leads = [], isLoading } = useLeads({
    search: search || undefined,
    stage: stageFilter || undefined,
  });

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const selectedCount = selected.size;

  const selectedStats = useMemo(() => {
    const picked = leads.filter((lead) => selected.has(lead.id));
    return {
      count: picked.length,
      value: picked.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
    };
  }, [leads, selected]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }

    setSelected(new Set(leads.map((lead) => lead.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedCount} lead${selectedCount > 1 ? "s" : ""}?`)) return;

    for (const id of selected) {
      await fetch(`/api/leads/${id}`, { method: "DELETE" });
    }

    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function bulkChangeStage(stageId: string) {
    for (const id of selected) {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      });
    }

    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <>
      <Header
        eyebrow="Lead list"
        title="A clean table for bulk work."
        subtitle="Search, fix incomplete records, change stages in batches, and keep reminder state visible while you edit."
        actions={
          <div className="flex items-center gap-2">
            <ImportLeadsDialog />
            <NewLeadDialog />
          </div>
        }
      />

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <LeadViewNav />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Visible leads", value: leads.length },
              { label: "Selected", value: selectedStats.count },
              { label: "Selected value", value: formatFullCurrency(selectedStats.value) },
            ].map((item) => (
              <div key={item.label} className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-serif text-2xl tracking-[-0.03em]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="surface-panel flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-foreground">{selectedCount} lead{selectedCount > 1 ? "s" : ""} selected</p>
              <p className="text-sm text-muted-foreground">Move them together or clear them out after review.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <select
                className="h-10 rounded-[3px] border border-input bg-white px-4 text-sm"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) bulkChangeStage(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Move to stage…
                </option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <Button variant="destructive" className="rounded-[3px]" onClick={bulkDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="ghost" className="rounded-[3px]" onClick={() => setSelected(new Set())}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        <div className="surface-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Search by lead, company, email, or source"
                className="h-11 rounded-[3px] pl-10"
                value={search}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
            <select
              className="h-11 rounded-[3px] border border-input bg-white px-4 text-sm"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All stages</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading leads…</p>
            </div>
          ) : !leads.length ? (
            <EmptyState
              title="No leads match this view"
              description={search ? "Try a broader search or clear the active stage filter." : "Add your first lead to start building the table."}
            />
          ) : (
            <div className="overflow-hidden rounded-[4px] border border-border/70">
              <div className="hidden grid-cols-[44px_1.2fr_1fr_0.8fr_0.8fr_0.7fr] gap-4 bg-secondary/45 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:grid">
                <div>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded accent-primary"
                  />
                </div>
                <div>Lead</div>
                <div>Stage and company</div>
                <div>Reminder</div>
                <div>Last touch</div>
                <div className="text-right">Value</div>
              </div>

              <div className="divide-y divide-border/70 bg-white/80">
                {leads.map((lead) => {
                  const state = getLeadSlaState(lead);

                  return (
                    <div
                      key={lead.id}
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[44px_1.2fr_1fr_0.8fr_0.8fr_0.7fr] lg:px-5"
                    >
                      <div className="flex items-start pt-1">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleOne(lead.id)}
                          className="h-4 w-4 rounded accent-primary"
                        />
                      </div>

                      <a
                        href={`/leads/${lead.id}`}
                        onClick={(e) => openLead(lead.id, e)}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-primary/10 text-[11px] font-bold text-primary">
                          {getLeadInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{lead.name}</p>
                          <p className="truncate text-sm text-muted-foreground">{lead.email || "No email saved"}</p>
                        </div>
                      </a>

                      <div className="space-y-2">
                        <select
                          className="h-10 w-full rounded-[3px] border border-input bg-white px-4 text-sm"
                          value={lead.stage_id}
                          onChange={(e) => updateLead.mutate({ id: lead.id, stage_id: e.target.value })}
                        >
                          {stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-sm text-muted-foreground">{lead.company || "Independent lead"}</p>
                      </div>

                      <div>
                        <p className={`text-sm font-medium ${state.stale ? "text-stale" : "text-foreground"}`}>
                          {state.label}
                        </p>
                        <p className="text-sm text-muted-foreground">{lead.source || "No source"}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium">{daysSince(lead.last_activity_at)}</p>
                        <p className="text-sm text-muted-foreground">{lead.reminder_sent_at ? "Reminder sent" : "No reminder yet"}</p>
                      </div>

                      <div className="text-left lg:text-right">
                        <p className="font-medium">{formatFullCurrency(lead.value)}</p>
                        <p className="text-sm text-muted-foreground">{lead.tags?.length ? `${lead.tags.length} tags` : "No tags"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ListPageFallback() {
  return (
    <>
      <Header
        eyebrow="Lead list"
        title="A clean table for bulk work."
        subtitle="Search, fix incomplete records, change stages in batches, and keep reminder state visible while you edit."
      />

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="surface-panel flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        </div>
      </div>
    </>
  );
}
