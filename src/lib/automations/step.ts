import { splitContactValues } from "../contacts.ts";
import { evalCondition } from "./conditions.ts";
import { waitDurationMs, type Graph, type GraphNode, type StopRules } from "./graph.ts";
import { renderMergeTags, renderSubject } from "./merge-tags.ts";

// The engine's decision function. Pure and deterministic: the clock, lead
// state and suppression set are passed in, nothing is read or written. That's
// what makes branching, waits and stop rules testable without a database.

export type LeadState = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  source: string | null;
  value: number | null;
  tags: string[];
  stage_id: string;
  archived_at: string | null;
};

export type StepInput = {
  currentNodeId: string | null;
  graph: Graph;
  lead: LeadState | null;
  leadStageClosed: boolean;
  stopRules: StopRules;
  // Lowercased addresses this workspace must never email.
  suppressed: ReadonlySet<string>;
  now: Date;
};

export type LogEntry = {
  node_id: string;
  node_type: string;
  outcome: string;
  detail?: Record<string, unknown>;
};

export type Boundary =
  | { type: "stop"; reason: string; log: LogEntry[] }
  | { type: "complete"; log: LogEntry[] }
  | { type: "wait"; nextNode: string | null; runAt: Date; log: LogEntry[] }
  | {
      type: "email";
      nodeId: string;
      nextNode: string | null;
      to: string;
      subject: string;
      body: string;
      log: LogEntry[];
    };

const MAX_HOPS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The automation sends to the first valid, non-suppressed address on the lead.
export function pickRecipient(email: string | null, suppressed: ReadonlySet<string>): string | null {
  for (const candidate of splitContactValues(email)) {
    if (candidate.length <= 254 && EMAIL_RE.test(candidate) && !suppressed.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
}

export function checkStopRules(input: StepInput): string | null {
  const { lead, stopRules } = input;
  if (!lead) return "lead_deleted";
  if (lead.archived_at) return "lead_archived";
  if (stopRules.on_closed_stage !== false && input.leadStageClosed) return "closed_stage";
  if (stopRules.stop_stage_ids?.includes(lead.stage_id)) return "stop_stage";
  if (stopRules.while_in_stage && lead.stage_id !== stopRules.while_in_stage) return "left_stage";
  const stopTags = (stopRules.stop_tags ?? []).map((t) => t.trim().toLowerCase());
  if (stopTags.length > 0 && lead.tags.some((t) => stopTags.includes(t.trim().toLowerCase()))) {
    return "stop_tag";
  }
  return null;
}

function successor(graph: Graph, node: GraphNode, handle?: "yes" | "no"): string | null {
  const edge = graph.edges.find(
    (e) => e.source === node.id && (handle === undefined || e.sourceHandle === handle)
  );
  return edge ? edge.target : null;
}

export function advance(input: StepInput): Boundary {
  const log: LogEntry[] = [];

  const stop = checkStopRules(input);
  if (stop) return { type: "stop", reason: stop, log };

  const lead = input.lead as LeadState;
  const nodes = new Map(input.graph.nodes.map((n) => [n.id, n]));
  let id = input.currentNodeId;

  for (let hops = 0; hops < MAX_HOPS; hops++) {
    if (!id) return { type: "complete", log };

    const node = nodes.get(id);
    if (!node) return { type: "stop", reason: "graph_error", log };

    switch (node.type) {
      case "trigger":
        log.push({ node_id: node.id, node_type: "trigger", outcome: "passed" });
        id = successor(input.graph, node);
        break;

      case "condition": {
        const yes = evalCondition(node.data, lead);
        log.push({ node_id: node.id, node_type: "condition", outcome: yes ? "yes" : "no" });
        id = successor(input.graph, node, yes ? "yes" : "no");
        if (!id) return { type: "stop", reason: "graph_error", log };
        break;
      }

      case "wait": {
        const ms = waitDurationMs(node.data);
        const runAt = new Date(input.now.getTime() + ms);
        log.push({
          node_id: node.id,
          node_type: "wait",
          outcome: "scheduled",
          detail: { amount: node.data.amount, unit: node.data.unit, run_at: runAt.toISOString() },
        });
        return { type: "wait", nextNode: successor(input.graph, node), runAt, log };
      }

      case "send_email": {
        const to = pickRecipient(lead.email, input.suppressed);
        if (!to) {
          log.push({ node_id: node.id, node_type: "send_email", outcome: "no_deliverable_address" });
          return { type: "stop", reason: "no_deliverable_address", log };
        }
        const ctx = { name: lead.name, company: lead.company, source: lead.source, value: lead.value };
        log.push({ node_id: node.id, node_type: "send_email", outcome: "enqueued", detail: { to } });
        return {
          type: "email",
          nodeId: node.id,
          nextNode: successor(input.graph, node),
          to,
          subject: renderSubject(node.data.subject, ctx),
          body: renderMergeTags(node.data.body, ctx),
          log,
        };
      }

      case "end":
        log.push({ node_id: node.id, node_type: "end", outcome: "completed" });
        return { type: "complete", log };
    }
  }

  return { type: "stop", reason: "graph_loop", log };
}
