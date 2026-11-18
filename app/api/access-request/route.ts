import { NextRequest, NextResponse } from "next/server";
import { getState, insertAuditLog, putState, upsertPermittedUsers } from "@/lib/db/repository";
import { recordAndAlertError } from "@/lib/error-logger";
import { auth, requireRole } from "@/lib/nextauth";
import { checkRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export interface AccessRequestItem {
  id: string;
  name: string;
  email: string;
  background: string;
  firm?: string;
  intent: string;
  additionalContext?: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REVOKED" | "INVITED" | "pending" | "approved" | "invited";
  reviewedBy?: string;
  reviewedAt?: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "Aarka Access Requests <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

export async function GET() {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  try {
    const list = (await getState<AccessRequestItem[]>("access_requests")) || [];
    return NextResponse.json({ requests: list, count: list.length });
  } catch {
    return NextResponse.json({ requests: [], count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    const rate = checkRateLimit("access_request", ip, 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many access requests. Please wait a few minutes and try again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }

    const body = await req.json().catch(() => ({}));

    // Silent honeypot check for automated spam bots
    if (typeof body.companyWebsite === "string" && body.companyWebsite.trim().length > 0) {
      return NextResponse.json({ ok: true, message: "Access request recorded successfully" });
    }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";
    const background = typeof body.background === "string" ? body.background.trim().slice(0, 120) : "Investor";
    const firm = typeof body.firm === "string" ? body.firm.trim().slice(0, 120) : "";
    const intent = typeof body.intent === "string" ? body.intent.trim().slice(0, 200) : "Evaluating platform";
    const additionalContext = typeof body.additionalContext === "string" ? body.additionalContext.trim().slice(0, 1000) : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const item: AccessRequestItem = {
      id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || email.split("@")[0],
      email,
      background,
      firm: firm || undefined,
      intent,
      additionalContext: additionalContext || undefined,
      createdAt: new Date().toISOString(),
      status: "PENDING",
    };

    const existing = (await getState<AccessRequestItem[]>("access_requests")) || [];
    const updated = [item, ...existing.filter((x) => x.email !== email)];
    await putState("access_requests", updated);

    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: ["yogendrakapkoti13@gmail.com"],
            reply_to: email,
            subject: `New Access Request: ${item.name} (${firm || background})`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #09090b; color: #f4f4f5; border-radius: 10px; border: 1px solid #27272a;">
                <h2 style="color: #ffffff; margin-top: 0; font-size: 18px;">New Institutional Access Request</h2>
                <p style="color: #a1a1aa; font-size: 14px;">Someone requested invite-only access to the Aarka workspace (status: PENDING):</p>
                <ul style="line-height: 1.8; color: #e4e4e7; font-size: 14px;">
                  <li><strong>Name:</strong> ${escapeHtml(item.name)}</li>
                  <li><strong>Email:</strong> ${escapeHtml(item.email)}</li>
                  <li><strong>Role:</strong> ${escapeHtml(item.background)}</li>
                  ${firm ? `<li><strong>Firm / Company:</strong> ${escapeHtml(firm)}</li>` : ""}
                  <li><strong>Reason for Exploring:</strong> ${escapeHtml(item.intent)}</li>
                  ${additionalContext ? `<li><strong>Additional Context:</strong> ${escapeHtml(additionalContext)}</li>` : ""}
                  <li><strong>Received:</strong> ${new Date().toLocaleString("en-US")}</li>
                </ul>
                <p style="margin-top: 20px; font-size: 13px; color: #71717a;">
                  Approve them in 1 click inside Aarka → Live site traffic → Access Requests.
                </p>
              </div>
            `,
          }),
        });
      } catch (mailErr) {
        console.error("[access-request] email dispatch warning:", mailErr);
      }
    }

    try {
      broadcastRealtimeEvent("deal.updated", { type: "access_request", item });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      message: "Access request recorded for partner review.",
      id: item.id,
    });
  } catch (err: unknown) {
    console.error("[api/access-request] error:", err);
    const e = err instanceof Error ? err : new Error(String(err));
    void recordAndAlertError({
      source: "api_route",
      message: e.message || "Failed to submit access request",
      stack: e.stack,
      url: "/api/access-request",
      component: "POST /api/access-request",
    });
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}

/** Partner-only 1-click Waitlist Approval / Revocation console: atomically syncs Supabase permitted_users & audit_logs. */
export async function PATCH(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      action?: "approve" | "revoke";
    };
    const email = String(body.email || "").trim().toLowerCase();
    const action = body.action;
    if (!email || !["approve", "revoke"].includes(String(action))) {
      return NextResponse.json({ error: "Provide email and action ('approve' or 'revoke')." }, { status: 400 });
    }

    const session = await auth().catch(() => null);
    const reviewer = session?.user?.email?.trim().toLowerCase() || "partner";
    const reviewedAt = new Date().toISOString();

    const list = (await getState<AccessRequestItem[]>("access_requests")) || [];
    const target = list.find((r) => r.email.toLowerCase() === email);
    const nextStatus = action === "approve" ? "APPROVED" : "REVOKED";

    const updated = list.map((r) =>
      r.email.toLowerCase() === email
        ? { ...r, status: nextStatus as AccessRequestItem["status"], reviewedBy: reviewer, reviewedAt }
        : r,
    );
    await putState("access_requests", updated);

    // Sync Supabase permitted_users table so approved users can immediately sign in via Google OAuth
    try {
      await upsertPermittedUsers([
        {
          email,
          name: target?.name ?? email.split("@")[0],
          role: "partner",
          active: action === "approve",
        },
      ]);
    } catch (permErr) {
      console.warn("[access-request][PATCH] permitted_users sync note:", permErr);
    }

    // Send approval confirmation email so newly whitelisted partners know they can sign in immediately
    if (action === "approve" && RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [email],
            reply_to: reviewer,
            subject: "Your Aarka Fund Workspace Access Is Approved",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #faf9f6; color: #0f172a; border-radius: 10px; border: 1px solid #e2e8f0;">
                <h2 style="margin-top: 0; font-size: 18px; color: #0f172a;">Welcome to Aarka</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                  Hi ${escapeHtml(target?.name ?? email.split("@")[0])}, your access request for the Aarka fund workspace has been approved. You can now sign in with your Google account (${escapeHtml(email)}).
                </p>
                <p style="margin-top: 20px;">
                  <a href="https://www.aarkavc.xyz/login" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
                    Sign In to Aarka Workspace →
                  </a>
                </p>
              </div>
            `,
          }),
        });
      } catch (mailErr) {
        console.warn("[access-request][PATCH] approval email warning:", mailErr);
      }
    }

    void insertAuditLog(action === "approve" ? "PARTNER_APPROVAL" : "PARTNER_REVOKE", reviewer, {
      targetEmail: email,
      targetName: target?.name,
      status: nextStatus,
      message: `${reviewer} ${action === "approve" ? "approved & whitelisted" : "revoked access for"} ${email}.`,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, email, status: nextStatus, requests: updated });
  } catch (err) {
    console.error("[api/access-request][PATCH] error:", err);
    return NextResponse.json({ error: "Could not update access request." }, { status: 500 });
  }
}
