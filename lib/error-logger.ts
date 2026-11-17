// Centralized Production Error Telemetry & Instant Alerting
// Logs errors to Supabase app_state ("system_errors") and dispatches immediate email alerts to Yogendra.
import { getState, putState, driver } from "./db/repository";

export interface SystemErrorEntry {
  id: string;
  source: "client_runtime" | "client_promise" | "react_boundary" | "api_route" | "other";
  message: string;
  stack?: string;
  url?: string;
  component?: string;
  userEmail?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolved?: boolean;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = "yogendrakapkoti13@gmail.com";
const STATE_KEY = "system_errors";
const MAX_STORED_ERRORS = 200;

// In-memory 5-minute deduplication map to prevent email storms from repeated errors
const RECENT_ALERTS = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function recordAndAlertError(
  input: Omit<SystemErrorEntry, "id" | "createdAt" | "resolved">
): Promise<{ ok: boolean; entry: SystemErrorEntry; emailed: boolean }> {
  const entry: SystemErrorEntry = {
    id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    source: input.source || "other",
    message: (input.message || "Unknown error").slice(0, 1000),
    stack: input.stack ? input.stack.slice(0, 4000) : undefined,
    url: input.url ? input.url.slice(0, 500) : undefined,
    component: input.component ? input.component.slice(0, 200) : undefined,
    userEmail: input.userEmail || undefined,
    userAgent: input.userAgent ? input.userAgent.slice(0, 300) : undefined,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
    resolved: false,
  };

  // 1. Persist to Supabase app_state so all errors are tracked permanently
  if (driver() !== "none") {
    try {
      const existing = (await getState<SystemErrorEntry[]>(STATE_KEY)) || [];
      const updated = [entry, ...existing].slice(0, MAX_STORED_ERRORS);
      await putState(STATE_KEY, updated);
    } catch (dbErr) {
      console.error("[error-logger] Failed to persist error to Supabase:", dbErr);
    }
  }

  // 2. Immediate Email Notification to Yogendra (deduplicated per signature over 5 mins)
  const signature = `${entry.source}:${entry.url || ""}:${entry.message.slice(0, 120)}`;
  const lastSent = RECENT_ALERTS.get(signature) || 0;
  let emailed = false;

  if (RESEND_API_KEY && Date.now() - lastSent > DEDUP_WINDOW_MS) {
    RECENT_ALERTS.set(signature, Date.now());
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aarka Error Monitor <onboarding@resend.dev>",
          to: [ALERT_EMAIL],
          subject: `🚨 AARKA ERROR [${entry.source}]: ${entry.message.slice(0, 70)}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #09090b; color: #f4f4f5; border-radius: 10px; border: 1px solid #27272a; max-width: 640px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <span style="background: #dc2626; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase;">
                  Production Error Alert
                </span>
                <span style="font-size: 12px; color: #a1a1aa;">${entry.id}</span>
              </div>
              <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #ffffff;">${entry.message}</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
                <tr><td style="padding: 4px 0; color: #a1a1aa; width: 120px;">Source:</td><td style="color: #60a5fa; font-weight: 600;">${entry.source}</td></tr>
                <tr><td style="padding: 4px 0; color: #a1a1aa;">URL / Route:</td><td style="color: #e4e4e7;">${entry.url || "N/A"}</td></tr>
                <tr><td style="padding: 4px 0; color: #a1a1aa;">Component:</td><td style="color: #e4e4e7;">${entry.component || "N/A"}</td></tr>
                <tr><td style="padding: 4px 0; color: #a1a1aa;">User:</td><td style="color: #e4e4e7;">${entry.userEmail || "Anonymous"}</td></tr>
                <tr><td style="padding: 4px 0; color: #a1a1aa;">Timestamp:</td><td style="color: #e4e4e7;">${entry.createdAt}</td></tr>
              </table>
              ${
                entry.stack
                  ? `<div style="background: #18181b; border: 1px solid #27272a; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; color: #fca5a5; white-space: pre-wrap; overflow-x: auto; margin-bottom: 16px;">${entry.stack.replace(/</g, "&lt;")}</div>`
                  : ""
              }
              <p style="font-size: 12px; color: #71717a; margin: 0;">
                Logged permanently in Supabase (<code>app_state.system_errors</code>). Inspect full error history at <a href="https://www.aarkavc.xyz/api/errors" style="color: #60a5fa;">https://www.aarkavc.xyz/api/errors</a>.
              </p>
            </div>
          `,
        }),
      });
      emailed = res.ok;
    } catch (mailErr) {
      console.error("[error-logger] Resend alert failed:", mailErr);
    }
  }

  return { ok: true, entry, emailed };
}

export async function listSystemErrors(): Promise<SystemErrorEntry[]> {
  if (driver() === "none") return [];
  try {
    return (await getState<SystemErrorEntry[]>(STATE_KEY)) || [];
  } catch {
    return [];
  }
}
