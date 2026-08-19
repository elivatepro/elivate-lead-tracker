"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Search, Send, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { LeadViewNav } from "@/components/layout/lead-view-nav";
import { useLeads, useUpdateLead } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { useTags } from "@/hooks/use-tags";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { EmailComposeDialog } from "@/components/emails/email-compose-dialog";
import { useLeadDetail } from "@/components/leads/lead-detail-viewer";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [bulkStage, setBulkStage] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [archivedView, setArchivedView] = useState(false);
  const { data: allTags = [] } = useTags();
  const { data: stages = [] } = useStages();
  const updateLead = useUpdateLead();
  const { openLead } = useLeadDetail();
  const search = searchDraft ?? searchParams.get("q") ?? "";

  const { data: leads = [], isLoading } = useLeads({
    search: search || undefined,
    stage: stageFilter || undefined,
    archived: archivedView || undefined,
  });

  const visibleLeads = tagFilter
    ? leads.filter((lead) => lead.tags.includes(tagFilter))
    : leads;

  const allSelected = visibleLeads.length > 0 && selected.size === visibleLeads.length;
  const selectedCount = selected.size;

  const selectedStats = useMemo(() => {
    const picked = visibleLeads.filter((lead) => selected.has(lead.id));
    return {
      count: picked.length,
      value: picked.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
    };
  }, [visibleLeads, selected]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }

    setSelected(new Set(visibleLeads.map((lead) => lead.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulkArchive() {
    if (!confirm(`Archive ${selectedCount} lead${selectedCount > 1 ? "s" : ""}?`)) return;

    for (const id of selected) {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived_at: new Date().toISOString() }),
      });
    }

    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function bulkRestore() {
    for (const id of selected) {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived_at: null }),
      });
    }

    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function bulkPermanentDelete() {
    if (!confirm(`Delete ${selectedCount} lead${selectedCount > 1 ? "s" : ""} permanently?`)) return;

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
        title="Lead list"
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
              { label: "Visible leads", value: visibleLeads.length },
              { label: "Selected", value: selectedStats.count },
              { label: "Selected value", value: formatFullCurrency(selectedStats.value) },
            ].map((item) => (
              <div key={item.label} className="rounded-[3px] border border-border/70 bg-card/75 px-4 py-3">
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
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {archivedView ? (
                <>
                  <Button variant="outline" className="rounded-[3px]" onClick={bulkRestore}>
                    <ArchiveRestore className="h-4 w-4" />
                    Restore
                  </Button>
                  <Button variant="destructive" className="rounded-[3px]" onClick={bulkPermanentDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Select
                    value={bulkStage || null}
                    onValueChange={(value) => {
                      if (value) bulkChangeStage(value);
                      setBulkStage("");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-[3px] bg-card px-4">
                      <SelectValue placeholder="Move to stage…" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="rounded-[3px]"
                    onClick={() => setComposeOpen(true)}
                  >
                    <Send className="h-4 w-4" />
                    Email
                  </Button>
                  <Button variant="destructive" className="rounded-[3px]" onClick={bulkArchive}>
                    <Archive className="h-4 w-4" />
                    Archive
                  </Button>
                </>
              )}
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
<Select
              value={stageFilter || null}
              onValueChange={(value) => setStageFilter(value ?? "")}
            >
              <SelectTrigger className="h-11 rounded-[3px] bg-card px-4">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent className="w-full" align="start">
                <SelectItem value="">All stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tagFilter || null}
              onValueChange={(value) => setTagFilter(value ?? "")}
            >
              <SelectTrigger className="h-11 rounded-[3px] bg-card px-4">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent className="w-full" align="start">
                <SelectItem value="">All tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className={`h-11 rounded-[3px] px-4 ${archivedView ? "bg-ink text-paper" : ""}`}
              onClick={() => {
                setArchivedView((prev) => !prev);
                setSelected(new Set());
              }}
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading leads…</p>
            </div>
          ) : !visibleLeads.length ? (
            <EmptyState
              title={search ? "No matches" : "No leads yet"}
              description={search ? "Try a broader search." : "Add a lead to get started."}
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

              <div className="divide-y divide-border/70 bg-card/80">
                {visibleLeads.map((lead) => {
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
                        <Select
                          value={lead.stage_id}
                          onValueChange={(value) =>
                            value && updateLead.mutate({ id: lead.id, stage_id: value })
                          }
                        >
                          <SelectTrigger className="h-10 w-full rounded-[3px] bg-card px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="w-full" align="start">
                            {stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        {archivedView ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateLead.mutate({ id: lead.id, archived_at: null })
                            }
                            className="text-sm text-primary transition-colors hover:text-primary/70 hover:underline"
                          >
                            Restore
                          </button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {lead.tags?.length ? `${lead.tags.length} tags` : "No tags"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <EmailComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          leads={leads
            .filter((lead) => selected.has(lead.id))
            .map((lead) => ({ id: lead.id, name: lead.name, email: lead.email }))}
        />
      </div>
    </>
  );
}

function ListPageFallback() {
  return (
    <>
      <Header
        title="Lead list"
      />

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="surface-panel flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        </div>
      </div>
    </>
  );
}
