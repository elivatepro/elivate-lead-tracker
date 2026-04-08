"use client";

import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { LeadCard } from "./lead-card";
import type { Stage } from "@/lib/types";
import type { LeadWithStage } from "@/hooks/use-leads";

function DraggableLeadCard({ lead }: { lead: LeadWithStage }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`transition-opacity ${isDragging ? "opacity-30" : ""}`}
      {...listeners}
      {...attributes}
    >
      <LeadCard lead={lead} />
    </div>
  );
}

export function StageColumn({
  stage,
  leads,
}: {
  stage: Stage;
  leads: LeadWithStage[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`w-64 sm:w-72 shrink-0 flex flex-col rounded-xl transition-all ${
        isOver
          ? "bg-primary/5 ring-1 ring-primary/20"
          : "bg-secondary/30"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: stage.color || "#c4960a",
              boxShadow: `0 0 0 3px ${(stage.color || "#c4960a")}20`,
            }}
          />
          <span className="text-[13px] font-semibold tracking-tight">
            {stage.name}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/50 bg-background/80 min-w-[20px] text-center py-0.5 px-1.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {stage.sla_days && (
          <span className="text-[10px] text-muted-foreground/40 font-medium">
            {stage.sla_days}d
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[11px] text-muted-foreground/40">
              Drop leads here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
