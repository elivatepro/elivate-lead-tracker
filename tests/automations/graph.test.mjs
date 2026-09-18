import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGraph } from "../../src/lib/automations/graph.ts";
import { branchingGraph, graph, trigger, email, wait, cond, end, edge, STAGE_A } from "./helpers.mjs";

const errorsOf = (g) => {
  const r = validateGraph(g);
  assert.equal(r.ok, false, "expected the graph to be invalid");
  return r.errors.join(" | ");
};

test("a well-formed branching graph is valid and exposes its entry node", () => {
  const r = validateGraph(branchingGraph());
  assert.equal(r.ok, true);
  assert.equal(r.entryNodeId, "trg");
});

test("react-flow bookkeeping fields are stripped, not rejected", () => {
  const g = branchingGraph();
  g.nodes[0].selected = true;
  g.nodes[0].measured = { width: 10, height: 10 };
  g.nodes[0].dragging = false;
  const r = validateGraph(g);
  assert.equal(r.ok, true);
  assert.equal("selected" in r.graph.nodes[0], false);
});

test("needs exactly one trigger", () => {
  assert.match(errorsOf(graph([email("e1"), end("x")], [edge("e1", "x")])), /exactly one trigger/);
  assert.match(errorsOf(graph([trigger("a"), trigger("b"), end("x")], [edge("a", "x"), edge("b", "x")])), /exactly one trigger/);
});

test("rejects loops", () => {
  const g = graph(
    [trigger(), email("e1"), wait("w1"), end("end1")],
    [edge("trg", "e1"), edge("e1", "w1"), edge("w1", "e1")]
  );
  assert.match(errorsOf(g), /loop/);
});

test("rejects nodes not connected to the trigger", () => {
  const g = graph([trigger(), end("end1"), email("orphan"), end("end2")], [edge("trg", "end1"), edge("orphan", "end2")]);
  assert.match(errorsOf(g), /"orphan" isn't connected/);
});

test("a condition needs exactly one yes and one no", () => {
  const rule = [{ field: "tag", op: "has", value: "hot" }];
  const missingNo = graph([trigger(), cond("c", rule), end("a")], [edge("trg", "c"), edge("c", "a", "yes")]);
  assert.match(errorsOf(missingNo), /exactly one "yes" and one "no"/);
  const doubleYes = graph([trigger(), cond("c", rule), end("a"), end("b")], [edge("trg", "c"), edge("c", "a", "yes"), edge("c", "b", "yes")]);
  assert.match(errorsOf(doubleYes), /exactly one "yes" and one "no"/);
});

test("non-condition nodes need exactly one plain outgoing connection", () => {
  const two = graph([trigger(), end("a"), end("b")], [edge("trg", "a"), edge("trg", "b")]);
  assert.match(errorsOf(two), /needs exactly one outgoing/);
  const none = graph([trigger(), email("e1")], [edge("trg", "e1")]);
  assert.match(errorsOf(none), /"e1" \(send_email\) needs exactly one outgoing/);
  const handled = graph([trigger(), end("a")], [edge("trg", "a", "yes")]);
  assert.match(errorsOf(handled), /can't use a yes\/no/);
});

test("end nodes can't have outgoing connections", () => {
  const g = graph([trigger(), end("a"), end("b")], [edge("trg", "a"), edge("a", "b")]);
  assert.match(errorsOf(g), /End node "a"/);
});

test("edges must reference real nodes and can't be self-loops", () => {
  assert.match(errorsOf(graph([trigger(), end("a")], [edge("trg", "a"), edge("trg", "ghost")])), /missing node/);
  assert.match(errorsOf(graph([trigger(), wait("w"), end("a")], [edge("trg", "w"), edge("w", "w")])), /connects to itself/);
});

test("duplicate node ids are rejected", () => {
  assert.match(errorsOf(graph([trigger(), end("a"), end("a")], [edge("trg", "a")])), /Duplicate node id/);
});

test("unknown merge tags are caught at validation time", () => {
  const g = graph([trigger(), email("e1", "Hi {{nickname}}", "Body"), end("a")], [edge("trg", "e1"), edge("e1", "a")]);
  assert.match(errorsOf(g), /unknown merge tag\(s\): \{\{nickname\}\}/);
});

test("field-level validation: empty subject, bad wait, bad rule", () => {
  assert.match(errorsOf(graph([trigger(), email("e1", "", "Body"), end("a")], [edge("trg", "e1"), edge("e1", "a")])), /subject/);
  assert.match(errorsOf(graph([trigger(), wait("w", 0, "days"), end("a")], [edge("trg", "w"), edge("w", "a")])), /amount/);
  assert.match(errorsOf(graph([trigger(), cond("c", [{ field: "stage", op: "is", value: "not-a-uuid" }]), end("a"), end("b")], [edge("trg", "c"), edge("c", "a", "yes"), edge("c", "b", "no")])), /value/);
});

test("waits longer than 90 days are rejected", () => {
  const g = graph([trigger(), wait("w", 91, "days"), end("a")], [edge("trg", "w"), edge("w", "a")]);
  assert.match(errorsOf(g), /longer than 90 days/);
  const ok = graph([trigger(), wait("w", 90, "days"), end("a")], [edge("trg", "w"), edge("w", "a")]);
  assert.equal(validateGraph(ok).ok, true);
});

test("more than 50 nodes is rejected", () => {
  const nodes = [trigger(), ...Array.from({ length: 50 }, (_, i) => end(`n${i}`))];
  assert.match(errorsOf(graph(nodes, [])), /at most 50|too big|Too big/i);
});

test("a stage rule accepts a real uuid", () => {
  const g = graph(
    [trigger(), cond("c", [{ field: "stage", op: "is", value: STAGE_A }]), end("a"), end("b")],
    [edge("trg", "c"), edge("c", "a", "yes"), edge("c", "b", "no")]
  );
  assert.equal(validateGraph(g).ok, true);
});
