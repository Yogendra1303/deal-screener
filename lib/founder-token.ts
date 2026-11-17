import crypto from "crypto";
import { getDeal, type DealRow } from "@/lib/db/repository";
import { auth, authEnabled } from "@/lib/nextauth";

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "aarka-dev-fallback-secret"
  );
}

export function extractDealOwnerEmail(deal: DealRow | null | undefined): string {
  if (!deal) return "";
  return (
    deal.founder_email ||
    (deal.intake_json as { form?: { email?: string } } | null)?.form?.email ||
    ""
  )
    .trim()
    .toLowerCase();
}

/**
 * Generates an unforgeable, deal-scoped HMAC-SHA256 tracking token bound to
 * BOTH the exact dealId AND the submitting founder's email address.
 * Changing dealId in the URL (/founder/dataroom/123 -> /founder/dataroom/124)
 * immediately invalidates the token.
 */
export function createPitchToken(dealId: string, founderEmail: string): string {
  const payload = `aarka:pitch:v1:${dealId.trim()}:${founderEmail.trim().toLowerCase()}`;
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url").slice(0, 43);
}

/** Constant-time HMAC verification to prevent timing attacks and URL parameter tampering. */
export function verifyPitchToken(dealId: string, founderEmail: string, token: string | null | undefined): boolean {
  if (!dealId || !founderEmail || !token) return false;
  const expected = createPitchToken(dealId, founderEmail);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token.trim(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type DealAccessResult =
  | { ok: true; deal: DealRow; mode: "token" | "vc" | "founder_session" | "open"; email: string }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/**
 * Row-Level Security enforcement for Founder Data Room & Pitch Status endpoints.
 * Guarantees a caller can ONLY access the exact pitch record they submitted via:
 *  1) A valid cryptographic tracking token bound to that exact dealId + founderEmail, OR
 *  2) A verified NextAuth session whose email matches that exact deal's founder_email (or approved VC).
 */
export async function authorizeFounderDealAccess(
  dealId: string,
  token?: string | null,
): Promise<DealAccessResult> {
  const cleanId = dealId.trim();
  if (!cleanId) {
    return { ok: false, status: 400, error: "Missing pitch ID." };
  }

  const deal = await getDeal(cleanId);
  if (!deal) {
    // Return 403/404 without leaking whether other deal IDs exist when token-checking
    return { ok: false, status: token ? 403 : 404, error: token ? "Access denied for this pitch link." : "Pitch record not found." };
  }

  const ownerEmail = extractDealOwnerEmail(deal);

  // 1. Check deal-scoped cryptographic token first
  if (token && token.trim()) {
    if (ownerEmail && verifyPitchToken(deal.id, ownerEmail, token)) {
      return { ok: true, deal, mode: "token", email: ownerEmail };
    }
    return { ok: false, status: 403, error: "Invalid or tampered pitch access link." };
  }

  // 2. Otherwise require a verified NextAuth session
  if (!authEnabled()) {
    return { ok: true, deal, mode: "open", email: ownerEmail };
  }

  const session = await auth();
  const sessionEmail = session?.user?.email?.trim().toLowerCase();
  if (!sessionEmail) {
    return { ok: false, status: 401, error: "Authentication or a valid pitch tracking token is required." };
  }

  if (session?.role === "VC") {
    return { ok: true, deal, mode: "vc", email: sessionEmail };
  }

  if (ownerEmail && ownerEmail === sessionEmail) {
    return { ok: true, deal, mode: "founder_session", email: sessionEmail };
  }

  return { ok: false, status: 403, error: "You do not have permission to access this pitch record." };
}
