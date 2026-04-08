"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStages } from "@/hooks/use-stages";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GripVertical, Trash2, Plus } from "lucide-react";
import type { Stage } from "@/lib/types";

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
  isDeleting: isDeletingProp,
}: {
  stage: Stage;
  onUpdate: (id: string, updates: Partial<Stage>) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-3 px-2 border-b border-border last:border-b-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Input
        defaultValue={stage.name}
        onBlur={(e) => {
          if (e.target.value !== stage.name) {
            onUpdate(stage.id, { name: e.target.value });
          }
        }}
        className="flex-1"
        placeholder="Stage name"
      />

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          defaultValue={stage.sla_days ?? ""}
          onBlur={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : null;
            if (val !== stage.sla_days) {
              onUpdate(stage.id, { sla_days: val });
            }
          }}
          className="w-20 text-center"
          placeholder="SLA"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          days
        </span>
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
        <input
          type="checkbox"
          checked={stage.is_closed}
          onChange={(e) => onUpdate(stage.id, { is_closed: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-muted-foreground">Closed</span>
      </label>

      <button
        onClick={() => onDelete(stage.id)}
        disabled={isDeletingProp}
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function StagesSettingsPage() {
  const queryClient = useQueryClient();
  const { data: stages, isLoading } = useStages();
  const [newStageName, setNewStageName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const updateStage = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Stage>;
    }) => {
      const res = await fetch(`/api/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !stages) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(stages, oldIndex, newIndex);

    reorderStages.mutate(
      reordered.map((s, i) => ({ id: s.id, position: i + 1 }))
    );
  }

  function handleUpdate(id: string, updates: Partial<Stage>) {
    updateStage.mutate({ id, updates });
  }

  function handleDelete(id: string) {
    if (confirm("Delete this stage? Leads in it must be moved first.")) {
      setDeletingId(id);
      deleteStage.mutate(id);
    }
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;
    createStage.mutate(newStageName.trim());
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Loading...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Pipeline stages</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drag to reorder. Set an SLA (in days) to trigger follow-up
              reminders. Mark a stage as &ldquo;Closed&rdquo; to exclude it from
              reminders.
            </p>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-2 pb-2 text-xs text-muted-foreground font-medium">
            <div className="w-4" />
            <div className="flex-1">Name</div>
            <div className="w-20 text-center">SLA</div>
            <div className="w-4" />
            <div className="w-16" />
            <div className="w-4" />
          </div>

          {stages && stages.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {stages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    isDeleting={deletingId === stage.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No stages yet. Add one below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add new stage */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-sm font-medium mb-3">Add a stage</h3>
          <div className="flex gap-2">
            <Input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Stage name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddStage();
              }}
            />
            <Button
              onClick={handleAddStage}
              disabled={!newStageName.trim() || createStage.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
