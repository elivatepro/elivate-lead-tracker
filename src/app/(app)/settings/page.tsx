"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/types";

const AVAILABLE_FIELDS = [
  { key: "name", label: "Name", locked: true },
  { key: "email", label: "Emails" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phones" },
  { key: "source", label: "Source" },
  { key: "value", label: "Deal value" },
];

export default function GeneralSettingsPage() {
  const queryClient = useQueryClient();
  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ["workspace"],
    queryFn: async () => {
      const res = await fetch("/api/workspace");
      if (!res.ok) throw new Error("Failed to fetch workspace");
      return res.json();
    },
  });

  const [name, setName] = useState<string | null>(null);
  const [requiredFields, setRequiredFields] = useState<string[] | null>(null);

  const displayName = name ?? workspace?.name ?? "";
  const displayRequired = requiredFields ?? workspace?.required_fields ?? ["name"];

  const updateWorkspace = useMutation({
    mutationFn: async (updates: {
      name?: string;
      required_fields?: string[];
    }) => {
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
      toast.success("Workspace settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  function toggleField(field: string) {
    const current = [...displayRequired];
    if (current.includes(field)) {
      setRequiredFields(current.filter((item) => item !== field));
    } else {
      setRequiredFields([...current, field]);
    }
  }

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading settings…</p>;
  }

  const hasChanges =
    displayName !== workspace?.name ||
    JSON.stringify([...displayRequired].sort()) !==
      JSON.stringify([...(workspace?.required_fields ?? ["name"])].sort());

  return (
    <div className="space-y-6">
      <Card className="rounded-[4px] border-border/70 bg-white/80">
        <CardHeader>
          <p className="eyebrow-label">Workspace</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            General settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={displayName}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="rounded-[3px] border border-border/70 bg-secondary/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
            This name appears in the editorial sidebar and helps anchor the workspace across all lead views.
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,241,231,0.94))]">
        <CardHeader>
          <p className="eyebrow-label">Quality rules</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Required lead fields
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Leads missing any checked field will count as incomplete on the dashboard and help you catch records that still need cleanup.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {AVAILABLE_FIELDS.map((field) => (
              <label
                key={field.key}
                className="flex items-center gap-3 rounded-[3px] border border-border/70 bg-white/75 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={displayRequired.includes(field.key)}
                  disabled={field.locked}
                  onChange={() => toggleField(field.key)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="font-medium">{field.label}</p>
                  {field.locked ? (
                    <p className="text-sm text-muted-foreground">Always required</p>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="rounded-[3px]"
          disabled={!hasChanges || updateWorkspace.isPending}
          onClick={() =>
            updateWorkspace.mutate({
              name: displayName,
              required_fields: displayRequired,
            })
          }
        >
          {updateWorkspace.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
