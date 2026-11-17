import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { insertAuditLog } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";
import { latestRunway, WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { PORTFOLIO } from "@/lib/portfolio/data";
import { companyHealth, DEMO_DATE, missingItems } from "@/lib/portfolio/health";

export const maxDuration = 30;

const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Aarka Portfolio Monitor <onboarding@resend.dev>";

function hasCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${cronSecret}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

async function runDigest(req: NextRequest, sendEmail: boolean) {
  const isCron = hasCronAuth(req);
  if (!isCron) {
    const gate = await requireRole();
    if (!gate.ok) {
      return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
    }
  }

  const today = DEMO_DATE;
  const overdueReports: Array<{ company: string; owner: string; what: string; overdueDays: number }> = [];
  const lowRunway: Array<{ company: string; owner: string; months: number; health: string }> = [];

  for (const c of PORTFOLIO) {
    const missing = missingItems(c, today).filter((m) => !m.key.endsWith(":question"));
    for (const m of missing) {
      overdueReports.push({
        company: c.name,
        owner: c.owner,
        what: m.what,
        overdueDays: m.overdueDays,
      });
    }
    const rw = latestRunway(c, today);
    if (rw && rw.months < WATCH_RUNWAY_MONTHS) {
      lowRunway.push({
        company: c.name,
        owner: c.owner,
        months: Math.round(rw.months * 10) / 10,
        health: companyHealth(c, today).band,
      });
    }
  }

  overdueReports.sort((a, b) => b.overdueDays - a.overdueDays);
  lowRunway.sort((a, b) => a.months - b.months);

  let emailed = false;
  const apiKey = process.env.RESEND_API_KEY;
  if ((sendEmail || isCron) && apiKey) {
    const resend = new Resend(apiKey);
    const runwayRows = lowRunway
      .map(
        (r) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;"><strong>${escapeHtml(r.company)}</strong></td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#b91c1c;font-weight:600;">${r.months} months</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(r.owner)}</td></tr>`,
      )
      .join("");
    const misRows = overdueReports
      .slice(0, 12)
      .map(
        (m) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;"><strong>${escapeHtml(m.company)}</strong></td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(m.what)}</td><td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;color:#b45309;">${m.overdueDays}d overdue</td></tr>`,
      )
      .join("");

    const res = await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `Aarka Portfolio Digest: ${lowRunway.length} Low Runway · ${overdueReports.length} Overdue MIS`,
      html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#2563eb;">Aarka · Automated Portfolio Monitor</div>
      <h1 style="margin:8px 0 0;font-size:19px;">Weekly Portfolio MIS &amp; Runway Digest</h1>
      <p style="margin:8px 0 18px;font-size:13px;color:#475569;">Checked ${PORTFOLIO.length} active portfolio companies against reporting deadlines and the &lt;${WATCH_RUNWAY_MONTHS}-month cash runway threshold.</p>
      <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Low Cash Runway Alerts (${lowRunway.length})</h2>
      ${lowRunway.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">${runwayRows}</table>` : `<p style="font-size:13px;color:#059669;">All portfolio companies have at least ${WATCH_RUNWAY_MONTHS} months of cash runway.</p>`}
      <h2 style="margin-top:20px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Overdue Monthly MIS &amp; Docs (${overdueReports.length})</h2>
      ${overdueReports.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">${misRows}</table>` : `<p style="font-size:13px;color:#059669;">All scheduled MIS reports have been received.</p>`}
    </div>
  </body>
</html>`,
    });
    emailed = !res.error;
  }

  const session = isCron ? null : await auth().catch(() => null);
  void insertAuditLog("PORTFOLIO_CRON_DIGEST", isCron ? "vercel-cron" : session?.user?.email || "partner", {
    companiesChecked: PORTFOLIO.length,
    lowRunwayCount: lowRunway.length,
    overdueReportsCount: overdueReports.length,
    emailed,
    message: `Portfolio monitor checked ${PORTFOLIO.length} companies: ${lowRunway.length} runway alerts, ${overdueReports.length} overdue MIS items${emailed ? " (digest emailed)" : ""}.`,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    companiesChecked: PORTFOLIO.length,
    lowRunway,
    overdueReports,
    emailed,
  });
}

export async function GET(req: NextRequest) {
  return runDigest(req, req.nextUrl.searchParams.get("send") === "true");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { sendEmail?: boolean };
  return runDigest(req, body.sendEmail !== false);
}
