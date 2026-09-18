import type { ConditionData, Rule } from "./graph.ts";

export type ConditionLead = {
  tags: string[];
  stage_id: string;
  source: string | null;
  value: number | null;
  company: string | null;
};

const norm = (s: string) => s.trim().toLowerCase();

export function evalRule(rule: Rule, lead: ConditionLead): boolean {
  switch (rule.field) {
    case "tag": {
      const has = lead.tags.some((t) => norm(t) === norm(rule.value));
      return rule.op === "has" ? has : !has;
    }
    case "stage":
      return rule.op === "is" ? lead.stage_id === rule.value : lead.stage_id !== rule.value;
    case "source": {
      const source = norm(lead.source ?? "");
      const target = norm(rule.value);
      if (rule.op === "is") return source === target;
      if (rule.op === "is_not") return source !== target;
      return source.includes(target);
    }
    case "value": {
      if (lead.value === null || lead.value === undefined) return false;
      const v = lead.value;
      const results = {
        gt: v > rule.value,
        gte: v >= rule.value,
        lt: v < rule.value,
        lte: v <= rule.value,
        eq: v === rule.value,
      };
      return results[rule.op];
    }
    case "company": {
      const set = norm(lead.company ?? "") !== "";
      return rule.op === "is_set" ? set : !set;
    }
  }
}

export function evalCondition(data: ConditionData, lead: ConditionLead): boolean {
  const results = data.rules.map((rule) => evalRule(rule, lead));
  return data.match === "any" ? results.some(Boolean) : results.every(Boolean);
}
