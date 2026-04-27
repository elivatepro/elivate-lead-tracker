"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SlidersHorizontal } from "lucide-react";
import { Header } from "@/components/layout/header";
import { LeadViewNav } from "@/components/layout/lead-view-nav";
import { useLeads, useUpdateLead, type LeadWithStage } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { ImportLeadsDialog } from "@/components/leads/import-leads-dialog";
import { LeadCard, type LeadCardDensity } from "@/components/leads/lead-card";
import { StageColumn } from "@/components/leads/stage-column";
import { EmptyState } from "@/components/ui/empty-state";
import { groupLeadsByStage } from "@/lib/lead-utils";

const DENSITY_OPTIONS: { key: LeadCardDensity; label: string }[] = [
  { key: "compact", label: "Compact" },
  { key: "comfortable", label: "Comfortable" },
  { key: "rich", label: "Rich" },
];

const DENSITY_KEY = "leadtracker.board.density";

export default function BoardPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: stages = [], isLoading: stagesLoading } = useStages();
  const updateLead = useUpdateLead();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [density, setDensity] = useState<LeadCardDensity>("rich");

  // Hydrate density from localStorage on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(DENSITY_KEY);
    if (saved === "compact" || saved === "comfortable" || saved === "rich") {
      setDensity(saved);
    }
  }, []);

  function handleDensity(next: LeadCardDensity) {
    setDensity(next);
    window.localStorage.setItem(DENSITY_KEY, next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadsByStage = useMemo(
    () => groupLeadsByStage(leads, stages.map((stage) => stage.id)),
    [leads, stages]
  );

  const activeLead = useMemo(
    () => leads.find((lead) => lead.id === activeId) ?? null,
    [activeId, leads]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStageId = over.id as string;
    const lead = leads.find((item) => item.id === leadId);

    if (!lead || lead.stage_id === newStageId) return;
    updateLead.mutate({ id: leadId, stage_id: newStageId });
  }

  const pipelineValue = leads.reduce((sum, lead) => sum + (lead.value ?? 0), 0);
  const isLoading = leadsLoading || stagesLoading;

  return (
    <>
      <Header
        eyebrow="Pipeline"
        title="A board you can read at a glance."
        subtitle="Drag leads stage to stage, keep the reminder state visible on every card, and switch density to match the depth you need right now."
        actions={
          <div className="flex items-center gap-2">
            <ImportLeadsDialog />
            <NewLeadDialog />
          </div>
        }
      />

      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <LeadViewNav />
            <div className="inline-flex items-center gap-2 rounded-[3px] border border-line bg-card px-2.5 py-1 text-[12px] text-ink-3">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Density
              <div className="ml-1 inline-flex rounded-[3px] bg-paper-2 p-0.5">
                {DENSITY_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleDensity(option.key)}
                    className={`rounded-[2px] px-2 py-1 text-[11px] font-medium transition-colors ${
                      density === option.key
                        ? "bg-white text-ink shadow-sm"
                        : "text-ink-4 hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Open stages", value: stages.filter((stage) => !stage.is_closed).length },
              { label: "Live leads", value: leads.length },
              { label: "Pipeline value", value: `$${pipelineValue.toLocaleString()}` },
            ].map((item) => (
              <div key={item.label} className="rounded-[3px] border border-line bg-card px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-4">{item.label}</p>
                <p className="numeric mt-1.5 font-display text-2xl tracking-[-0.02em] text-ink">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="surface-panel flex min-h-[360px] items-center justify-center">
            <p className="text-sm text-ink-4">Loading pipeline…</p>
          </div>
        ) : !stages.length ? (
          <EmptyState
            title="No stages configured"
            description="Create your first pipeline stages in settings, then the board will lay itself out around them."
            action={{ label: "Open stage settings", href: "/settings/stages" }}
          />
        ) : (
          <div className="surface-panel overflow-hidden p-4 sm:p-5">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-w-max gap-4 overflow-x-auto pb-2">
                {stages.map((stage) => (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    leads={leadsByStage[stage.id] ?? []}
                    density={density}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeLead ? (
                  <LeadCard lead={activeLead as LeadWithStage} density={density} />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </>
  );
}
