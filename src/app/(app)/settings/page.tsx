"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Workspace } from "@/lib/types";

const AVAILABLE_FIELDS = [
  { key: "name", label: "Name", locked: true },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
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
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  function toggleField(field: string) {
    const current = [...displayRequired];
    if (current.includes(field)) {
      setRequiredFields(current.filter((f) => f !== field));
    } else {
      setRequiredFields([...current, field]);
    }
  }

  function handleSave() {
    updateWorkspace.mutate({
      name: displayName,
      required_fields: displayRequired,
    });
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Loading...
      </p>
    );
  }

  const hasChanges =
    displayName !== workspace?.name ||
    JSON.stringify(displayRequired.sort()) !==
      JSON.stringify((workspace?.required_fields ?? ["name"]).sort());

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-serif text-lg">Workspace</h2>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={displayName}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg">Required fields</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Leads missing any of these fields will be marked as
              &ldquo;incomplete&rdquo; on your dashboard.
            </p>
          </div>
          <div className="space-y-2">
            {AVAILABLE_FIELDS.map((field) => (
              <label
                key={field.key}
                className="flex items-center gap-3 py-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={displayRequired.includes(field.key)}
                  disabled={field.locked}
                  onChange={() => toggleField(field.key)}
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                />
                <span className="text-sm">
                  {field.label}
                  {field.locked && (
                    <span className="text-muted-foreground ml-1">
                      (always required)
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateWorkspace.isPending}
        >
          {updateWorkspace.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
