"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateLead } from "@/hooks/use-leads";
import { useStages } from "@/hooks/use-stages";
import { Plus } from "lucide-react";

type NewLeadForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  value: string;
  notes: string;
  stage_id: string;
};

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const { data: stages } = useStages();
  const createLead = useCreateLead();

  const { register, handleSubmit, reset, setValue } = useForm<NewLeadForm>({
    defaultValues: {
      stage_id: "",
    },
  });

  // Listen for keyboard shortcut event
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("open-new-lead-dialog", handleOpen);
    return () => window.removeEventListener("open-new-lead-dialog", handleOpen);
  }, []);

  async function onSubmit(data: NewLeadForm) {
    const stageId = data.stage_id || stages?.find((s) => !s.is_closed)?.id;
    if (!stageId) return;

    await createLead.mutateAsync({
      name: data.name,
      stage_id: stageId,
      company: data.company || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      source: data.source || undefined,
      value: data.value ? parseFloat(data.value) : undefined,
      notes: data.notes || undefined,
    });

    reset();
    setOpen(false);
  }

  // Set default stage when stages load
  const defaultStage = stages?.find((s) => !s.is_closed);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md h-9 gap-1.5 px-2.5 sm:px-4 text-[13px] font-medium transition-all">
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New lead</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add a new lead
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
                {...register("name", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Acme Inc."
                {...register("company")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Emails</Label>
              <Input
                id="email"
                type="text"
                placeholder="john@acme.com, sales@acme.com"
                {...register("email")}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phones</Label>
              <Input
                id="phone"
                placeholder="+1 555 0123, +1 555 0456"
                {...register("phone")}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple phone numbers with commas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="LinkedIn, Referral..."
                {...register("source")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Deal value ($)</Label>
              <Input
                id="value"
                type="number"
                placeholder="5000"
                {...register("value")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <select
              id="stage"
              className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
              defaultValue={defaultStage?.id}
              {...register("stage_id")}
              onChange={(e) => setValue("stage_id", e.target.value)}
            >
              {stages
                ?.filter((s) => !s.is_closed)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any initial notes about this lead..."
              rows={3}
              {...register("notes")}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? "Adding..." : "Add lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
