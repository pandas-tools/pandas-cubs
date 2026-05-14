import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { clientAllowedDomains } from "./db/schema";

function adminAllowlist(): string[] {
  return (process.env.ADMIN_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function extractDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

export type DomainCheckResult =
  | { kind: "employee"; clientId: string }
  | { kind: "admin" }
  | { kind: "rejected" };

/**
 * Decide whether an email is allowed to receive a magic link.
 * - Employee: domain is in client_allowed_domains for some client
 * - Admin: email is in ADMIN_ALLOWLIST
 * - Rejected: neither
 */
export async function checkEmailAllowed(
  email: string,
): Promise<DomainCheckResult> {
  const normalized = email.toLowerCase().trim();
  if (adminAllowlist().includes(normalized)) {
    return { kind: "admin" };
  }
  const domain = extractDomain(normalized);
  if (!domain) return { kind: "rejected" };
  const [match] = await db
    .select()
    .from(clientAllowedDomains)
    .where(eq(clientAllowedDomains.domain, domain))
    .limit(1);
  if (!match) return { kind: "rejected" };
  return { kind: "employee", clientId: match.clientId };
}
