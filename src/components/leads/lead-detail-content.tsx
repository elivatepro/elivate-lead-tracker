"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRightLeft,
  Bell,
  Building2,
  Clock3,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useStages } from "@/hooks/use-stages";
import { useDeleteLead, useUpdateLead, type LeadWithStage } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Activity } from "@/lib/types";
import {
  buildMailtoHref,
  buildTelHref,
  normalizeContactField,
  splitContactValues,
} from "@/lib/contacts";
import {
  daysSince,
  formatFullCurrency,
  getLeadInitials,
  getLeadSlaState,
} from "@/lib/lead-utils";

type LeadDetail = LeadWithStage & {
  activities: Activity[];
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActivityIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  switch (type) {
    case "created":
      return <Plus className={className} />;
    case "stage_changed":
      return <ArrowRightLeft className={className} />;
    case "field_edited":
      return <Pencil className={className} />;
    case "note_added":
      return <MessageSquare className={className} />;
    case "reminder_sent":
      return <Bell className={className} />;
    default:
      return <Clock3 className={className} />;
  }
}

function activityLabel(activity: Activity) {
  const payload = activity.payload as Record<string, unknown> | null;
  switch (activity.type) {
    case "created":
      return "Lead created";
    case "stage_changed":
      return `Moved from ${payload?.from ?? "?"} to ${payload?.to ?? "?"}`;
    case "field_edited":
      return `Updated ${(payload?.fields as string[])?.join(", ") ?? "lead details"}`;
    case "note_added":
      return "Note added";
    case "reminder_sent":
      return "Follow-up reminder sent";
    case "snoozed":
      return "Reminders snoozed";
    case "closed":
      return "Lead closed";
    default:
      return activity.type;
  }
}

function getActivityNote(activity: Activity) {
  const payload = activity.payload as Record<string, unknown> | null;
  return typeof payload?.note === "string" ? payload.note : null;
}

export type LeadDetailMode = "peek" | "full";

export function LeadDetailContent({
  leadId,
  mode,
  onAfterDelete,
}: {
  leadId: string;
  mode: LeadDetailMode;
  onAfterDelete?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: stages = [] } = useStages();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [note, setNote] = useState("");
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      return res.json();
    },
  });

  async function handleAddNote() {
    if (!note.trim()) return;
    setIsSendingNote(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });

      if (!res.ok) {
        const error = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(error?.error || "Failed to add note");
      }

      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
    } finally {
      setIsSendingNote(false);
    }
  }

  async function handleFieldBlur(field: string, value: string) {
    if (!lead) return;
    const currentValue = lead[field as keyof LeadDetail];

    if (field === "email" || field === "phone") {
      if (
        normalizeContactField(value) ===
        normalizeContactField(typeof currentValue === "string" ? currentValue : null)
      ) {
        return;
      }
    } else if (value === (currentValue ?? "")) {
      return;
    }

    await updateLead.mutateAsync({
      id: leadId,
      [field]: value || null,
    });

    queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading lead…</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Lead not found.</p>
      </div>
    );
  }

  const noteActivities = lead.activities.filter(
    (activity) => activity.type === "note_added" && getActivityNote(activity)
  );
  const emailContacts = splitContactValues(lead.email);
  const emailHref = buildMailtoHref(lead.email);
  const phoneHref = lead.phone ? buildTelHref(lead.phone) : null;
  const state = getLeadSlaState(lead, currentTime);
  const isPeek = mode === "peek";
  const wrapperPadding = isPeek ? "px-5 py-5" : "px-4 py-6 sm:px-6 lg:px-8";
  const profileGrid = isPeek
    ? "space-y-6"
    : "grid gap-6 xl:grid-cols-[1.1fr_0.9fr]";
  const statGrid = isPeek
    ? "grid gap-3 grid-cols-2"
    : "grid gap-4 lg:grid-cols-4";

  return (
    <div className={`space-y-6 ${wrapperPadding}`}>
      {isPeek ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Lead detail
          </p>
          <h2 className="font-serif text-3xl tracking-[-0.04em] text-ink">{lead.name}</h2>
          {lead.company && (
            <p className="text-sm text-muted-foreground">{lead.company}</p>
          )}
        </div>
      ) : null}

      <div className={statGrid}>
        {[
          { label: "Stage", value: lead.stages.name },
          { label: "Reminder state", value: state.label },
          { label: "Last touch", value: daysSince(lead.last_activity_at) },
          { label: "Deal value", value: formatFullCurrency(lead.value) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[3px] border border-border/70 bg-white/80 px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 font-serif text-2xl tracking-[-0.03em]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className={profileGrid}>
        <div className="space-y-6">
          <Card className="rounded-[4px] border-border/70 bg-white/80">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[3px] bg-primary/10 text-sm font-bold text-primary">
                  {getLeadInitials(lead.name)}
                </div>
                <div className="space-y-2">
                  <p className="eyebrow-label">Record</p>
                  <CardTitle className="font-serif text-3xl tracking-[-0.04em]">
                    Lead profile
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{state.detail}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className={
                isPeek
                  ? "grid gap-4"
                  : "grid gap-4 md:grid-cols-2"
              }
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  defaultValue={lead.name}
                  onBlur={(e) => handleFieldBlur("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  defaultValue={lead.company ?? ""}
                  onBlur={(e) => handleFieldBlur("company", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Emails</Label>
                <Input
                  defaultValue={lead.email ?? ""}
                  onBlur={(e) => handleFieldBlur("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phones</Label>
                <Input
                  defaultValue={lead.phone ?? ""}
                  onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input
                  defaultValue={lead.source ?? ""}
                  onBlur={(e) => handleFieldBlur("source", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  defaultValue={lead.value ?? ""}
                  onBlur={(e) => handleFieldBlur("value", e.target.value)}
                />
              </div>
              <div className={`space-y-2 ${isPeek ? "" : "md:col-span-2"}`}>
                <Label>Stage</Label>
                <select
                  className="h-11 w-full rounded-[3px] border border-input bg-white px-4 text-sm"
                  value={lead.stage_id}
                  onChange={(e) =>
                    updateLead.mutate({ id: leadId, stage_id: e.target.value })
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`space-y-2 ${isPeek ? "" : "md:col-span-2"}`}>
                <Label>Notes</Label>
                <Textarea
                  defaultValue={lead.notes ?? ""}
                  rows={4}
                  onBlur={(e) => handleFieldBlur("notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,241,231,0.94))]">
            <CardHeader>
              <p className="eyebrow-label">Timeline</p>
              <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
                Activity history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity has been recorded yet.
                </p>
              ) : (
                lead.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-[3px] bg-secondary/60 p-2 text-primary">
                        <ActivityIcon type={activity.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{activityLabel(activity)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                        {getActivityNote(activity) ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {getActivityNote(activity)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[4px] border-border/70 bg-white/80">
            <CardHeader>
              <p className="eyebrow-label">Contact actions</p>
              <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
                Reach out fast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[3px] border border-border/70 bg-secondary/35 px-4 py-3">
                <p
                  className={`font-medium ${
                    state.stale ? "text-stale" : "text-foreground"
                  }`}
                >
                  {state.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{state.detail}</p>
              </div>
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="justify-start rounded-[3px]"
                  disabled={!emailHref}
                  onClick={() => {
                    if (emailHref) window.location.href = emailHref;
                  }}
                >
                  <Mail className="h-4 w-4" />
                  Email{" "}
                  {emailContacts.length
                    ? `${emailContacts.length} contact${
                        emailContacts.length > 1 ? "s" : ""
                      }`
                    : "contact"}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start rounded-[3px]"
                  disabled={!phoneHref}
                  onClick={() => {
                    if (phoneHref) window.location.href = phoneHref;
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call or text
                </Button>
              </div>
              <div className={isPeek ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
                <div className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    Company
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lead.company || "Independent lead"}
                  </p>
                </div>
                <div className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Source
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {lead.source || "Not set"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,241,231,0.94))]">
            <CardHeader>
              <p className="eyebrow-label">Notes</p>
              <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
                Working log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Add a follow-up note, call summary, or next action…"
              />
              <Button
                className="rounded-[3px]"
                disabled={isSendingNote || !note.trim()}
                onClick={handleAddNote}
              >
                <Send className="h-4 w-4" />
                {isSendingNote ? "Saving note…" : "Add note"}
              </Button>
              <div className="space-y-3">
                {noteActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Notes you add here will appear in the working log.
                  </p>
                ) : (
                  noteActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-[3px] border border-border/70 bg-white/75 px-4 py-3"
                    >
                      <p className="text-sm leading-6 text-foreground">
                        {getActivityNote(activity)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {isPeek ? (
            <div className="flex items-center justify-between rounded-[3px] border border-border/70 bg-white/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Danger zone
              </div>
              <Button
                variant="destructive"
                className="rounded-[3px]"
                onClick={() => {
                  if (confirm(`Delete "${lead.name}"?`)) {
                    deleteLead.mutate(leadId, {
                      onSuccess: () => {
                        if (onAfterDelete) {
                          onAfterDelete();
                        } else {
                          router.push("/leads");
                        }
                      },
                    });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {!isPeek ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-[3px]"
            render={<Link href="/leads" />}
          >
            Back to pipeline
          </Button>
          <Button
            variant="destructive"
            className="rounded-[3px]"
            onClick={() => {
              if (confirm(`Delete "${lead.name}"?`)) {
                deleteLead.mutate(leadId, {
                  onSuccess: () => {
                    if (onAfterDelete) {
                      onAfterDelete();
                    } else {
                      router.push("/leads");
                    }
                  },
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}
