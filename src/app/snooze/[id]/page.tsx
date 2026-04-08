import { createClient } from "@supabase/supabase-js";
import { verifySnoozeToken } from "@/lib/snooze-token";

export default async function SnoozePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <SnoozeResult status="error" message="Missing token." />;
  }

  const verified = verifySnoozeToken(token);
  if (!verified || verified.leadId !== id) {
    return (
      <SnoozeResult
        status="error"
        message="This snooze link is invalid or has expired."
      />
    );
  }

  // Use service role to bypass RLS — this is a public page
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the lead to confirm it exists
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, workspace_id")
    .eq("id", id)
    .single();

  if (!lead) {
    return <SnoozeResult status="error" message="Lead not found." />;
  }

  // Set snoozed_until to 3 days from now
  const snoozedUntil = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  await supabase
    .from("leads")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", id);

  // Log activity
  await supabase.from("activities").insert({
    workspace_id: lead.workspace_id,
    lead_id: id,
    type: "snoozed",
    payload: { snoozed_until: snoozedUntil, days: 3 },
  });

  return (
    <SnoozeResult
      status="success"
      message={`Reminders for "${lead.name}" have been snoozed for 3 days.`}
    />
  );
}

function SnoozeResult({
  status,
  message,
}: {
  status: "success" | "error";
  message: string;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fdfaf3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Onest, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {status === "success" ? "😴" : "⚠️"}
        </div>
        <h1
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "#1a1714",
            fontSize: 24,
            fontWeight: 400,
            marginBottom: 12,
          }}
        >
          {status === "success" ? "Snoozed" : "Something went wrong"}
        </h1>
        <p style={{ color: "#3d3830", fontSize: 15, lineHeight: "1.6" }}>
          {message}
        </p>
        {status === "success" && (
          <p
            style={{
              color: "#7a7265",
              fontSize: 13,
              marginTop: 16,
            }}
          >
            You can close this tab.
          </p>
        )}
      </div>
    </div>
  );
}
