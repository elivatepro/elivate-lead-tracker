import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, pickRecipient } from "../../src/lib/automations/step.ts";
import { validateGraph } from "../../src/lib/automations/graph.ts";
import { branchingGraph, lead, baseStopRules, graph, trigger, wait, end, edge, STAGE_A, STAGE_B } from "./helpers.mjs";

const NOW = new Date("2026-01-01T09:00:00.000Z");
const parse = (g) => {
  const r = validateGraph(g);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.graph;
};

function input(overrides = {}) {
  return {
    currentNodeId: "trg",
    graph: parse(branchingGraph()),
    lead: lead(),
    leadStageClosed: false,
    stopRules: baseStopRules,
    suppressed: new Set(),
    now: NOW,
    ...overrides,
  };
}

// Simulates what the engine does: apply each boundary the way
// automation_commit_step does (cursor := nextNode, clock jumps past waits).
function runToEnd(start) {
  const steps = [];
  let current = start.currentNodeId;
  let now = start.now;
  for (let i = 0; i < 20; i++) {
    const b = advance({ ...start, currentNodeId: current, now });
    steps.push(b);
    if (b.type === "stop" || b.type === "complete") return steps;
    current = b.nextNode;
    if (b.type === "wait") now = b.runAt;
  }
  throw new Error("did not terminate");
}

test("a tagged lead takes the yes branch: email, 2-day wait, email, complete", () => {
  const steps = runToEnd(input({ lead: lead({ tags: ["hot"] }) }));
  assert.deepEqual(steps.map((s) => s.type), ["email", "wait", "email", "complete"]);
  assert.equal(steps[0].nodeId, "e1");
  assert.equal(steps[0].subject, "Hot lead: Jane");
  assert.equal(steps[1].runAt.toISOString(), "2026-01-03T09:00:00.000Z");
  assert.equal(steps[2].nodeId, "e2");
  assert.equal(steps[2].subject, "Following up, Jane");
});

test("an untagged lead takes the no branch: one email, then complete", () => {
  const steps = runToEnd(input());
  assert.deepEqual(steps.map((s) => s.type), ["email", "complete"]);
  assert.equal(steps[0].nodeId, "e3");
});

test("the step log records the path taken", () => {
  const b = advance(input({ lead: lead({ tags: ["hot"] }) }));
  assert.deepEqual(b.log.map((l) => `${l.node_type}:${l.outcome}`), ["trigger:passed", "condition:yes", "send_email:enqueued"]);
});

test("an email boundary carries the successor so the commit can park on it", () => {
  const b = advance(input({ lead: lead({ tags: ["hot"] }) }));
  assert.equal(b.type, "email");
  assert.equal(b.nextNode, "w1");
  assert.equal(b.to, "jane@example.com");
});

test("resuming after an email continues from the successor node", () => {
  const b = advance(input({ currentNodeId: "e2", lead: lead({ tags: ["hot"] }) }));
  assert.equal(b.type, "email");
  assert.equal(b.nodeId, "e2");
  assert.equal(b.nextNode, "end1");
});

test("a wait ahead of the end: the wait is scheduled, and a null cursor completes", () => {
  const g = parse(graph([trigger(), wait("w1", 1, "hours"), end("z")], [edge("trg", "w1"), edge("w1", "z")]));
  const b = advance(input({ graph: g }));
  assert.equal(b.type, "wait");
  assert.equal(b.runAt.toISOString(), "2026-01-01T10:00:00.000Z");
  assert.equal(advance(input({ graph: g, currentNodeId: null })).type, "complete");
});

test("stop rules", () => {
  const stop = (over, expected) => {
    const b = advance(input(over));
    assert.equal(b.type, "stop");
    assert.equal(b.reason, expected);
  };
  stop({ lead: null }, "lead_deleted");
  stop({ lead: lead({ archived_at: "2026-01-01T00:00:00Z" }) }, "lead_archived");
  stop({ leadStageClosed: true }, "closed_stage");
  stop({ stopRules: { ...baseStopRules, stop_stage_ids: [STAGE_A] } }, "stop_stage");
  stop({ stopRules: { ...baseStopRules, while_in_stage: STAGE_B } }, "left_stage");
  stop({ stopRules: { ...baseStopRules, stop_tags: ["Do-Not-Contact"] }, lead: lead({ tags: [" do-not-contact "] }) }, "stop_tag");
});

test("closed-stage stop can be switched off (e.g. an automation that triggers on entering Won)", () => {
  const b = advance(input({ leadStageClosed: true, stopRules: { ...baseStopRules, on_closed_stage: false } }));
  assert.equal(b.type, "email");
});

test("stop rules are re-checked on resume, not just at enrollment", () => {
  const b = advance(input({ currentNodeId: "e2", lead: lead({ tags: ["hot"], archived_at: "2026-01-02T00:00:00Z" }) }));
  assert.equal(b.type, "stop");
  assert.equal(b.reason, "lead_archived");
});

test("recipient selection: first valid, non-suppressed address", () => {
  const none = new Set();
  assert.equal(pickRecipient("bad, ok@x.co, two@x.co", none), "ok@x.co");
  assert.equal(pickRecipient("a@x.co, b@x.co", new Set(["a@x.co"])), "b@x.co");
  assert.equal(pickRecipient("A@X.co", new Set(["a@x.co"])), null);
  assert.equal(pickRecipient(null, none), null);
  assert.equal(pickRecipient("no-at-sign", none), null);
});

test("no deliverable address stops the enrollment with a log entry", () => {
  const b = advance(input({ suppressed: new Set(["jane@example.com"]) }));
  assert.equal(b.type, "stop");
  assert.equal(b.reason, "no_deliverable_address");
  assert.equal(b.log.at(-1).outcome, "no_deliverable_address");
});

test("line breaks in lead data can't reach the subject", () => {
  const b = advance(input({ lead: lead({ name: "Eve\r\nBcc: x@y.co" }) }));
  assert.equal(b.type, "email");
  assert.ok(!/[\r\n]/.test(b.subject));
});

test("defensive: a missing node or a loop that slipped past validation stops instead of spinning", () => {
  const b = advance(input({ currentNodeId: "ghost" }));
  assert.equal(b.reason, "graph_error");

  const looping = { version: 1, nodes: [{ id: "trg", type: "trigger", data: {} }, { id: "c", type: "condition", data: { match: "all", rules: [{ field: "company", op: "is_set" }] } }], edges: [{ id: "1", source: "trg", target: "c" }, { id: "2", source: "c", target: "c", sourceHandle: "yes" }, { id: "3", source: "c", target: "c", sourceHandle: "no" }] };
  assert.equal(advance(input({ graph: looping })).reason, "graph_loop");
});
