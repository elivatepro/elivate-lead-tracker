"use client";

import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { LeadCard, type LeadCardDensity } from "./lead-card";
import type { Stage } from "@/lib/types";
import type { LeadWithStage } from "@/hooks/use-leads";

function DraggableLeadCard({
  lead,
  density,
}: {
  lead: LeadWithStage;
  density: LeadCardDensity;
}) {
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
      <LeadCard lead={lead} density={density} />
    </div>
  );
}

export function StageColumn({
  stage,
  leads,
  density = "rich",
}: {
  stage: Stage;
  leads: LeadWithStage[];
  density?: LeadCardDensity;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const columnWidth =
    density === "compact" ? "w-[260px]" : density === "comfortable" ? "w-[280px]" : "w-[310px]";
  const gap = density === "compact" ? "space-y-1.5" : "space-y-2.5";

  return (
    <div
      ref={setNodeRef}
      className={`flex ${columnWidth} shrink-0 flex-col rounded-[3px] border p-2.5 transition-colors ${
        isOver
          ? "border-ember/40 bg-ember-tint/30"
          : "border-line bg-paper-2/40"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line/70 px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-[1px]"
            style={{ backgroundColor: stage.color || "#c4960a" }}
          />
          <span className="text-[13px] font-semibold tracking-tight text-ink">
            {stage.name}
          </span>
          <span className="numeric min-w-[20px] rounded-[2px] bg-paper-2 px-1.5 py-0.5 text-center text-[10px] font-medium text-ink-3">
            {leads.length}
          </span>
        </div>
        <span className="numeric text-[10.5px] text-ink-4">
          {stage.is_closed ? "Closed" : stage.sla_days ? `${stage.sla_days}d SLA` : "Open"}
        </span>
      </div>

      <div className={`mt-2.5 flex-1 ${gap} overflow-y-auto px-0.5 pb-1`}>
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} density={density} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-[3px] border border-dashed border-line/80 py-10 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-4/70">
              Drop leads here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
