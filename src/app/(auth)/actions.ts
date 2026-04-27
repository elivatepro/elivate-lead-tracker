"use server";

import { createClient } from "@/lib/supabase/server";
import { provisionWorkspaceForUser } from "@/lib/auth/provision-workspace";

export async function signUp(email: string, password: string) {
  const supabase = await createClient();

  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (authError) {
    return { error: authError.message, needsEmailVerification: false };
  }

  if (!data.user) {
    return {
      error: "Failed to create account. Please try again.",
      needsEmailVerification: false,
    };
  }

  const needsEmailVerification = !data.session;
  const provisioned = await provisionWorkspaceForUser(data.user.id);

  if (provisioned.error) {
    return {
      error: `Account created but workspace setup failed: ${provisioned.error}`,
      needsEmailVerification,
    };
  }

  return {
    error: null,
    needsEmailVerification,
  };
}
