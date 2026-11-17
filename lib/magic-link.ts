import crypto from "crypto";
import { resolveAuthRole, type AuthRole } from "./nextauth";
import { getPermittedUser } from "./db/repository";

const AUTH_SECRET = process.env.AUTH_SECRET || "aarka-secret-key-vc-fund-2026";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export interface MagicTokenRecord {
  token: string;
  otp: string;
  email: string;
  role: AuthRole;
  name: string;
  expiresAt: number;
  callbackUrl?: string;
}

// In-memory token cache (in addition to DB sync)
const TOKEN_CACHE = new Map<string, MagicTokenRecord>();
const OTP_CACHE = new Map<string, MagicTokenRecord>();

export async function createMagicLinkToken(
  email: string,
  callbackUrl = "/"
): Promise<{ token: string; otp: string; role: AuthRole; name: string }> {
  const normalized = email.trim().toLowerCase();
  const role = await resolveAuthRole(normalized);
  const permitted = await getPermittedUser(normalized);

  const name =
    permitted?.name ||
    (normalized.includes("yogendra")
      ? "Yogendra Kapkoti"
      : normalized.includes("ashutosh")
      ? "Ashutosh Sinha"
      : normalized.includes("gopal")
      ? "Gopal Ahuja"
      : normalized.includes("sanchit")
      ? "Sanchit Kumar"
      : normalized.split("@")[0]);

  // Generate 6-digit numeric OTP (e.g. 749201)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Generate URL token
  const random = crypto.randomBytes(24).toString("hex");
  const payload = `${normalized}:${otp}:${Date.now()}:${random}`;
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${signature}`).toString("base64url");

  const record: MagicTokenRecord = {
    token,
    otp,
    email: normalized,
    role,
    name,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
    callbackUrl,
  };

  TOKEN_CACHE.set(token, record);
  OTP_CACHE.set(`${normalized}:${otp}`, record);

  // Clean old tokens
  const now = Date.now();
  for (const [k, v] of TOKEN_CACHE.entries()) {
    if (v.expiresAt < now) TOKEN_CACHE.delete(k);
  }
  for (const [k, v] of OTP_CACHE.entries()) {
    if (v.expiresAt < now) OTP_CACHE.delete(k);
  }

  return { token, otp, role, name };
}

export function verifyMagicToken(token: string): MagicTokenRecord | null {
  const record = TOKEN_CACHE.get(token);
  if (!record) {
    // Attempt decoding and verifying HMAC
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf-8");
      const parts = decoded.split(":");
      if (parts.length < 5) return null;
      const [email, otp, tsStr, random, signature] = parts;
      const payload = `${email}:${otp}:${tsStr}:${random}`;
      const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
      if (signature !== expected) return null;

      const ts = Number(tsStr);
      if (Date.now() - ts > 15 * 60 * 1000) return null;

      return {
        token,
        otp,
        email,
        role: "VC",
        name: email.split("@")[0],
        expiresAt: ts + 15 * 60 * 1000,
      };
    } catch {
      return null;
    }
  }

  if (record.expiresAt < Date.now()) {
    TOKEN_CACHE.delete(token);
    return null;
  }

  TOKEN_CACHE.delete(token);
  return record;
}

export function verifyMagicOtp(email: string, otp: string): MagicTokenRecord | null {
  const key = `${email.trim().toLowerCase()}:${otp.trim()}`;
  const record = OTP_CACHE.get(key);
  if (!record) return null;

  if (record.expiresAt < Date.now()) {
    OTP_CACHE.delete(key);
    return null;
  }

  OTP_CACHE.delete(key);
  return record;
}

export async function sendMagicLinkEmail(args: {
  email: string;
  name: string;
  role: AuthRole;
  token: string;
  otp: string;
  origin: string;
  callbackUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { email, name, role, token, otp, origin, callbackUrl } = args;
  const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}${
    callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
  }`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 40px 20px; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <div style="width: 36px; height: 36px; background: #000; color: #fff; font-weight: bold; font-size: 18px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; text-align: center; line-height: 36px;">
        ▲
      </div>
      <span style="font-size: 20px; font-weight: 700; margin-left: 12px; color: #ffffff; letter-spacing: -0.5px;">Aarka</span>
      <span style="font-size: 11px; margin-left: 8px; padding: 2px 8px; border-radius: 9999px; background: ${
        role === "VC" ? "rgba(59, 130, 246, 0.2); color: #60a5fa" : "rgba(16, 185, 129, 0.2); color: #34d399"
      }; font-weight: 600;">
        ${role === "VC" ? "PARTNER ACCESS" : "FOUNDER PORTAL"}
      </span>
    </div>

    <h2 style="font-size: 22px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 8px;">
      Your Secure Access Code
    </h2>
    <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
      Hello ${name}, use this one-click sign-in or enter the 6-digit verification code below to access your ${
        role === "VC" ? "partner workspace" : "founder portal"
      }.
    </p>

    <div style="background: #0f172a; border: 1px dashed #334155; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 28px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; font-weight: 600;">
        Verification Code
      </div>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; font-family: monospace;">
        ${otp}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
        Valid for 15 minutes · Never share this code
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
        Sign In Directly →
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; border-top: 1px solid #1e293b; padding-top: 16px;">
      If you did not request this login, you can safely ignore this email.<br>
      Aarka Investment Intelligence Platform · Confidential & Proprietary
    </p>
  </div>
</body>
</html>
  `.trim();

  if (!RESEND_API_KEY) {
    console.log(`[MagicLink] RESEND_API_KEY not configured. OTP for ${email}: ${otp}`);
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Aarka Partner Access <onboarding@resend.dev>",
        to: [email],
        reply_to: "yogendrakapkoti13@gmail.com",
        subject: `Your Aarka Login Code: ${otp}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[MagicLink] Resend dispatch error:", err);
      return { ok: false, error: err };
    }

    return { ok: true };
  } catch (err) {
    console.error("[MagicLink] Failed to send email:", err);
    return { ok: false, error: String(err) };
  }
}
