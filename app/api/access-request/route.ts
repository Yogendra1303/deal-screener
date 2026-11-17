import { NextRequest, NextResponse } from "next/server";
import { getState, putState } from "@/lib/db/repository";
import { recordAndAlertError } from "@/lib/error-logger";
import { requireRole } from "@/lib/nextauth";
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
  status: "PENDING" | "APPROVED" | "INVITED" | "pending" | "approved" | "invited";
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

    // 1. Save to Supabase app_state (strictly pending manual approval — never grants workspace access)
    const existing = (await getState<AccessRequestItem[]>("access_requests")) || [];
    const updated = [item, ...existing.filter((x) => x.email !== email)];
    await putState("access_requests", updated);

    // 2. Notify Yogendra directly via Resend
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
                <p style="color: #a1a1aa; font-size: 14px;">Someone requested invite-only access to the Aarka workspace (dashboard access is NOT granted automatically):</p>
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
                  To approve access, add their Google email to your Google OAuth console and Supabase permitted_users table.
                </p>
              </div>
            `,
          }),
        });
      } catch (mailErr) {
        console.error("[access-request] email dispatch warning:", mailErr);
      }
    }

    // 3. Broadcast to authenticated Partner SSE listeners only
    try {
      broadcastRealtimeEvent("deal.updated", {
        type: "access_request",
        item,
      });
    } catch {
      // non-blocking
    }

    // Never issue a session cookie here — only manually approved Google OAuth partners can enter the workspace.
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
