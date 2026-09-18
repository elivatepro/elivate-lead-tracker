export const STAGE_A = "11111111-1111-4111-8111-111111111111";
export const STAGE_B = "22222222-2222-4222-8222-222222222222";
export const STAGE_CLOSED = "33333333-3333-4333-8333-333333333333";

export const trigger = (id = "trg") => ({ id, type: "trigger", data: {} });
export const email = (id, subject = "Hi {{first_name|there}}", body = "Hello {{name}}") => ({ id, type: "send_email", data: { subject, body } });
export const wait = (id, amount = 1, unit = "days") => ({ id, type: "wait", data: { amount, unit } });
export const cond = (id, rules, match = "all") => ({ id, type: "condition", data: { match, rules } });
export const end = (id) => ({ id, type: "end", data: {} });
export const edge = (source, target, sourceHandle) => ({ id: `${source}>${target}${sourceHandle ? ":" + sourceHandle : ""}`, source, target, sourceHandle });
export const graph = (nodes, edges) => ({ version: 1, nodes, edges });

// trg -> hot? --yes--> e1 -> wait 2d -> e2 -> end1
//              \--no---> e3 -> end2
export function branchingGraph() {
  return graph(
    [
      trigger(),
      cond("c1", [{ field: "tag", op: "has", value: "hot" }]),
      email("e1", "Hot lead: {{first_name|there}}"),
      wait("w1", 2, "days"),
      email("e2", "Following up, {{first_name|there}}"),
      end("end1"),
      email("e3", "Nice to meet you"),
      end("end2"),
    ],
    [
      edge("trg", "c1"),
      edge("c1", "e1", "yes"),
      edge("c1", "e3", "no"),
      edge("e1", "w1"),
      edge("w1", "e2"),
      edge("e2", "end1"),
      edge("e3", "end2"),
    ]
  );
}

export function lead(overrides = {}) {
  return {
    id: "lead-1",
    name: "Jane Doe",
    email: "jane@example.com",
    company: "Acme",
    source: "web",
    value: 500,
    tags: [],
    stage_id: STAGE_A,
    archived_at: null,
    ...overrides,
  };
}

export const baseStopRules = { on_closed_stage: true, stop_stage_ids: [], stop_tags: [], while_in_stage: null };
