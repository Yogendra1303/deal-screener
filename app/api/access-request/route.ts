import { NextRequest, NextResponse } from "next/server";
import { getState, putState, driver } from "@/lib/db/repository";
import { logAndNotify } from "@/lib/notify";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export interface AccessRequestItem {
  id: string;
  name: string;
  email: string;
  background: string;
  firm?: string;
  intent: string;
  createdAt: string;
  status: "pending" | "approved" | "invited";
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function GET() {
  try {
    const list = (await getState<AccessRequestItem[]>("access_requests")) || [];
    return NextResponse.json({ requests: list, count: list.length });
  } catch (err) {
    return NextResponse.json({ requests: [], count: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const background = typeof body.background === "string" ? body.background.trim() : "Investor";
    const firm = typeof body.firm === "string" ? body.firm.trim() : "";
    const intent = typeof body.intent === "string" ? body.intent.trim() : "Evaluating platform";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const item: AccessRequestItem = {
      id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || email.split("@")[0],
      email,
      background,
      firm: firm || undefined,
      intent,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    // 1. Save to Supabase app_state
    const existing = (await getState<AccessRequestItem[]>("access_requests")) || [];
    const updated = [item, ...existing.filter((x) => x.email !== email)];
    await putState("access_requests", updated);

    // 2. Notify Yogendra & Partners via Resend
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Aarka Access Requests <onboarding@resend.dev>",
            to: ["yogendrakapkoti13@gmail.com"],
            reply_to: email,
            subject: `✨ New Access Request: ${item.name} (${firm || background})`,
            html: `
              <div style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
                <h2 style="color: #38bdf8; margin-top: 0;">New Institutional Access Request</h2>
                <p>Someone has requested access to the Aarka VC Platform:</p>
                <ul style="line-height: 1.8;">
                  <li><strong>Name:</strong> ${item.name}</li>
                  <li><strong>Email:</strong> ${item.email}</li>
                  <li><strong>Background:</strong> ${item.background}</li>
                  ${firm ? `<li><strong>Firm/Fund:</strong> ${firm}</li>` : ""}
                  <li><strong>Reason for Exploring:</strong> ${item.intent}</li>
                  <li><strong>Received:</strong> ${new Date().toLocaleString("en-US")}</li>
                </ul>
                <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">
                  You can whitelist their email in the Google Auth Platform or approve them directly in Supabase permitted_users.
                </p>
              </div>
            `,
          }),
        });

        // Confirmation email to the requester
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Aarka <onboarding@resend.dev>",
            to: [email],
            reply_to: "yogendrakapkoti13@gmail.com",
            subject: "Your Aarka Institutional Access Request",
            html: `
              <div style="font-family: sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
                <h2 style="color: #38bdf8; margin-top: 0;">Welcome to Aarka</h2>
                <p>Hello ${item.name},</p>
                <p>Thank you for your interest in Aarka Investment Intelligence Platform. Our investment team has received your request.</p>
                <p>We review all fund and investor applications within 24 hours. In the meantime, you have been granted preview access to explore our live dealflow pipeline and financial verification workflows.</p>
                <p style="margin-top: 24px;">
                  <a href="https://www.aarkavc.xyz/?role=Partner" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                    Enter Preview Workspace →
                  </a>
                </p>
                <p style="font-size: 12px; color: #64748b; margin-top: 32px;">
                  Aarka · Investment Intelligence Platform · Confidential
                </p>
              </div>
            `,
          }),
        });
      } catch (mailErr) {
        console.error("[access-request] email dispatch warning:", mailErr);
      }
    }

    // 3. Broadcast to Realtime Bus
    try {
      broadcastRealtimeEvent("deal.updated", {
        type: "access_request",
        item,
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      message: "Access request recorded successfully",
      item,
    });
  } catch (err: any) {
    console.error("[api/access-request] error:", err);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
