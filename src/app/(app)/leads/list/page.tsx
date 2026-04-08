"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  useLeads,
  useUpdateLead,
  useDeleteLead,
  type LeadWithStage,
} from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  List,
  AlertCircle,
  Search,
  Trash2,
  DollarSign,
  Clock,
  X,
} from "lucide-react";

function daysSince(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ListPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [stageFilter, setStageFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  const { data: leads, isLoading } = useLeads({
    search: search || undefined,
    stage: stageFilter || undefined,
  });
  const { data: stages } = useStages();
  const deleteLead = useDeleteLead();
  const updateLead = useUpdateLead();

  const allSelected =
    leads && leads.length > 0 && selected.size === leads.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads?.map((l) => l.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function bulkDelete() {
    if (
      !confirm(`Delete ${selected.size} lead${selected.size > 1 ? "s" : ""}?`)
    )
      return;
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md bg-secondary text-foreground"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </Link>
            <Link
              href="/leads/stale"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stale</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ImportLeadsDialog />
            <NewLeadDialog />
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 sm:px-6 py-2 border-b border-primary/20 bg-primary/5">
            <span className="text-[13px] font-medium text-primary">
              {selected.size} selected
            </span>
            <select
              className="h-7 rounded-md border border-input bg-white px-2 py-0.5 text-[12px]"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) bulkChangeStage(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Move to...
              </option>
              {stages?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              variant="destructive"
              size="xs"
              onClick={bulkDelete}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border/40 bg-card/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search leads..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-lg border border-input bg-white px-3 py-1.5 text-[13px]"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All stages</option>
            {stages?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          ) : !leads?.length ? (
            <EmptyState
              title="No leads found"
              description={
                search
                  ? "Try a different search term."
                  : "Add your first lead to get started."
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-border/40 text-[10px] text-muted-foreground/60 uppercase tracking-[0.08em] font-semibold">
                    <th className="text-left px-6 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded accent-primary"
                      />
                    </th>
                    <th className="text-left py-2.5">Name</th>
                    <th className="text-left px-4 py-2.5">Company</th>
                    <th className="text-left px-4 py-2.5">Stage</th>
                    <th className="text-left px-4 py-2.5">Source</th>
                    <th className="text-right px-4 py-2.5">Value</th>
                    <th className="text-left px-4 py-2.5">Activity</th>
                    <th className="text-right px-6 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`border-b border-border/30 hover:bg-secondary/20 transition-colors group ${
                        selected.has(lead.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleOne(lead.id)}
                          className="h-3.5 w-3.5 rounded accent-primary"
                        />
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex items-center gap-2.5"
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/8 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                            {getInitials(lead.name)}
                          </div>
                          <span className="text-[13px] font-medium hover:text-primary transition-colors">
                            {lead.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground/70">
                        {lead.company || "--"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="text-[13px] bg-transparent border-none cursor-pointer p-0 text-muted-foreground"
                          value={lead.stage_id}
                          onChange={(e) =>
                            updateLead.mutate({
                              id: lead.id,
                              stage_id: e.target.value,
                            })
                          }
                        >
                          {stages?.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {lead.source ? (
                          <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-muted-foreground/50 bg-secondary/80 px-1.5 py-0.5 rounded">
                            {lead.source}
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground/40">
                            --
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-right tabular-nums">
                        {lead.value ? (
                          <span className="flex items-center justify-end gap-0.5 text-foreground/80">
                            <DollarSign className="h-3 w-3 text-muted-foreground/40" />
                            {Number(lead.value).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground/50 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {daysSince(lead.last_activity_at)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm(`Delete "${lead.name}"?`)) {
                              deleteLead.mutate(lead.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card list */}
              <div className="md:hidden space-y-2 p-4">
                {leads.map((lead) => (
                  <MobileLeadRow
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    onToggle={() => toggleOne(lead.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function MobileLeadRow({
  lead,
  selected,
  onToggle,
}: {
  lead: LeadWithStage;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Link href={`/leads/${lead.id}`}>
      <div
        className={`bg-card border rounded-lg p-3.5 transition-all ${
          selected ? "border-primary/40 bg-primary/5" : "border-border/60"
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.preventDefault();
              onToggle();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded accent-primary mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium truncate">{lead.name}</p>
            {lead.company && (
              <p className="text-[11px] text-muted-foreground/70 truncate">
                {lead.company}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/50">
              <span>{lead.stages.name}</span>
              {lead.value && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="h-3 w-3" />
                  {Number(lead.value).toLocaleString()}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {daysSince(lead.last_activity_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
