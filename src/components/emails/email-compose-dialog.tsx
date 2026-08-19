"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Sparkles, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { splitContactValues } from "@/lib/contacts";

export type ComposeTarget = {
  id: string;
  name: string;
  email: string | null;
};

export function EmailComposeDialog({
  open,
  onOpenChange,
  leads,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ComposeTarget[];
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const withEmail = leads.filter((lead) => splitContactValues(lead.email).length > 0);
  const skipped = leads.length - withEmail.length;
  const recipientLabel =
    withEmail.length === 1
      ? withEmail[0].name
      : `${withEmail.length} leads`;

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: withEmail.map((lead) => lead.id),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { queued?: number; skipped?: number; error?: string }
        | null;

      if (!res.ok) {
        toast.error(data?.error ?? "Couldn’t queue emails");
        return;
      }

      toast.success(
        `${data?.queued ?? 0} email${data?.queued === 1 ? "" : "s"} queued`
      );
      setSubject("");
      setBody("");
      onOpenChange(false);
    } catch {
      toast.error("Couldn’t queue emails");
    } finally {
      setSending(false);
    }
  }

  async function handleDraft() {
    if (!withEmail.length) return;
    setDrafting(true);
    setBody("");

    const names = withEmail.map((lead) => lead.name).join(", ");
    const prompt =
      `Draft a follow-up email to ${names}. Write the subject on the first line, ` +
      `then a blank line, then the message body. Keep it short and human. ` +
      `Do not add a signature.`;

    try {
      const response = await fetch("/api/nov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          leadRefs: withEmail.map((lead) => ({ id: lead.id, name: lead.name })),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          response.status === 429
            ? "Nov is busy. Try again in a moment."
            : text.includes("OPENAI_API_KEY")
              ? "Nov isn’t configured yet."
              : "Nov couldn’t draft this."
        );
      }

      if (!response.body) throw new Error("Nov stream unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6)) as {
            type: "delta" | "done" | "error";
            text?: string;
          };
          if (payload.type === "delta") {
            fullText += payload.text ?? "";
            setBody(fullText.replace(/^\s*Subject:\s*/i, ""));
          }
          if (payload.type === "error") {
            throw new Error(payload.text || "Nov hit an error while drafting.");
          }
        }
      }

      const cleaned = fullText.trim();
      const newlineIndex = cleaned.search(/\r?\n\r?\n|\n{2,}/);
      const firstLine = (newlineIndex === -1 ? cleaned : cleaned.slice(0, newlineIndex))
        .trim()
        .replace(/^Subject:\s*/i, "")
        .trim();

      if (firstLine) setSubject(firstLine);
      setBody(
        newlineIndex === -1 ? cleaned : cleaned.slice(newlineIndex).replace(/^\s*Subject:\s*/i, "").trim()
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t draft");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Compose email</DialogTitle>
        </DialogHeader>
        <div className="mt-1 flex items-center gap-2 rounded-[3px] border border-border/70 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <span>
            To {recipientLabel}
            {skipped > 0 ? ` · ${skipped} skipped (no email saved)` : ""}
          </span>
        </div>

        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="h-11 rounded-[3px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write a message…"
            className="rounded-[3px]"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            className="rounded-[3px]"
            disabled={drafting || withEmail.length === 0}
            onClick={handleDraft}
          >
            <Sparkles className="h-4 w-4" />
            {drafting ? "Drafting…" : "Draft with Nov"}
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-[3px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-[3px]"
              disabled={sending || !subject.trim() || !body.trim() || withEmail.length === 0}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : `Send to ${recipientLabel}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}