"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signUp } from "@/app/(auth)/actions";

const signupSchema = z
  .object({
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>();

  async function onSubmit(data: SignupForm) {
    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signUp(data.email, data.password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsEmailVerification) {
      setVerificationSent(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (verificationSent) {
    return (
      <Card className="rounded-[4px] border-border/70 bg-white/85">
        <CardHeader className="space-y-3">
          <CardTitle className="font-serif text-4xl tracking-[-0.04em]">Check your email</CardTitle>
          <CardDescription className="text-sm leading-6">
            Your account is created. Confirm your email from the message we sent, then you’ll be brought back into the app automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[3px] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-foreground">
            After you click the verification link, the callback will sign you in and finish provisioning your workspace if needed.
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Already verified?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Go to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[4px] border-border/70 bg-white/85">
      <CardHeader className="space-y-3">
        <CardTitle className="font-serif text-4xl tracking-[-0.04em]">Create your account</CardTitle>
        <CardDescription className="text-sm leading-6">
          Start tracking leads in a calmer workspace built around reminder timing and readable momentum.
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
              {...register("email")}
            />
            {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="h-11 rounded-[3px]"
              {...register("password")}
            />
            {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Repeat your password"
              autoComplete="new-password"
              className="h-11 rounded-[3px]"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-[3px] border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full rounded-[3px]" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
