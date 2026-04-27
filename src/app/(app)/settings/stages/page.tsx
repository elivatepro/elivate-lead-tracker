"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStages } from "@/hooks/use-stages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Stage } from "@/lib/types";

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
  isDeleting,
}: {
  stage: Stage;
  onUpdate: (id: string, updates: Partial<Stage>) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="grid gap-3 rounded-[3px] border border-border/70 bg-white/75 px-4 py-4 md:grid-cols-[auto_1fr_110px_90px_auto]"
    >
      <button {...attributes} {...listeners} className="text-muted-foreground transition-colors hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </button>

      <Input
        defaultValue={stage.name}
        onBlur={(e) => {
          if (e.target.value !== stage.name) onUpdate(stage.id, { name: e.target.value });
        }}
        className="h-11 rounded-[3px]"
      />

      <Input
        type="number"
        defaultValue={stage.sla_days ?? ""}
        onBlur={(e) => {
          const value = e.target.value ? parseInt(e.target.value, 10) : null;
          if (value !== stage.sla_days) onUpdate(stage.id, { sla_days: value });
        }}
        className="h-11 rounded-[3px] text-center"
        placeholder="SLA"
      />

      <label className="flex items-center justify-center gap-2 rounded-[3px] border border-border/70 bg-secondary/35 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={stage.is_closed}
          onChange={(e) => onUpdate(stage.id, { is_closed: e.target.checked })}
          className="h-4 w-4 rounded accent-primary"
        />
        Closed
      </label>

      <Button
        variant="ghost"
        className="rounded-[3px] text-destructive hover:bg-destructive/5 hover:text-destructive"
        disabled={isDeleting}
        onClick={() => onDelete(stage.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function StagesSettingsPage() {
  const queryClient = useQueryClient();
  const { data: stages = [], isLoading } = useStages();
  const [newStageName, setNewStageName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const updateStage = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Stage> }) => {
      const res = await fetch(`/api/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stages"] }),
  });

  const createStage = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      setNewStageName("");
      toast.success("Stage added");
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete stage");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      setDeletingId(null);
      toast.success("Stage deleted");
    },
    onError: (err: Error) => {
      setDeletingId(null);
      toast.error(err.message);
    },
  });

  const reorderStages = useMutation({
    mutationFn: async (reordered: { id: string; position: number }[]) => {
      const res = await fetch("/api/stages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: reordered }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stages"] }),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !stages.length) return;

    const oldIndex = stages.findIndex((stage) => stage.id === active.id);
    const newIndex = stages.findIndex((stage) => stage.id === over.id);
    const reordered = arrayMove(stages, oldIndex, newIndex);

    reorderStages.mutate(reordered.map((stage, index) => ({ id: stage.id, position: index + 1 })));
  }

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading stages…</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[4px] border-border/70 bg-white/80">
        <CardHeader>
          <p className="eyebrow-label">Pipeline configuration</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Stages and SLAs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            Reorder stages to match the working flow. SLA values control reminder timing, and closed stages are automatically excluded from follow-up prompts.
          </p>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {stages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onUpdate={(id, updates) => updateStage.mutate({ id, updates })}
                    onDelete={(id) => {
                      if (confirm("Delete this stage? Leads in it must be moved first.")) {
                        setDeletingId(id);
                        deleteStage.mutate(id);
                      }
                    }}
                    isDeleting={deletingId === stage.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,241,231,0.94))]">
        <CardHeader>
          <p className="eyebrow-label">Add stage</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Extend the pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Discovery, Proposal, Negotiation…"
            className="h-11 rounded-[3px]"
          />
          <Button
            className="rounded-[3px]"
            disabled={!newStageName.trim() || createStage.isPending}
            onClick={() => createStage.mutate(newStageName.trim())}
          >
            <Plus className="h-4 w-4" />
            {createStage.isPending ? "Adding…" : "Add stage"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
