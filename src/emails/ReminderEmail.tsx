import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
} from "@react-email/components";

export type StaleLead = {
  id: string;
  name: string;
  company: string | null;
  stage_name: string;
  sla_days: number;
  last_activity_at: string;
  due_at: string;
  notes: string | null;
};

function formatRelative(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function staleBy(dueAt: string): string {
  const ms = Date.now() - new Date(dueAt).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "less than 1 hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default function ReminderEmail({
  lead,
  appUrl,
  snoozeUrl,
}: {
  lead: StaleLead;
  appUrl: string;
  snoozeUrl: string;
}) {
  return (
    <Html>
      <Body
        style={{
          fontFamily: "Onest, -apple-system, sans-serif",
          backgroundColor: "#fdfaf3",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            padding: "40px 24px",
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: "#7a7265",
              marginBottom: 4,
              letterSpacing: "0.02em",
            }}
          >
            LeadTracker by Elivate
          </Text>

          <Heading
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: "#1a1714",
              fontSize: 24,
              fontWeight: 400,
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            Time to follow up
          </Heading>

          <Text style={{ fontSize: 16, color: "#3d3830", lineHeight: "1.6" }}>
            <strong>{lead.name}</strong>
            {lead.company && ` at ${lead.company}`} has been sitting in{" "}
            <strong>{lead.stage_name}</strong> for longer than your{" "}
            {lead.sla_days}-day SLA.
          </Text>

          <Text style={{ color: "#7a7265", fontSize: 14, lineHeight: "1.5" }}>
            Stale by {staleBy(lead.due_at)} &middot; Last activity:{" "}
            {formatRelative(lead.last_activity_at)}
          </Text>

          {lead.notes && (
            <Text
              style={{
                fontStyle: "italic",
                color: "#3d3830",
                fontSize: 14,
                lineHeight: "1.5",
                borderLeft: "3px solid #e8e2d4",
                paddingLeft: 12,
                marginTop: 12,
              }}
            >
              &ldquo;{lead.notes.slice(0, 200)}
              {lead.notes.length > 200 ? "..." : ""}&rdquo;
            </Text>
          )}

          <Section style={{ marginTop: 24 }}>
            <Button
              href={`${appUrl}/leads/${lead.id}`}
              style={{
                background: "#1a1714",
                color: "#fdfaf3",
                padding: "12px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Open lead
            </Button>
          </Section>

          <Hr
            style={{
              borderColor: "#e8e2d4",
              marginTop: 32,
              marginBottom: 16,
            }}
          />

          <Button
            href={snoozeUrl}
            style={{
              color: "#c4960a",
              fontSize: 13,
              textDecoration: "underline",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            Snooze for 3 days
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
