"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <Card className="rounded-[4px] border-border/70 bg-white/85">
      <CardHeader className="space-y-3">
        <CardTitle className="font-serif text-4xl tracking-[-0.04em]">Reset your password</CardTitle>
        <CardDescription className="text-sm leading-6">
          Enter your email and we’ll send you a secure link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-[3px] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-foreground">
              Check your inbox for a password reset link. It will bring you back here to set a new password.
            </div>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-[3px]"
                required
              />
            </div>

            {error ? (
              <div className="rounded-[3px] border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="w-full rounded-[3px]" disabled={loading || !email.trim()}>
              {loading ? "Sending reset link…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
