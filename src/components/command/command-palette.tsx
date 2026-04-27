"use client";

import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  List,
  Mail,
  MoonStar,
  Plus,
  Rows3,
  Search,
  Triangle,
  Settings,
} from "lucide-react";
import { useLeads, useUpdateLead, type LeadWithStage } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { useLeadDetail } from "@/components/leads/lead-detail-viewer";
import { getLeadInitials, getLeadSlaState } from "@/lib/lead-utils";

type Mode =
  | { kind: "root" }
  | { kind: "lead"; lead: LeadWithStage }
  | { kind: "stage"; lead: LeadWithStage };

const VIEWS = [
  { href: "/", label: "Dashboard", note: "Overview", icon: LayoutDashboard },
  { href: "/today", label: "Today", note: "Triage inbox", icon: Inbox },
  { href: "/leads", label: "Pipeline board", note: "Drag & drop", icon: LayoutGrid },
  { href: "/leads/list", label: "Lead list", note: "Bulk edit", icon: Rows3 },
  { href: "/leads/stale", label: "Stale leads", note: "Needs follow-up", icon: Triangle },
  { href: "/settings", label: "Settings", note: "Stages, profile", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "root" });

  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: leads = [] } = useLeads();
  const { data: stages = [] } = useStages();
  const updateLead = useUpdateLead();
  const { openLead: openLeadDetail } = useLeadDetail();

  // Global ⌘K toggle. Plain "k" passes through to inputs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset transient state every time the palette closes.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setMode({ kind: "root" });
    }
  }, [open]);

  const close = () => setOpen(false);

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const aStale = getLeadSlaState(a).stale ? 1 : 0;
      const bStale = getLeadSlaState(b).stale ? 1 : 0;
      if (aStale !== bStale) return bStale - aStale;
      return new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime();
    });
  }, [leads]);

  function jump(href: string) {
    router.push(href);
    close();
  }

  function newLead() {
    window.dispatchEvent(new CustomEvent("open-new-lead-dialog"));
    close();
  }

  function openLead(lead: LeadWithStage) {
    openLeadDetail(lead.id);
    close();
  }

  function snoozeLead(lead: LeadWithStage, days = 3) {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    updateLead.mutate(
      { id: lead.id, snoozed_until: until },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          toast(`Snoozed ${lead.name} for ${days} days`);
        },
      }
    );
    close();
  }

  function markContacted(lead: LeadWithStage) {
    updateLead.mutate(
      { id: lead.id, last_activity_at: new Date().toISOString() },
      {
        onSuccess: () => {
          toast(`${lead.name} — last touch updated`);
        },
      }
    );
    close();
  }

  function changeStage(lead: LeadWithStage, stageId: string) {
    updateLead.mutate(
      { id: lead.id, stage_id: stageId },
      {
        onSuccess: () => {
          const stageName = stages.find((s) => s.id === stageId)?.name ?? "stage";
          toast(`${lead.name} → ${stageName}`);
        },
      }
    );
    close();
  }

  function copyEmail(lead: LeadWithStage) {
    if (!lead.email) {
      toast("No email saved for this lead");
      return;
    }
    navigator.clipboard.writeText(lead.email).then(() => {
      toast(`Copied ${lead.email}`);
    });
    close();
  }

  if (!open) return null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={mode.kind !== "stage"}
      onKeyDown={(e) => {
        // Backspace at empty input rewinds the mode stack.
        if (e.key === "Backspace" && !search && mode.kind !== "root") {
          e.preventDefault();
          setMode(mode.kind === "stage" ? { kind: "lead", lead: mode.lead } : { kind: "root" });
        }
        if (e.key === "Escape") {
          if (mode.kind !== "root") {
            e.preventDefault();
            setMode(mode.kind === "stage" ? { kind: "lead", lead: mode.lead } : { kind: "root" });
            setSearch("");
          }
        }
      }}
    >
      <div
        className="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm"
        onClick={close}
      />
      <div className="fixed left-1/2 top-[12vh] z-[61] w-[min(620px,calc(100vw-32px))] -translate-x-1/2">
        <div className="overflow-hidden rounded-[4px] border border-line bg-card shadow-[0_30px_80px_rgba(20,16,12,0.32)]">
          {/* breadcrumb / context strip */}
          {mode.kind !== "root" && (
            <div className="flex items-center gap-2 border-b border-line/60 bg-paper-2/40 px-4 py-2.5 text-[12px]">
              <button
                type="button"
                onClick={() => {
                  setMode({ kind: "root" });
                  setSearch("");
                }}
                className="font-medium text-ink-3 hover:text-ink"
              >
                Commands
              </button>
              <ArrowRight className="h-3 w-3 text-ink-4" />
              {mode.kind === "stage" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode({ kind: "lead", lead: mode.lead });
                      setSearch("");
                    }}
                    className="font-medium text-ink-3 hover:text-ink"
                  >
                    {mode.lead.name}
                  </button>
                  <ArrowRight className="h-3 w-3 text-ink-4" />
                  <span className="font-medium text-ink">Move to stage…</span>
                </>
              ) : (
                <span className="font-medium text-ink">{mode.lead.name}</span>
              )}
              <span className="ml-auto text-[11px] text-ink-4">
                <kbd className="rounded border border-line bg-white px-1.5 py-[1px] text-[10px]">esc</kbd>
                <span className="ml-1.5">back</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2.5 border-b border-line/60 px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-4" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={
                mode.kind === "root"
                  ? "Search leads, jump to a view, or run an action…"
                  : mode.kind === "stage"
                    ? "Filter stages…"
                    : `Run an action on ${mode.lead.name}…`
              }
              className="h-12 w-full border-0 bg-transparent text-[14px] text-ink placeholder:text-ink-4 focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-line bg-paper-2 px-1.5 py-[1px] text-[10px] font-medium text-ink-4 sm:inline-flex">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-ink-4">
              No results.
            </Command.Empty>

            {mode.kind === "root" && (
              <>
                <Command.Group heading="Quick actions" className="cmdk-group">
                  <PaletteItem
                    onSelect={newLead}
                    icon={<Plus className="h-4 w-4" />}
                    label="New lead"
                    shortcut="N"
                  />
                </Command.Group>

                <Command.Group heading="Jump to" className="cmdk-group">
                  {VIEWS.map((v) => (
                    <PaletteItem
                      key={v.href}
                      onSelect={() => jump(v.href)}
                      icon={<v.icon className="h-4 w-4" />}
                      label={v.label}
                      hint={v.note}
                    />
                  ))}
                </Command.Group>

                {sortedLeads.length > 0 && (
                  <Command.Group heading="Leads" className="cmdk-group">
                    {sortedLeads.slice(0, 24).map((lead) => {
                      const sla = getLeadSlaState(lead);
                      return (
                        <Command.Item
                          key={lead.id}
                          value={`${lead.name} ${lead.company ?? ""} ${lead.email ?? ""} ${lead.source ?? ""}`}
                          onSelect={() => setMode({ kind: "lead", lead })}
                          className="cmdk-item"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ember-tint text-[10px] font-semibold text-ember">
                            {getLeadInitials(lead.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate font-medium text-ink">{lead.name}</span>
                              {lead.company && (
                                <span className="truncate text-[12px] text-ink-4">· {lead.company}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-4">
                              {lead.stages.name}
                              {sla.stale ? (
                                <span className="ml-2 text-stale">{sla.label}</span>
                              ) : (
                                <span className="ml-2">{sla.label}</span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-ink-4" />
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
              </>
            )}

            {mode.kind === "lead" && (
              <Command.Group heading={mode.lead.name} className="cmdk-group">
                <PaletteItem
                  onSelect={() => openLead(mode.lead)}
                  icon={<ArrowRight className="h-4 w-4" />}
                  label="Open lead"
                  hint="View full detail"
                />
                <PaletteItem
                  onSelect={() => markContacted(mode.lead)}
                  icon={<CheckCircle2 className="h-4 w-4 text-won" />}
                  label="Mark as contacted"
                  hint="Resets the SLA timer"
                />
                <PaletteItem
                  onSelect={() => snoozeLead(mode.lead, 3)}
                  icon={<MoonStar className="h-4 w-4" />}
                  label="Snooze 3 days"
                />
                <PaletteItem
                  onSelect={() => snoozeLead(mode.lead, 7)}
                  icon={<MoonStar className="h-4 w-4" />}
                  label="Snooze 1 week"
                />
                <PaletteItem
                  onSelect={() => setMode({ kind: "stage", lead: mode.lead })}
                  icon={<List className="h-4 w-4" />}
                  label="Move to stage…"
                  hint="Pick a destination"
                />
                {mode.lead.email && (
                  <PaletteItem
                    onSelect={() => copyEmail(mode.lead)}
                    icon={<Mail className="h-4 w-4" />}
                    label="Copy email"
                    hint={mode.lead.email}
                  />
                )}
                <PaletteItem
                  onSelect={() =>
                    toast("Reminder cadence updates inside the lead detail panel.", {
                      description: "Coming next: schedule a custom follow-up from here.",
                      icon: <Bell className="h-4 w-4" />,
                    })
                  }
                  icon={<Bell className="h-4 w-4" />}
                  label="Schedule reminder"
                  hint="Soon"
                />
                {mode.lead.company && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 text-[11px] text-ink-4">
                    <Building2 className="h-3.5 w-3.5" />
                    {mode.lead.company}
                  </div>
                )}
              </Command.Group>
            )}

            {mode.kind === "stage" && (
              <Command.Group heading="Move to stage" className="cmdk-group">
                {stages.map((stage) => (
                  <Command.Item
                    key={stage.id}
                    value={stage.name}
                    onSelect={() => changeStage(mode.lead, stage.id)}
                    className="cmdk-item"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-[1px]"
                      style={{ backgroundColor: stage.color || "#c4960a" }}
                    />
                    <span className="flex-1 font-medium text-ink">{stage.name}</span>
                    <span className="text-[11px] text-ink-4">
                      {stage.is_closed ? "Closed" : stage.sla_days ? `${stage.sla_days}d SLA` : "Open"}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-line/60 bg-paper-2/40 px-4 py-2.5 text-[11px] text-ink-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-white px-1.5 py-[1px]">↑↓</kbd> navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-white px-1.5 py-[1px]">↵</kbd> select
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-line bg-white px-1.5 py-[1px]">esc</kbd> back
              </span>
            </div>
            <span className="hidden sm:inline">LeadTracker · ⌘K</span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}

function PaletteItem({
  onSelect,
  icon,
  label,
  hint,
  shortcut,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  shortcut?: string;
}) {
  return (
    <Command.Item value={label} onSelect={onSelect} className="cmdk-item">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-paper-2 text-ink-3">
        {icon}
      </span>
      <span className="flex-1 font-medium text-ink">{label}</span>
      {hint && <span className="text-[11px] text-ink-4">{hint}</span>}
      {shortcut && (
        <kbd className="rounded border border-line bg-white px-1.5 py-[1px] text-[10px] font-medium text-ink-4">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
