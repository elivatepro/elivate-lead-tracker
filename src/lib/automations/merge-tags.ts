// Merge tags: {{first_name}}, {{name}}, {{company}}, {{source}}, {{value}},
// each with an optional fallback: {{first_name|there}}.

export const MERGE_TAGS = ["first_name", "name", "company", "source", "value"] as const;
export type MergeTag = (typeof MERGE_TAGS)[number];

export type MergeContext = {
  name: string;
  company: string | null;
  source: string | null;
  value: number | null;
};

const TAG_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\|([^{}]*))?\}\}/g;

export function findUnknownMergeTags(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[1].toLowerCase();
    if (!(MERGE_TAGS as readonly string[]).includes(tag)) unknown.add(match[1]);
  }
  return [...unknown];
}

function resolve(tag: MergeTag, ctx: MergeContext): string {
  switch (tag) {
    case "first_name":
      return ctx.name.trim().split(/\s+/)[0] ?? "";
    case "name":
      return ctx.name.trim();
    case "company":
      return ctx.company?.trim() ?? "";
    case "source":
      return ctx.source?.trim() ?? "";
    case "value":
      return ctx.value === null || ctx.value === undefined ? "" : String(ctx.value);
  }
}

// Single pass: a substituted value that itself looks like a tag stays literal.
// The caller HTML-escapes the result (buildEmailHtml), so no escaping here.
export function renderMergeTags(text: string, ctx: MergeContext): string {
  return text.replace(TAG_RE, (whole, rawTag: string, fallback: string | undefined) => {
    const tag = rawTag.toLowerCase();
    if (!(MERGE_TAGS as readonly string[]).includes(tag)) return whole;
    const value = resolve(tag as MergeTag, ctx);
    return value !== "" ? value : (fallback ?? "").trim();
  });
}

// Subjects are single-line: lead data is untrusted (CSV imports), and a line
// break here would be a header-injection vector.
export function renderSubject(text: string, ctx: MergeContext): string {
  return renderMergeTags(text, ctx).replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
