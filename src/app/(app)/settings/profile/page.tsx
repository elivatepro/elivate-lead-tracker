"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ProfileSettingsPage() {
  const { data: profile } = useQuery<{ email: string }>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleChangePassword() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setIsSaving(false);

    if (!res.ok) {
      toast.error("Failed to update password");
      return;
    }

    toast.success("Password updated");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[4px] border-border/70 bg-white/80">
        <CardHeader>
          <p className="eyebrow-label">Profile</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Account details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled className="h-11 rounded-[3px]" />
            <p className="text-sm text-muted-foreground">
              Your account email is managed through authentication and can’t be edited from this screen.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,241,231,0.94))]">
        <CardHeader>
          <p className="eyebrow-label">Security</p>
          <CardTitle className="mt-2 font-serif text-3xl tracking-[-0.04em]">
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="h-11 rounded-[3px]"
            />
          </div>
          <div className="flex justify-end">
            <Button
              className="rounded-[3px]"
              onClick={handleChangePassword}
              disabled={!password || !confirmPassword || isSaving}
            >
              {isSaving ? "Updating…" : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
