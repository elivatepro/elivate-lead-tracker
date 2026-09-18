import { z } from "zod";
import { findUnknownMergeTags } from "./merge-tags.ts";

export const MAX_NODES = 50;
export const MAX_EDGES = 200;
export const MAX_WAIT_MS = 90 * 24 * 60 * 60 * 1000;

const nodeId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const position = z.object({ x: z.number(), y: z.number() }).optional();

const ruleSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("tag"), op: z.enum(["has", "not_has"]), value: z.string().trim().min(1).max(64) }),
  z.object({ field: z.literal("stage"), op: z.enum(["is", "is_not"]), value: z.string().uuid() }),
  z.object({ field: z.literal("source"), op: z.enum(["is", "is_not", "contains"]), value: z.string().trim().min(1).max(200) }),
  z.object({ field: z.literal("value"), op: z.enum(["gt", "gte", "lt", "lte", "eq"]), value: z.number() }),
  z.object({ field: z.literal("company"), op: z.enum(["is_set", "is_empty"]) }),
]);

const waitData = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  unit: z.enum(["minutes", "hours", "days"]),
});

const conditionData = z.object({
  match: z.enum(["all", "any"]).default("all"),
  rules: z.array(ruleSchema).min(1).max(10),
});

const emailData = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
});

const emptyData = z.object({}).default({});

const nodeSchema = z.discriminatedUnion("type", [
  z.object({ id: nodeId, type: z.literal("trigger"), position, data: emptyData }),
  z.object({ id: nodeId, type: z.literal("send_email"), position, data: emailData }),
  z.object({ id: nodeId, type: z.literal("wait"), position, data: waitData }),
  z.object({ id: nodeId, type: z.literal("condition"), position, data: conditionData }),
  z.object({ id: nodeId, type: z.literal("end"), position, data: emptyData }),
]);

const edgeSchema = z.object({
  id: z.string().min(1).max(80),
  source: nodeId,
  target: nodeId,
  sourceHandle: z.enum(["yes", "no"]).nullish(),
});

export const graphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(nodeSchema).min(1).max(MAX_NODES),
  edges: z.array(edgeSchema).max(MAX_EDGES),
});

export type Graph = z.infer<typeof graphSchema>;
export type GraphNode = Graph["nodes"][number];
export type GraphEdge = Graph["edges"][number];
export type Rule = z.infer<typeof ruleSchema>;
export type ConditionData = z.infer<typeof conditionData>;
export type WaitData = z.infer<typeof waitData>;

export const stopRulesSchema = z.object({
  on_closed_stage: z.boolean().default(true),
  stop_stage_ids: z.array(z.string().uuid()).max(20).default([]),
  stop_tags: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  while_in_stage: z.string().uuid().nullish(),
});
export type StopRules = z.infer<typeof stopRulesSchema>;

export const triggerConfigSchemas = {
  manual: z.object({}),
  lead_created: z.object({}),
  stage_changed: z.object({ stage_id: z.string().uuid() }),
  tag_added: z.object({ tag: z.string().trim().min(1).max(64) }),
} as const;

export function waitDurationMs(data: WaitData): number {
  const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[data.unit];
  return data.amount * unitMs;
}

export type GraphValidation =
  | { ok: true; graph: Graph; entryNodeId: string }
  | { ok: false; errors: string[] };

// Structural validation. Run on save (surface as warnings) and, strictly, on
// publish. Being a DAG with one path per node is what lets each enrollment
// keep a single cursor: no forks, no joins to synchronise.
export function validateGraph(input: unknown): GraphValidation {
  const parsed = graphSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "graph"}: ${i.message}`),
    };
  }

  const graph = parsed.data;
  const errors: string[] = [];
  const byId = new Map<string, GraphNode>();

  for (const node of graph.nodes) {
    if (byId.has(node.id)) errors.push(`Duplicate node id "${node.id}"`);
    byId.set(node.id, node);
  }

  const triggers = graph.nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) errors.push(`Needs exactly one trigger node (found ${triggers.length})`);

  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    if (!byId.has(edge.source)) errors.push(`Edge "${edge.id}" starts at a missing node`);
    if (!byId.has(edge.target)) errors.push(`Edge "${edge.id}" points to a missing node`);
    if (edge.source === edge.target) errors.push(`Node "${edge.source}" connects to itself`);
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }

  for (const node of graph.nodes) {
    const outs = outgoing.get(node.id) ?? [];
    if (node.type === "end") {
      if (outs.length > 0) errors.push(`End node "${node.id}" can't have outgoing connections`);
    } else if (node.type === "condition") {
      const yes = outs.filter((e) => e.sourceHandle === "yes").length;
      const no = outs.filter((e) => e.sourceHandle === "no").length;
      if (yes !== 1 || no !== 1 || outs.length !== 2) {
        errors.push(`Condition "${node.id}" needs exactly one "yes" and one "no" connection`);
      }
    } else {
      if (outs.length !== 1) errors.push(`Node "${node.id}" (${node.type}) needs exactly one outgoing connection`);
      else if (outs[0].sourceHandle) errors.push(`Node "${node.id}" (${node.type}) can't use a yes/no connection`);
    }

    if (node.type === "wait") {
      const ms = waitDurationMs(node.data);
      if (ms > MAX_WAIT_MS) errors.push(`Wait "${node.id}" is longer than 90 days`);
    }
    if (node.type === "send_email") {
      const unknown = [...findUnknownMergeTags(node.data.subject), ...findUnknownMergeTags(node.data.body)];
      if (unknown.length > 0) {
        errors.push(`Email "${node.id}" uses unknown merge tag(s): ${[...new Set(unknown)].map((t) => `{{${t}}}`).join(", ")}`);
      }
    }
  }

  if (triggers.length === 1) {
    const start = triggers[0].id;
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of outgoing.get(id) ?? []) if (byId.has(edge.target)) stack.push(edge.target);
    }
    for (const node of graph.nodes) {
      if (!seen.has(node.id)) errors.push(`Node "${node.id}" isn't connected to the trigger`);
    }

    // Cycle detection (DFS with colours) over what the trigger can reach.
    const colour = new Map<string, 1 | 2>();
    let cyclic = false;
    const visit = (id: string) => {
      if (cyclic) return;
      colour.set(id, 1);
      for (const edge of outgoing.get(id) ?? []) {
        const c = colour.get(edge.target);
        if (c === 1) cyclic = true;
        else if (c === undefined && byId.has(edge.target)) visit(edge.target);
      }
      colour.set(id, 2);
    };
    visit(start);
    if (cyclic) errors.push("The flow contains a loop; steps can't lead back to an earlier step");

    if (errors.length === 0) return { ok: true, graph, entryNodeId: start };
  }

  return { ok: false, errors };
}
