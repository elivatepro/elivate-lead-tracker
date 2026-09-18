"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Suppression = {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "manual";
  created_at: string;
};

const REASON_LABEL: Record<Suppression["reason"], string> = {
  unsubscribe: "Unsubscribed",
  bounce: "Bounced",
  manual: "Added by you",
};

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

export function SuppressionList() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: items } = useQuery({
    queryKey: ["suppressions"],
    queryFn: async () => {
      const res = await fetch("/api/suppressions");
      if (!res.ok) throw new Error(await readError(res, "Couldn’t load the do-not-email list"));
      return ((await res.json()) as { suppressions: Suppression[] }).suppressions;
    },
  });

  const add = useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn’t add that address"));
    },
    onSuccess: () => {
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["suppressions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppressions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Couldn’t remove that address"));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["suppressions"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="rounded-[4px] border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="font-serif text-2xl tracking-[-0.03em]">
          Do-not-email list
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Addresses that unsubscribed, bounced, or that you added. They are never
          emailed, by bulk sends or automations.
        </p>
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email.trim()) add.mutate(email);
            }}
            type="email"
            placeholder="someone@example.com"
            className="h-10 rounded-[3px]"
          />
          <Button
            variant="outline"
            onClick={() => add.mutate(email)}
            disabled={add.isPending || !email.trim()}
            className="rounded-[3px]"
          >
            <Ban className="h-4 w-4" />
            Add
          </Button>
        </div>
        {items === undefined ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nobody is on the list.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-[3px] border border-border/70">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {REASON_LABEL[item.reason]} · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(item.id)}
                  aria-label={`Remove ${item.email}`}
                  title="Allow emailing this address again"
                  className="rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
