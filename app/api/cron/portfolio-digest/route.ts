import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getState, insertAuditLog } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";
import { latestRunway, WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { PORTFOLIO } from "@/lib/portfolio/data";
import { addMonths, companyHealth, DEMO_DATE, dueDateFor, lastDueMonth, missingItems } from "@/lib/portfolio/health";
import type { MetricKey, MonthlyReport, PortfolioCompany, ReportedNumber } from "@/lib/portfolio/types";

export const maxDuration = 30;

const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Aarka Portfolio Monitor <onboarding@resend.dev>";

interface SavedPortfolioOverlay {
  submitted?: Record<string, Record<string, { receivedAt: string; fileName: string; numbers: Partial<Record<MetricKey, ReportedNumber>> }>>;
  acks?: Record<string, Record<string, string>>;
  docs?: Record<string, Record<string, { receivedAt: string; fileName: string }>>;
}

function mergeLivePortfolio(companies: PortfolioCompany[], overlay: SavedPortfolioOverlay | undefined, today: string): PortfolioCompany[] {
  if (!overlay) return companies;
  return companies.map((c) => {
    const byMonth = new Map<string, MonthlyReport>(c.reports.map((r) => [r.month, { ...r }]));
    const first = c.reports[0]?.month ?? addMonths(c.investment.date.slice(0, 7), 1);
    for (let month = first; month <= lastDueMonth(today); month = addMonths(month, 1)) {
      if (!byMonth.has(month)) {
        byMonth.set(month, { month, dueDate: dueDateFor(month), receivedAt: null, numbers: {}, acknowledgedAt: null });
      }
    }
    for (const [month, s] of Object.entries(overlay.submitted?.[c.id] ?? {})) {
      const r = byMonth.get(month) ?? { month, dueDate: dueDateFor(month), receivedAt: null, numbers: {}, acknowledgedAt: null };
      byMonth.set(month, { ...r, receivedAt: s.receivedAt, fileName: s.fileName || undefined, numbers: s.numbers });
    }
    for (const [month, date] of Object.entries(overlay.acks?.[c.id] ?? {})) {
      const r = byMonth.get(month);
      if (r && !r.acknowledgedAt) byMonth.set(month, { ...r, acknowledgedAt: date });
    }
    return {
      ...c,
      reports: [...byMonth.values()].sort((a, b) => (a.month ?? "").localeCompare(b.month ?? "")),
      requests: c.requests.map((q) => {
        const got = overlay.docs?.[c.id]?.[q.id];
        return got && !q.receivedAt ? { ...q, receivedAt: got.receivedAt, fileName: got.fileName } : q;
      }),
    };
  });
}

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

  // Dynamic evaluation date: defaults to real calendar today, supports query/env override for testing
  const paramDate = req.nextUrl.searchParams.get("date") || process.env.OVERRIDE_CRON_DATE;
  const today = paramDate || (process.env.NODE_ENV === "test" ? DEMO_DATE : new Date().toISOString().slice(0, 10));

  // Hydrate live partner/founder MIS submissions from DB so already-submitted reports are not falsely flagged overdue
  const overlay = await getState<SavedPortfolioOverlay>("ds.portfolio.v1").catch(() => undefined);
  const livePortfolio = mergeLivePortfolio(PORTFOLIO, overlay, today);

  const overdueReports: Array<{ company: string; companyId: string; owner: string; what: string; overdueDays: number }> = [];
  const lowRunway: Array<{ company: string; companyId: string; owner: string; months: number; health: string }> = [];

  for (const c of livePortfolio) {
    const missing = missingItems(c, today).filter((m) => !m.key.endsWith(":question"));
    for (const m of missing) {
      overdueReports.push({
        company: c.name,
        companyId: c.id,
        owner: c.owner,
        what: m.what,
        overdueDays: m.overdueDays,
      });
    }
    const rw = latestRunway(c, today);
    if (rw && rw.months < WATCH_RUNWAY_MONTHS) {
      lowRunway.push({
        company: c.name,
        companyId: c.id,
        owner: c.owner,
        months: Math.round(rw.months * 10) / 10,
        health: companyHealth(c, today).band,
      });
    }
  }

  overdueReports.sort((a, b) => b.overdueDays - a.overdueDays);
  lowRunway.sort((a, b) => a.months - b.months);

  // Optional automated founder reminder dispatch (?remind=true)
  const shouldRemindFounders = req.nextUrl.searchParams.get("remind") === "true";
  const founderReminders: Array<{ company: string; what: string; sent: boolean }> = [];

  const apiKey = process.env.RESEND_API_KEY;
  if (shouldRemindFounders && apiKey && overdueReports.length > 0) {
    const resend = new Resend(apiKey);
    for (const item of overdueReports.slice(0, 6)) {
      try {
        await resend.emails.send({
          from: ALERT_FROM,
          to: ALERT_TO, // In production, route to founder or partner owner
          subject: `Aarka Reminder: Monthly MIS Due for ${item.company} (${item.what})`,
          html: `<p>Hi team,</p><p>This is a friendly automated reminder that the <strong>${escapeHtml(item.what)}</strong> for <strong>${escapeHtml(item.company)}</strong> is due for fund review.</p><p>Please upload your monthly CSV numbers or MIS deck directly in your workspace:</p><p><a href="https://www.aarkavc.xyz/portfolio/${encodeURIComponent(item.companyId)}" style="color:#2563eb;font-weight:600;">Open Portfolio Data Room &rarr;</a></p><p>Best regards,<br/>Aarka Portfolio Operations</p>`,
        });
        founderReminders.push({ company: item.company, what: item.what, sent: true });
        void insertAuditLog("FOUNDER_MIS_REMINDER", "portfolio-cron", {
          company: item.company,
          companyId: item.companyId,
          what: item.what,
        }).catch(() => undefined);
      } catch {
        founderReminders.push({ company: item.company, what: item.what, sent: false });
      }
    }
  }

  let emailed = false;
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
      <p style="margin:8px 0 18px;font-size:13px;color:#475569;">Checked ${livePortfolio.length} active portfolio companies (including live MIS submissions) against reporting deadlines and the &lt;${WATCH_RUNWAY_MONTHS}-month cash runway threshold.</p>
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
    companiesChecked: livePortfolio.length,
    lowRunwayCount: lowRunway.length,
    overdueReportsCount: overdueReports.length,
    emailed,
    founderRemindersCount: founderReminders.length,
    evaluationDate: today,
    message: `Portfolio monitor checked ${livePortfolio.length} companies as of ${today}: ${lowRunway.length} runway alerts, ${overdueReports.length} overdue MIS items${emailed ? " (digest emailed)" : ""}.`,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    evaluationDate: today,
    companiesChecked: livePortfolio.length,
    liveOverlayMerged: Boolean(overlay),
    lowRunway,
    overdueReports,
    emailed,
    founderReminders,
  });
}

export async function GET(req: NextRequest) {
  return runDigest(req, req.nextUrl.searchParams.get("send") === "true");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { sendEmail?: boolean };
  return runDigest(req, body.sendEmail !== false);
}
