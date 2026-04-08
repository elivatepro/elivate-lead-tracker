"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { useLeads, useUpdateLead, type LeadWithStage } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { LeadCard } from "@/components/leads/lead-card";
import { StageColumn } from "@/components/leads/stage-column";
import { EmptyState } from "@/components/ui/empty-state";
import { LayoutGrid, List, AlertCircle } from "lucide-react";

export default function BoardPage() {
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: stages, isLoading: stagesLoading } = useStages();
  const updateLead = useUpdateLead();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadWithStage[]> = {};
    stages?.forEach((s) => {
      map[s.id] = [];
    });
    leads?.forEach((lead) => {
      if (map[lead.stage_id]) {
        map[lead.stage_id].push(lead);
      }
    });
    return map;
  }, [leads, stages]);

  const activeLead = useMemo(
    () => leads?.find((l) => l.id === activeId) ?? null,
    [leads, activeId]
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

    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === newStageId) return;

    updateLead.mutate({ id: leadId, stage_id: newStageId });
  }

  const isLoading = leadsLoading || stagesLoading;

  return (
    <>
      <Header title="Leads" />
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/60">
          <div className="flex items-center gap-1">
            <Link
              href="/leads"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md bg-secondary text-foreground"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Stale</span>
            </Link>
          </div>
          <NewLeadDialog />
        </div>

        {/* Board */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Loading pipeline...</p>
          </div>
        ) : !stages?.length ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="No stages configured"
              description="Set up your pipeline stages in Settings to get started."
              action={{ label: "Go to settings", href: "/settings/stages" }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 sm:gap-4 p-4 sm:p-6 h-full min-w-max">
                {stages.map((stage) => (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    leads={leadsByStage[stage.id] ?? []}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeLead ? <LeadCard lead={activeLead} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </>
  );
}
