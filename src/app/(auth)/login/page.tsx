"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { register, handleSubmit } = useForm<LoginFormValues>();

  const authError =
    searchParams.get("error") === "auth"
      ? "That sign-in link is invalid or expired. Please try again."
      : null;

  async function onSubmit(data: LoginFormValues) {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (magicLinkMode) {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }

      setMagicLinkSent(true);
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (magicLinkSent) {
    return (
      <Card className="rounded-[4px] border-border/70 bg-white/85">
        <CardContent className="space-y-5 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[3px] bg-primary/10 text-primary">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="font-serif text-3xl tracking-[-0.04em]">Check your email</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              A magic link is on the way. Open it to continue into your workspace.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-[3px]"
            onClick={() => {
              setMagicLinkSent(false);
              setMagicLinkMode(false);
            }}
          >
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[4px] border-border/70 bg-white/85">
      <CardHeader className="space-y-3">
        <CardTitle className="font-serif text-4xl tracking-[-0.04em]">Welcome back</CardTitle>
        <CardDescription className="text-sm leading-6">
          {magicLinkMode
            ? "Enter your email to receive a magic link."
            : "Sign in with your email and password to return to the dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="h-11 rounded-[3px]"
              {...register("email", { required: true })}
            />
          </div>

          {!magicLinkMode ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="Your password"
                autoComplete="current-password"
                className="h-11 rounded-[3px]"
                {...register("password")}
              />
            </div>
          ) : null}

          {error || authError ? (
            <div className="rounded-[3px] border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {error || authError}
            </div>
          ) : null}

          <Button type="submit" className="w-full rounded-[3px]" disabled={loading}>
            {loading ? "Signing in…" : magicLinkMode ? "Send magic link" : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-[3px]"
          onClick={() => {
            setMagicLinkMode(!magicLinkMode);
            setError(null);
          }}
        >
          {magicLinkMode ? "Sign in with password instead" : "Sign in with magic link"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
