"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type EmailSettings = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  has_password: boolean;
  email_from_name: string;
  email_signature: string;
  email_batch_size: number;
  email_batch_delay: number;
};

export default function EmailSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [signature, setSignature] = useState("");
  const [batchSize, setBatchSize] = useState("10");
  const [batchDelay, setBatchDelay] = useState("5");
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    fetch("/api/email-settings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: EmailSettings) => {
        setHost(data.smtp_host ?? "");
        setPort(String(data.smtp_port ?? 587));
        setUser(data.smtp_user ?? "");
        setFromName(data.email_from_name ?? "");
        setSignature(data.email_signature ?? "");
        setBatchSize(String(data.email_batch_size ?? 10));
        setBatchDelay(String(data.email_batch_delay ?? 5));
        setHasPassword(data.has_password);
      })
      .catch(() => toast.error("Couldn’t load email settings"));
  }, []);

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      smtp_host: host,
      smtp_port: Number(port),
      smtp_user: user,
      email_from_name: fromName,
      email_signature: signature,
      email_batch_size: Number(batchSize),
      email_batch_delay: Number(batchDelay),
    };
    if (password) payload.smtp_password = password;

    const res = await fetch("/api/email-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setPassword("");
      setHasPassword(Boolean(user) || Boolean(password));
      toast.success("Email settings saved");
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "Couldn’t save settings");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-[4px] border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="font-serif text-2xl tracking-[-0.03em]">
            SMTP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="h-11 rounded-[3px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                type="number"
                placeholder="587"
                className="h-11 rounded-[3px]"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="you@gmail.com"
                className="h-11 rounded-[3px]"
              />
            </div>
            <div className="space-y-2">
              <Label>App password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={hasPassword ? "Saved — leave blank to keep" : "App password"}
                className="h-11 rounded-[3px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>From name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your name"
              className="h-11 rounded-[3px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="font-serif text-2xl tracking-[-0.03em]">
            Bulk sending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Batch size</Label>
              <Input
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                type="number"
                min={1}
                max={100}
                className="h-11 rounded-[3px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Minutes between sends</Label>
              <Input
                value={batchDelay}
                onChange={(e) => setBatchDelay(e.target.value)}
                type="number"
                min={1}
                max={1440}
                className="h-11 rounded-[3px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="font-serif text-2xl tracking-[-0.03em]">
            Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={5}
            placeholder={"Jane Doe\nAcme Consulting\njane@acme.com"}
            className="rounded-[3px]"
          />
          <p className="text-xs text-muted-foreground">One line per row.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-[3px]">
          <Mail className="h-4 w-4" />
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}