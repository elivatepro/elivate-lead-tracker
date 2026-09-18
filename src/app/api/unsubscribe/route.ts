import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

// RFC 8058 one-click unsubscribe: mail clients POST
// "List-Unsubscribe=One-Click" to the URL from the List-Unsubscribe header.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const body = await req.text().catch(() => "");

  if (!/(^|&)List-Unsubscribe=One-Click(&|$)/.test(body)) {
    return new Response("Bad request", { status: 400 });
  }

  let verified;
  try {
    verified = verifyUnsubscribeToken(token);
  } catch {
    return new Response("Server misconfigured", { status: 500 });
  }
  if (!verified) return new Response("Invalid token", { status: 400 });

  const { error } = await createServiceClient().rpc("suppress_email", {
    p_workspace_id: verified.workspaceId,
    p_email: verified.email,
    p_reason: "unsubscribe",
  });
  if (error) return new Response("Failed", { status: 500 });

  return new Response("Unsubscribed", { status: 200 });
}

// A plain GET (a person following the header link, or a scanner) only shows
// the confirmation page; it never changes anything.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL || req.url;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, base), 302);
}
