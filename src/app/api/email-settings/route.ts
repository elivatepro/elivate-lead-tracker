import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { encryptSecret } from "@/lib/email/encrypt";

// GET /api/email-settings — current SMTP configuration (password never returned)
export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await ctx.supabase
    .from("workspaces")
    .select(
      "smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name, email_signature, email_batch_size, email_batch_delay"
    )
    .eq("id", ctx.workspace.id)
    .single();

  if (!data) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return NextResponse.json({
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    smtp_user: data.smtp_user,
    has_password: Boolean(data.smtp_pass_encrypted),
    email_from_name: data.email_from_name,
    email_signature: data.email_signature ?? "",
    email_batch_size: data.email_batch_size,
    email_batch_delay: data.email_batch_delay,
    to_email: ctx.user.email ?? "",
  });
}

// PUT /api/email-settings — save SMTP configuration
export async function PUT(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const updates: Record<string, unknown> = {};

  if ("smtp_host" in body) updates.smtp_host = body.smtp_host || null;
  if ("smtp_port" in body) {
    const port = Number(body.smtp_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: "Invalid SMTP port" }, { status: 400 });
    }
    updates.smtp_port = port;
  }
  if ("smtp_user" in body) updates.smtp_user = body.smtp_user || null;
  if ("smtp_password" in body && typeof body.smtp_password === "string" && body.smtp_password) {
    try {
      updates.smtp_pass_encrypted = encryptSecret(body.smtp_password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Encryption failed";
      if (message.includes("EMAIL_ENC_KEY")) {
        return NextResponse.json(
          {
            error:
              "The server is missing the EMAIL_ENC_KEY variable. Add it in Vercel → Settings → Environment Variables (value: the 32-byte base64 key from .env.local), then redeploy.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `Couldn't encrypt password: ${message}` },
        { status: 500 }
      );
    }
  }
  if ("email_from_name" in body) updates.email_from_name = body.email_from_name || null;
  if ("email_signature" in body) updates.email_signature = body.email_signature || null;
  if ("email_batch_size" in body) {
    const size = Number(body.email_batch_size);
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      return NextResponse.json({ error: "Batch size must be between 1 and 100" }, { status: 400 });
    }
    updates.email_batch_size = size;
  }
  if ("email_batch_delay" in body) {
    const delay = Number(body.email_batch_delay);
    if (!Number.isInteger(delay) || delay < 1 || delay > 1440) {
      return NextResponse.json({ error: "Delay must be between 1 and 1440 minutes" }, { status: 400 });
    }
    updates.email_batch_delay = delay;
  }

  const { error } = await ctx.supabase
    .from("workspaces")
    .update(updates)
    .eq("id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}