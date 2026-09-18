import { splitContactValues } from "@/lib/contacts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Deliverable addresses on a lead's (possibly multi-value) email field.
export function validRecipients(value: string | null | undefined): string[] {
  return splitContactValues(value).filter(isValidEmail);
}
