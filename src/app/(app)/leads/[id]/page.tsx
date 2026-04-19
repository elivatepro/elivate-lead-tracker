"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { useStages } from "@/hooks/use-stages";
import {
  useUpdateLead,
  useDeleteLead,
  type LeadWithStage,
} from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Trash2,
  Send,
  ArrowRightLeft,
  Pencil,
  Bell,
  Clock,
  MessageSquare,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Activity } from "@/lib/types";
import {
  buildMailtoHref,
  buildTelHref,
  normalizeContactField,
  splitContactValues,
} from "@/lib/contacts";

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
  switch (type) {
    case "created":
      return <Plus className="h-3.5 w-3.5" />;
    case "stage_changed":
      return <ArrowRightLeft className="h-3.5 w-3.5" />;
    case "field_edited":
      return <Pencil className="h-3.5 w-3.5" />;
    case "note_added":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "reminder_sent":
      return <Bell className="h-3.5 w-3.5" />;
    case "snoozed":
      return <Clock className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
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
      return `Updated ${(payload?.fields as string[])?.join(", ") ?? "fields"}`;
    case "note_added":
      return (payload?.note as string) ?? "Note added";
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

function ReminderInfo({ lead, now }: { lead: LeadDetail; now: number }) {
  const stage = lead.stages;

  if (stage.is_closed) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60 bg-secondary/50 rounded-lg px-3 py-2">
        <Clock className="h-3.5 w-3.5" />
        Closed stage — no reminders
      </div>
    );
  }

  if (!stage.sla_days) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60 bg-secondary/50 rounded-lg px-3 py-2">
        <Clock className="h-3.5 w-3.5" />
        No SLA set for this stage
      </div>
    );
  }

  if (
    lead.snoozed_until &&
    new Date(lead.snoozed_until).getTime() > now
  ) {
    const snoozedUntil = new Date(lead.snoozed_until);
    const daysLeft = Math.ceil((snoozedUntil.getTime() - now) / 86400000);
    return (
      <div className="flex items-center gap-2 text-[12px] text-gold bg-gold/8 rounded-lg px-3 py-2">
        <Clock className="h-3.5 w-3.5" />
        Snoozed — reminders resume in {daysLeft}d
      </div>
    );
  }

  const dueAt =
    new Date(lead.last_activity_at).getTime() + stage.sla_days * 86400000;
  const isStale = now >= dueAt;

  if (isStale) {
    const overBy = Math.floor((now - dueAt) / 3600000);
    const overText =
      overBy < 24
        ? `${overBy}h`
        : `${Math.floor(overBy / 24)}d`;
    return (
      <div className="flex items-center gap-2 text-[12px] text-stale bg-stale/8 rounded-lg px-3 py-2">
        <AlertCircle className="h-3.5 w-3.5" />
        Stale by {overText} — follow up now
      </div>
    );
  }

  const msLeft = dueAt - now;
  const hoursLeft = Math.floor(msLeft / 3600000);
  const dueText =
    hoursLeft < 24
      ? `${hoursLeft}h`
      : `${Math.floor(hoursLeft / 24)}d`;

  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
      <Bell className="h-3.5 w-3.5" />
      Next reminder due in {dueText}
    </div>
  );
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: stages } = useStages();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [note, setNote] = useState("");
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date().getTime());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      return res.json();
    },
  });

  async function handleAddNote() {
    if (!note.trim()) return;
    setIsSendingNote(true);

    try {
      const res = await fetch(`/api/leads/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });

      if (!res.ok) {
        const error = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(error?.error || "Failed to add note");
      }

      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead", id] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add note"
      );
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
        normalizeContactField(
          typeof currentValue === "string" ? currentValue : null
        )
      ) {
        return;
      }
    } else if (value === (currentValue ?? "")) {
      return;
    }

    await updateLead.mutateAsync({
      id,
      [field]: value || null,
    });
    queryClient.invalidateQueries({ queryKey: ["lead", id] });
  }

  if (isLoading) {
    return (
      <>
        <Header title="Lead" />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Header title="Lead" />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground text-sm">Lead not found</p>
        </div>
      </>
    );
  }

  const noteActivities = lead.activities.filter(
    (activity) => activity.type === "note_added" && getActivityNote(activity)
  );
  const emailContacts = splitContactValues(lead.email);
  const phoneContacts = splitContactValues(lead.phone);

  return (
    <>
      <Header title={lead.name} />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Delete "${lead.name}"?`)) {
                deleteLead.mutate(id, {
                  onSuccess: () => router.push("/leads"),
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Lead fields */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      onBlur={(e) =>
                        handleFieldBlur("company", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label>Emails</Label>
                      <p className="text-xs text-muted-foreground">
                        Separate multiple emails with commas.
                      </p>
                    </div>
                    <Input
                      type="text"
                      defaultValue={lead.email ?? ""}
                      onBlur={(e) => handleFieldBlur("email", e.target.value)}
                      placeholder="contact@company.com, sales@company.com"
                    />
                    {emailContacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {emailContacts.map((email) => {
                          const href = buildMailtoHref(email);

                          return (
                            <a
                              key={email}
                              href={href ?? undefined}
                              className="rounded-md border border-border/70 bg-secondary/35 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/60"
                            >
                              {email}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label>Phones</Label>
                      <p className="text-xs text-muted-foreground">
                        Separate multiple phone numbers with commas.
                      </p>
                    </div>
                    <Input
                      defaultValue={lead.phone ?? ""}
                      onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                      placeholder="+1 555 0123, +1 555 0456"
                    />
                    {phoneContacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {phoneContacts.map((phone) => {
                          const href = buildTelHref(phone);

                          return href ? (
                            <a
                              key={phone}
                              href={href}
                              className="rounded-md border border-border/70 bg-secondary/35 px-2 py-1 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-secondary/60"
                            >
                              {phone}
                            </a>
                          ) : (
                            <span
                              key={phone}
                              className="rounded-md border border-border/70 bg-secondary/35 px-2 py-1 text-xs text-foreground"
                            >
                              {phone}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Input
                      defaultValue={lead.source ?? ""}
                      onBlur={(e) => handleFieldBlur("source", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deal value ($)</Label>
                    <Input
                      type="number"
                      defaultValue={lead.value ?? ""}
                      onBlur={(e) => handleFieldBlur("value", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Stage</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
                    value={lead.stage_id}
                    onChange={(e) => {
                      updateLead.mutate(
                        { id, stage_id: e.target.value },
                        {
                          onSuccess: () =>
                            queryClient.invalidateQueries({
                              queryKey: ["lead", id],
                            }),
                        }
                      );
                    }}
                  >
                    {stages?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.is_closed ? " (closed)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reminder status */}
                <ReminderInfo lead={lead} now={currentTime} />

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label>Lead summary</Label>
                    <p className="text-xs text-muted-foreground">
                      Persistent context for this lead.
                    </p>
                  </div>
                  <Textarea
                    defaultValue={lead.notes ?? ""}
                    rows={4}
                    onBlur={(e) => handleFieldBlur("notes", e.target.value)}
                    placeholder="Keep a concise summary of the lead here..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <p className="text-xs text-muted-foreground">
                      Quick updates you add from the note box appear here.
                    </p>
                  </div>

                  {noteActivities.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
                      No notes added yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {noteActivities.map((activity) => {
                        const noteText = getActivityNote(activity);
                        if (!noteText) return null;

                        return (
                          <div
                            key={activity.id}
                            className="rounded-lg border border-border/70 bg-background px-3 py-3"
                          >
                            <p className="text-sm leading-relaxed">{noteText}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatDate(activity.created_at)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Activity timeline */}
          <div className="space-y-4">
            {/* Add note */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Add a note</h3>
                  <p className="text-xs text-muted-foreground">
                    This will show under Notes and in the activity timeline.
                  </p>
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Type a quick update..."
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!note.trim() || isSendingNote}
                  className="w-full"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {isSendingNote ? "Saving..." : "Add note"}
                </Button>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-medium mb-4">Activity</h3>
                {lead.activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No activity yet
                  </p>
                ) : (
                  <div className="space-y-0">
                    {lead.activities.map((activity, i) => (
                      <div key={activity.id}>
                        <div className="flex gap-3 py-2.5">
                          <div className="mt-0.5 h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <ActivityIcon type={activity.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">
                              {activityLabel(activity)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(activity.created_at)}
                            </p>
                          </div>
                        </div>
                        {i < lead.activities.length - 1 && (
                          <Separator className="ml-3" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
