const CONTACT_SEPARATOR_REGEX = /[,;\n]+/;

function uniqueContactValues(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitContactValues(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value.join(",") : value ?? "";

  return uniqueContactValues(
    rawValue
      .split(CONTACT_SEPARATOR_REGEX)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function normalizeContactField(
  value: string | string[] | null | undefined
) {
  const entries = splitContactValues(value);
  return entries.length > 0 ? entries.join(", ") : null;
}

export function buildMailtoHref(value: string | string[] | null | undefined) {
  const recipients = splitContactValues(value);
  if (recipients.length === 0) return null;
  return `mailto:${recipients.map((recipient) => encodeURIComponent(recipient)).join(",")}`;
}

export function buildTelHref(value: string) {
  const sanitized = value.replace(/[^\d+]/g, "");
  return sanitized ? `tel:${sanitized}` : null;
}
