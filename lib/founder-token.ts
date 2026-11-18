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

export const DEFAULT_FOUNDER_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days standard window

/**
 * Generates an unforgeable, time-bound, deal-scoped HMAC-SHA256 tracking token.
 * Format: v2.<issuedEpochMs>.<signature>
 * Bound to exact dealId, founderEmail, and issuedAt timestamp.
 */
export function createPitchToken(
  dealId: string,
  founderEmail: string,
  issuedAt: number = Date.now(),
): string {
  const cleanId = dealId.trim();
  const cleanEmail = founderEmail.trim().toLowerCase();
  const payload = `aarka:pitch:v2:${cleanId}:${cleanEmail}:${issuedAt}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url")
    .slice(0, 43);
  return `v2.${issuedAt}.${sig}`;
}

/**
 * Constant-time HMAC verification with expiration checking.
 * Supports time-bound v2 tokens and backward-compatible v1 legacy tokens.
 */
export function verifyPitchToken(
  dealId: string,
  founderEmail: string,
  token: string | null | undefined,
  maxAgeMs: number = DEFAULT_FOUNDER_TOKEN_TTL_MS,
): boolean {
  if (!dealId || !founderEmail || !token) return false;
  const trimmed = token.trim();

  // 1. Time-bound v2 token: v2.<issuedEpochMs>.<signature>
  if (trimmed.startsWith("v2.")) {
    const parts = trimmed.split(".");
    if (parts.length !== 3) return false;
    const issuedAt = parseInt(parts[1], 10);
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;

    // Check expiration window
    const now = Date.now();
    if (now - issuedAt > maxAgeMs) {
      return false; // Token expired
    }
    // Disallow future timestamps beyond 5 minutes clock skew
    if (issuedAt - now > 5 * 60 * 1000) {
      return false;
    }

    const expected = createPitchToken(dealId, founderEmail, issuedAt);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(trimmed, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // 2. Backward compatibility fallback for legacy v1 tokens
  const legacyPayload = `aarka:pitch:v1:${dealId.trim()}:${founderEmail.trim().toLowerCase()}`;
  const expectedLegacy = crypto
    .createHmac("sha256", getSigningSecret())
    .update(legacyPayload)
    .digest("base64url")
    .slice(0, 43);
  const aLegacy = Buffer.from(expectedLegacy, "utf8");
  const bLegacy = Buffer.from(trimmed, "utf8");
  if (aLegacy.length !== bLegacy.length) return false;
  return crypto.timingSafeEqual(aLegacy, bLegacy);
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
    if (ownerEmail) {
      if (verifyPitchToken(deal.id, ownerEmail, token)) {
        return { ok: true, deal, mode: "token", email: ownerEmail };
      }
      if (token.trim().startsWith("v2.")) {
        const parts = token.trim().split(".");
        const issued = parseInt(parts[1], 10);
        if (Number.isFinite(issued) && Date.now() - issued > DEFAULT_FOUNDER_TOKEN_TTL_MS) {
          return { ok: false, status: 403, error: "This pitch access link has expired. Please request a new tracking link." };
        }
      }
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
