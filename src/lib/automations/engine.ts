import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { runWithConcurrency } from "@/lib/concurrency";
import { splitContactValues } from "@/lib/contacts";
import { buildEmailHtml, buildEmailText } from "@/lib/email/render";
import { isValidEmail } from "@/lib/email/recipients";
import { graphSchema, stopRulesSchema, type Graph, type StopRules } from "./graph.ts";
import { advance, type Boundary, type LeadState } from "./step.ts";

// The engine's I/O shell around the pure advance() function. Each tick it
// leases due enrollments, loads what it needs in a handful of batched queries,
// asks advance() what to do, and commits each decision atomically through
// automation_commit_step. It only ever READS leads.

type Db = SupabaseClient;

type EnrollmentRow = {
  id: string;
  workspace_id: string;
  automation_id: string;
  version_id: string;
  lead_id: string;
  current_node_id: string | null;
  lock_token: string | null;
  attempts: number;
};
type VersionRow = { id: string; graph: unknown; stop_rules: unknown };
type LeadRow = Omit<LeadState, "value"> & { workspace_id: string; value: number | string | null };
type WorkspaceRow = {
  id: string;
  smtp_user: string | null;
  email_from_name: string | null;
  email_signature: string | null;
};

export type Decision = {
  enrollment_id: string;
  lead_id: string;
  node: string | null;
  outcome: Boundary["type"] | "error";
  detail?: unknown;
};

export type TickSummary = {
  dryRun: boolean;
  claimed: number;
  emailed: number;
  waiting: number;
  completed: number;
  stopped: number;
  retried: number;
  lostLease: number;
  recovered: number;
  decisions?: Decision[];
};

const BATCH = 50;
const LEASE_SECONDS = 120;
const CONCURRENCY = 5;
const TICK_BUDGET_MS = 45_000;
const MIN_TIME_FOR_BATCH_MS = 8_000;

const uniq = <T>(values: T[]) => [...new Set(values)];
const DEFAULT_STOP_RULES: StopRules = stopRulesSchema.parse({});

type Context = {
  versions: Map<string, { graph: Graph | null; stopRules: StopRules }>;
  leads: Map<string, LeadRow>;
  closedStages: Set<string>;
  workspaces: Map<string, WorkspaceRow>;
  suppressed: Map<string, Set<string>>;
};

async function loadContext(db: Db, rows: EnrollmentRow[]): Promise<Context> {
  const versionIds = uniq(rows.map((r) => r.version_id));
  const leadIds = uniq(rows.map((r) => r.lead_id));
  const workspaceIds = uniq(rows.map((r) => r.workspace_id));

  const [versionsRes, leadsRes, workspacesRes] = await Promise.all([
    db.from("automation_versions").select("id, graph, stop_rules").in("id", versionIds),
    db
      .from("leads")
      .select("id, workspace_id, name, email, company, source, value, tags, stage_id, archived_at")
      .in("id", leadIds),
    db
      .from("workspaces")
      .select("id, smtp_user, email_from_name, email_signature")
      .in("id", workspaceIds),
  ]);

  const versions = new Map<string, { graph: Graph | null; stopRules: StopRules }>();
  for (const v of (versionsRes.data ?? []) as VersionRow[]) {
    const graph = graphSchema.safeParse(v.graph);
    const stopRules = stopRulesSchema.safeParse(v.stop_rules);
    versions.set(v.id, {
      graph: graph.success ? graph.data : null,
      stopRules: stopRules.success ? stopRules.data : DEFAULT_STOP_RULES,
    });
  }

  const leads = new Map<string, LeadRow>();
  for (const l of (leadsRes.data ?? []) as LeadRow[]) leads.set(l.id, { ...l, tags: l.tags ?? [] });

  const stageIds = uniq([...leads.values()].map((l) => l.stage_id));
  const addresses = uniq(
    [...leads.values()].flatMap((l) => splitContactValues(l.email).map((a) => a.toLowerCase()))
  );

  const [stagesRes, suppressionsRes] = await Promise.all([
    stageIds.length
      ? db.from("stages").select("id, is_closed").in("id", stageIds)
      : Promise.resolve({ data: [] as { id: string; is_closed: boolean }[] }),
    addresses.length
      ? db
          .from("email_suppressions")
          .select("workspace_id, email")
          .in("workspace_id", workspaceIds)
          .in("email", addresses)
      : Promise.resolve({ data: [] as { workspace_id: string; email: string }[] }),
  ]);

  const suppressed = new Map<string, Set<string>>();
  for (const s of (suppressionsRes.data ?? []) as { workspace_id: string; email: string }[]) {
    const set = suppressed.get(s.workspace_id) ?? new Set<string>();
    set.add(s.email);
    suppressed.set(s.workspace_id, set);
  }

  return {
    versions,
    leads,
    closedStages: new Set(
      ((stagesRes.data ?? []) as { id: string; is_closed: boolean }[]).filter((s) => s.is_closed).map((s) => s.id)
    ),
    workspaces: new Map(((workspacesRes.data ?? []) as WorkspaceRow[]).map((w) => [w.id, w])),
    suppressed,
  };
}

type CommitArgs = {
  status: "active" | "completed" | "stopped" | "failed" | "retry";
  nextNode?: string | null;
  nextRunAt?: Date | null;
  stopReason?: string | null;
  error?: string | null;
  log?: unknown[];
  email?: Record<string, unknown> | null;
};

async function commit(db: Db, e: EnrollmentRow, args: CommitArgs): Promise<string> {
  const { data, error } = await db.rpc("automation_commit_step", {
    p_enrollment_id: e.id,
    p_lock_token: e.lock_token,
    p_expected_node: e.current_node_id,
    p_status: args.status,
    p_next_node: args.nextNode ?? null,
    p_next_run_at: args.nextRunAt ? args.nextRunAt.toISOString() : null,
    p_stop_reason: args.stopReason ?? null,
    p_error: args.error ?? null,
    p_log: args.log ?? [],
    p_email: args.email ?? null,
  });
  if (error) throw new Error(`automation_commit_step failed: ${error.message}`);
  return data as string;
}

// Turn a boundary into a commit. Returns the outcome for the summary/decisions.
async function process(
  db: Db,
  e: EnrollmentRow,
  ctx: Context,
  dry: boolean,
  summary: TickSummary
): Promise<Decision> {
  const version = ctx.versions.get(e.version_id);
  const lead = ctx.leads.get(e.lead_id) ?? null;
  const decision: Decision = { enrollment_id: e.id, lead_id: e.lead_id, node: e.current_node_id, outcome: "stop" };

  const finish = async (args: CommitArgs, outcome: Decision["outcome"], detail?: unknown) => {
    decision.outcome = outcome;
    decision.detail = detail;
    if (dry) return decision;
    const result = await commit(db, e, args);
    if (result === "lost_lease") summary.lostLease++;
    return decision;
  };

  if (!version?.graph) {
    summary.stopped++;
    return finish({ status: "stopped", stopReason: "graph_error" }, "stop", "graph_error");
  }
  // Defence in depth: an enrollment must only ever act on its own tenant's lead.
  if (lead && lead.workspace_id !== e.workspace_id) {
    summary.stopped++;
    return finish({ status: "stopped", stopReason: "lead_mismatch" }, "stop", "lead_mismatch");
  }

  const boundary = advance({
    currentNodeId: e.current_node_id,
    graph: version.graph,
    lead: lead ? { ...lead, value: lead.value === null ? null : Number(lead.value) } : null,
    leadStageClosed: lead ? ctx.closedStages.has(lead.stage_id) : false,
    stopRules: version.stopRules,
    suppressed: ctx.suppressed.get(e.workspace_id) ?? new Set<string>(),
    now: new Date(),
  });

  switch (boundary.type) {
    case "stop":
      summary.stopped++;
      return finish({ status: "stopped", stopReason: boundary.reason, log: boundary.log }, "stop", boundary.reason);

    case "complete":
      summary.completed++;
      return finish({ status: "completed", log: boundary.log }, "complete");

    case "wait":
      summary.waiting++;
      return finish(
        { status: "active", nextNode: boundary.nextNode, nextRunAt: boundary.runAt, log: boundary.log },
        "wait",
        boundary.runAt.toISOString()
      );

    case "email": {
      const ws = ctx.workspaces.get(e.workspace_id);
      const fromEmail = (ws?.smtp_user ?? "").trim();
      if (!ws || !isValidEmail(fromEmail)) {
        summary.stopped++;
        return finish({ status: "stopped", stopReason: "smtp_not_configured", log: boundary.log }, "stop", "smtp_not_configured");
      }
      if (!boundary.subject.trim() || !boundary.body.trim()) {
        summary.stopped++;
        return finish({ status: "stopped", stopReason: "empty_message", log: boundary.log }, "stop", "empty_message");
      }

      summary.emailed++;
      const email = dry
        ? null
        : {
            lead_id: e.lead_id,
            node_id: boundary.nodeId,
            to_email: boundary.to,
            subject: boundary.subject,
            body_html: await buildEmailHtml(boundary.body, ws.email_signature),
            body_text: buildEmailText(boundary.body, ws.email_signature),
            from_email: fromEmail,
            from_name: ws.email_from_name || "LeadTracker",
            // One send per enrollment per node, however many times a step is retried.
            idempotency_key: `${e.id}:${boundary.nodeId}`,
          };
      return finish(
        { status: "active", nextNode: boundary.nextNode, log: boundary.log, email },
        "email",
        { to: boundary.to, subject: boundary.subject }
      );
    }
  }
}

async function handle(db: Db, e: EnrollmentRow, ctx: Context, dry: boolean, summary: TickSummary) {
  try {
    return await process(db, e, ctx, dry, summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Automation step failed for enrollment ${e.id}:`, message);
    summary.retried++;
    if (!dry) {
      const backoffMinutes = Math.min(60, 2 ** (e.attempts + 1));
      try {
        await commit(db, e, {
          status: "retry",
          error: message.slice(0, 500),
          nextRunAt: new Date(Date.now() + backoffMinutes * 60_000),
        });
      } catch (commitErr) {
        // The lease expires on its own and the row is picked up again.
        console.error(`Couldn't record the failure for ${e.id}:`, commitErr);
      }
    }
    return { enrollment_id: e.id, lead_id: e.lead_id, node: e.current_node_id, outcome: "error", detail: message } as Decision;
  }
}

async function claim(db: Db): Promise<EnrollmentRow[]> {
  const { data, error } = await db.rpc("claim_due_enrollments", {
    p_limit: BATCH,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw new Error(`claim_due_enrollments failed: ${error.message}`);
  return (data ?? []) as EnrollmentRow[];
}

// Diagnostic view of what a real tick would pick up. Claims and commits nothing.
async function peekDue(db: Db): Promise<EnrollmentRow[]> {
  const { data, error } = await db
    .from("automation_enrollments")
    .select("id, workspace_id, automation_id, version_id, lead_id, current_node_id, attempts")
    .eq("status", "active")
    .not("next_run_at", "is", null)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`peek failed: ${error.message}`);
  return ((data ?? []) as Omit<EnrollmentRow, "lock_token">[]).map((r) => ({ ...r, lock_token: null }));
}

export async function runAutomationTick({ dry = false }: { dry?: boolean } = {}): Promise<TickSummary> {
  const deadline = Date.now() + TICK_BUDGET_MS;
  const db = createServiceClient();
  const summary: TickSummary = {
    dryRun: dry,
    claimed: 0,
    emailed: 0,
    waiting: 0,
    completed: 0,
    stopped: 0,
    retried: 0,
    lostLease: 0,
    recovered: 0,
    decisions: dry ? [] : undefined,
  };

  while (Date.now() < deadline - MIN_TIME_FOR_BATCH_MS) {
    const rows = dry ? await peekDue(db) : await claim(db);
    if (rows.length === 0) break;
    summary.claimed += rows.length;

    const ctx = await loadContext(db, rows);
    await runWithConcurrency(rows, CONCURRENCY, async (row) => {
      const decision = await handle(db, row, ctx, dry, summary);
      summary.decisions?.push(decision);
    });

    if (dry) break;
  }

  if (!dry) {
    const { data } = await db.rpc("automation_recover");
    summary.recovered = (data as number | null) ?? 0;
  }

  return summary;
}
