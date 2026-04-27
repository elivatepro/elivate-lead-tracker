"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/types";

type NovTone = "warm" | "direct" | "casual";

const TONES: { value: NovTone; label: string; description: string }[] = [
  { value: "warm", label: "Warm", description: "Friendly, thoughtful, and human." },
  { value: "direct", label: "Direct", description: "Clear, efficient, and straight to the point." },
  { value: "casual", label: "Casual", description: "Relaxed, conversational, and low-pressure." },
];

export default function NovSettingsPage() {
  const queryClient = useQueryClient();
  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace"],
    queryFn: async () => {
      const res = await fetch("/api/workspace");
      if (!res.ok) throw new Error("Failed to fetch workspace");
      return res.json();
    },
  });

  const [form, setForm] = useState<Partial<Workspace>>({});

  const updateWorkspace = useMutation({
    mutationFn: async (updates: Partial<Workspace>) => {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setForm({});
      toast.success("Nov settings saved");
    },
    onError: () => {
      toast.error("Failed to save Nov settings");
    },
  });

  if (isLoading || !workspace) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading Nov settings…</p>;
  }

  const current = {
    nov_company_summary: form.nov_company_summary ?? workspace.nov_company_summary ?? "",
    nov_offer_summary: form.nov_offer_summary ?? workspace.nov_offer_summary ?? "",
    nov_target_customer: form.nov_target_customer ?? workspace.nov_target_customer ?? "",
    nov_default_cta: form.nov_default_cta ?? workspace.nov_default_cta ?? "",
    nov_email_signoff: form.nov_email_signoff ?? workspace.nov_email_signoff ?? "",
    nov_preferred_tone: form.nov_preferred_tone ?? workspace.nov_preferred_tone,
    nov_be_concise: form.nov_be_concise ?? workspace.nov_be_concise,
    nov_avoid_pushy_language:
      form.nov_avoid_pushy_language ?? workspace.nov_avoid_pushy_language,
    nov_include_booking_prompt:
      form.nov_include_booking_prompt ?? workspace.nov_include_booking_prompt,
  };

  const hasChanges =
    current.nov_company_summary !== (workspace.nov_company_summary ?? "") ||
    current.nov_offer_summary !== (workspace.nov_offer_summary ?? "") ||
    current.nov_target_customer !== (workspace.nov_target_customer ?? "") ||
    current.nov_default_cta !== (workspace.nov_default_cta ?? "") ||
    current.nov_email_signoff !== (workspace.nov_email_signoff ?? "") ||
    current.nov_preferred_tone !== workspace.nov_preferred_tone ||
    current.nov_be_concise !== workspace.nov_be_concise ||
    current.nov_avoid_pushy_language !== workspace.nov_avoid_pushy_language ||
    current.nov_include_booking_prompt !== workspace.nov_include_booking_prompt;

  function updateField<K extends keyof typeof current>(key: K, value: (typeof current)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[4px] border-border/70 bg-white/80">
        <CardHeader>
          <p className="eyebrow-label">Nov</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Message context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="nov-company-summary">What do you do?</Label>
            <Input
              id="nov-company-summary"
              value={current.nov_company_summary}
              onChange={(e) => updateField("nov_company_summary", e.target.value)}
              placeholder="We help consultants turn warm leads into booked calls."
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nov-offer-summary">What do you sell?</Label>
            <Input
              id="nov-offer-summary"
              value={current.nov_offer_summary}
              onChange={(e) => updateField("nov_offer_summary", e.target.value)}
              placeholder="Lead gen systems, CRM cleanup, and follow-up automation."
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nov-target-customer">Who do you help?</Label>
            <Input
              id="nov-target-customer"
              value={current.nov_target_customer}
              onChange={(e) => updateField("nov_target_customer", e.target.value)}
              placeholder="Freelancers, agencies, and service founders."
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nov-default-cta">What should Nov usually ask leads to do next?</Label>
            <Input
              id="nov-default-cta"
              value={current.nov_default_cta}
              onChange={(e) => updateField("nov_default_cta", e.target.value)}
              placeholder="Reply with a good time for a quick call next week."
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nov-email-signoff">How should messages sign off?</Label>
            <Input
              id="nov-email-signoff"
              value={current.nov_email_signoff}
              onChange={(e) => updateField("nov_email_signoff", e.target.value)}
              placeholder="Best, Boko"
              className="h-11 rounded-[3px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,241,231,0.94))]">
        <CardHeader>
          <p className="eyebrow-label">Style</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            How Nov should sound
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {TONES.map((tone) => (
              <button
                key={tone.value}
                type="button"
                onClick={() => updateField("nov_preferred_tone", tone.value)}
                className={`rounded-[3px] border px-4 py-3 text-left transition-colors ${
                  current.nov_preferred_tone === tone.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 bg-white/75 text-foreground hover:border-foreground/40"
                }`}
              >
                <p className="font-medium">{tone.label}</p>
                <p
                  className={`mt-1 text-sm ${
                    current.nov_preferred_tone === tone.value
                      ? "text-background/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {tone.description}
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <ToggleRow
              label="Keep messages concise"
              description="Favor short, usable drafts over long explanations."
              checked={current.nov_be_concise}
              onChange={(checked) => updateField("nov_be_concise", checked)}
            />
            <ToggleRow
              label="Avoid pushy language"
              description="Keep follow-ups helpful and low-pressure."
              checked={current.nov_avoid_pushy_language}
              onChange={(checked) => updateField("nov_avoid_pushy_language", checked)}
            />
            <ToggleRow
              label="Include a booking invite"
              description="When useful, suggest a call or meeting in the draft."
              checked={current.nov_include_booking_prompt}
              onChange={(checked) => updateField("nov_include_booking_prompt", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="rounded-[3px]"
          disabled={!hasChanges || updateWorkspace.isPending}
          onClick={() => updateWorkspace.mutate(current)}
        >
          {updateWorkspace.isPending ? "Saving…" : "Save Nov settings"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[3px] border border-border/70 bg-white/75 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded accent-primary"
      />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
