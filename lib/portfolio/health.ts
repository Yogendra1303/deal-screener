// Reporting health, worked out by plain code from dates and counts. No AI.
// It is measured both ways: is the company reporting, and is the fund holding up its end?
// It gives bands with reasons, never a 0 to 100 number, and it never feeds the investment band.
import { fmtMoney, fmtMonth } from "../format";
import { METRICS, type MetricKey, type MonthlyReport, type PortfolioCompany } from "./types";

/** The prototype runs on a fixed date so the fictional data always reads the same. */
export const DEMO_DATE = "2026-10-29";

/** Every number the bands depend on. These are first guesses, meant to be tuned. */
export const HEALTH_RULES = {
  dueDay: 15, // a month's report is due on this day of the next month
  windowMonths: 6, // how far back the score looks
  lateDays: 10, // a report later than this counts against the company
  quietDays: 60, // no report for this long means "Gone quiet"
  completeMin: 0.75, // share of what was asked that must arrive over the last 3 months
  followUpDays: 7, // a founder should answer the fund's question within this
  ackDays: 7, // the fund should read or reply to a report within this (typical)
  askOpenDays: 14, // a founder's ask shouldn't stay open longer than this
  noteDays: 92, // the fund should write the founder a note at least this often
  runwayMonths: 6, // flag when cash covers fewer months than this
  moveShare: 0.3, // flag a month-on-month revenue move bigger than this
  planShare: 0.25, // flag when revenue misses or beats the deck's plan by more than this
};

export type MonthStatus = "on time" | "late" | "missing" | "excused" | "not due" | "before investment";
export type CompanyBand = "On track" | "Slipping" | "Gone quiet" | "Too early";
export type FundBand = "Responsive" | "Slow";

export const COMPANY_BAND_MEANING: Record<CompanyBand, string> = {
  "On track": "Reports arrive on time and complete",
  Slipping: "Reports are late or incomplete",
  "Gone quiet": "No recent reports",
  "Too early": "Not enough reports due yet",
};

export const FUND_BAND_MEANING: Record<FundBand, string> = {
  Responsive: "The fund reads reports and answers asks quickly",
  Slow: "Reports or asks are waiting on the fund",
};

const DAY = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / DAY);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The day a month's report is due: the 15th of the following month. */
export function dueDateFor(month: string): string {
  return `${addMonths(month, 1)}-${String(HEALTH_RULES.dueDay).padStart(2, "0")}`;
}

/** The latest month whose report is already due on `today`. */
export function lastDueMonth(today: string): string {
  const thisMonth = today.slice(0, 7);
  return dueDateFor(addMonths(thisMonth, -1)) <= today ? addMonths(thisMonth, -1) : addMonths(thisMonth, -2);
}

/** Months to show in a reporting strip: the last six that are due, then the next one. */
export function stripMonths(today: string, n = HEALTH_RULES.windowMonths): string[] {
  const last = lastDueMonth(today);
  return Array.from({ length: n + 1 }, (_, i) => addMonths(last, i - n + 1));
}

export function monthStatus(company: PortfolioCompany, month: string, today: string): MonthStatus {
  const r = company.reports.find((x) => x.month === month);
  if (month < company.investment.date.slice(0, 7) || (!r && month <= company.investment.date.slice(0, 7)))
    return "before investment";
  if (!r) return dueDateFor(month) > today ? "not due" : "missing";
  return reportStatus(r, today);
}

export function reportStatus(r: MonthlyReport, today: string): MonthStatus {
  if (r.excused) return r.receivedAt || r.dueDate <= today ? "excused" : "not due";
  if (r.receivedAt) return r.receivedAt.slice(0, 10) <= r.dueDate ? "on time" : "late";
  return r.dueDate > today ? "not due" : "missing";
}

/** Days past the due date: until it arrived, or until today if it hasn't. */
export function daysLate(r: MonthlyReport, today: string): number {
  return Math.max(0, daysBetween(r.dueDate, r.receivedAt ?? today));
}

/** Reports already due, oldest first. */
export function dueReports(company: PortfolioCompany, today: string): MonthlyReport[] {
  return company.reports.filter((r) => r.dueDate <= today || r.receivedAt).filter((r) => reportStatus(r, today) !== "not due")
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** Share of what was asked (the MIS file plus four numbers) that arrived. Agreed delays aren't counted. */
export function completeness(reports: MonthlyReport[], today: string): number | null {
  let asked = 0;
  let got = 0;
  for (const r of reports) {
    const status = reportStatus(r, today);
    if (status === "excused" && !r.receivedAt) continue;
    asked += 1 + METRICS.length;
    if (r.receivedAt) got += (r.fileName ? 1 : 0) + METRICS.filter((m) => r.numbers[m.key]).length;
  }
  return asked ? got / asked : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const monthName = (month: string) => fmtMonth(month).split(" ")[0];

export interface Signal {
  label: string;
  value: string;
  ok: boolean;
}

export interface CompanyHealth {
  band: CompanyBand;
  reasons: string[];
  signals: Signal[];
  lastReceived: string | null;
}

export interface FundHealth {
  band: FundBand;
  reasons: string[];
  signals: Signal[];
}

export function companyHealth(company: PortfolioCompany, today: string): CompanyHealth {
  const R = HEALTH_RULES;
  const due = dueReports(company, today);
  const windowed = due.slice(-R.windowMonths);
  const last3 = due.slice(-3);
  const received = company.reports.map((r) => r.receivedAt).filter((d): d is string => Boolean(d)).sort();
  const lastReceived = received.at(-1) ?? null;
  const sinceLast = lastReceived ? daysBetween(lastReceived, today) : due[0] ? daysBetween(due[0].dueDate, today) : 0;

  const onTime = windowed.filter((r) => ["on time", "excused"].includes(reportStatus(r, today))).length;
  const complete = completeness(windowed, today);
  const questions = company.reports.filter((r) => r.question && daysBetween(r.question.askedAt, today) > 0);
  const answeredFast = questions.filter(
    (r) => r.question!.answeredAt && daysBetween(r.question!.askedAt, r.question!.answeredAt) <= R.followUpDays,
  ).length;
  const signals: Signal[] = [
    { label: `On time, last ${R.windowMonths}`, value: windowed.length ? `${onTime} of ${windowed.length}` : "—", ok: onTime === windowed.length },
    { label: `Complete, last ${R.windowMonths}`, value: complete == null ? "—" : `${Math.round(complete * 100)}%`, ok: complete == null || complete >= R.completeMin },
    {
      label: "Last report",
      value: lastReceived ? (sinceLast === 0 ? "today" : `${plural(sinceLast, "day")} ago`) : "none yet",
      ok: sinceLast < R.quietDays,
    },
    {
      label: `Fund's questions answered within ${R.followUpDays} days`,
      value: questions.length ? `${answeredFast} of ${questions.length}` : "none asked",
      ok: answeredFast === questions.length,
    },
  ];

  if (due.length < 2)
    return {
      band: "Too early",
      reasons: [`Only ${plural(due.length, "report")} due so far. The score starts after two.`],
      signals,
      lastReceived,
    };

  const quiet: string[] = [];
  if (sinceLast >= R.quietDays)
    quiet.push(lastReceived ? `No report for ${sinceLast} days (last one arrived ${fmtShort(lastReceived)}).` : `No report since investment.`);
  const missing3 = last3.filter((r) => reportStatus(r, today) === "missing");
  if (missing3.length >= 2) quiet.push(`${missing3.length} of the last 3 reports are missing (${missing3.map((r) => monthName(r.month)).join(", ")}).`);
  if (quiet.length) return { band: "Gone quiet", reasons: quiet, signals, lastReceived };

  const slipping: string[] = [];
  for (const r of last3) {
    const status = reportStatus(r, today);
    const late = daysLate(r, today);
    if (status === "late" && late > R.lateDays) slipping.push(`${monthName(r.month)} report came ${late} days late.`);
    if (status === "missing" && late > R.lateDays) slipping.push(`${monthName(r.month)} report is ${late} days overdue.`);
  }
  const complete3 = completeness(last3, today);
  if (complete3 != null && complete3 < R.completeMin)
    slipping.push(`Only ${Math.round(complete3 * 100)}% of what was asked arrived in the last 3 months.`);
  if (slipping.length) return { band: "Slipping", reasons: slipping, signals, lastReceived };

  const reasons = [
    onTime === windowed.length
      ? `The last ${plural(windowed.length, "report")} all arrived on time or as agreed.`
      : `${onTime} of the last ${plural(windowed.length, "report")} arrived on time or as agreed.`,
  ];
  const gaps = last3.filter((r) => r.receivedAt && METRICS.some((m) => !r.numbers[m.key]));
  if (gaps.length) reasons.push(`${monthName(gaps[0].month)} report was missing a number, but most of what was asked arrived.`);
  const minorLate = last3.filter((r) => ["late", "missing"].includes(reportStatus(r, today)));
  if (minorLate.length) reasons.push(`${monthName(minorLate[0].month)} report is a few days late, within the ${R.lateDays}-day allowance.`);
  return { band: "On track", reasons, signals, lastReceived };
}

export function fundHealth(company: PortfolioCompany, today: string): FundHealth {
  const R = HEALTH_RULES;
  const receivedReports = dueReports(company, today)
    .filter((r) => r.receivedAt)
    .slice(-R.windowMonths);
  // A report nobody has read yet counts as waiting until today.
  const ackTimes = receivedReports.map((r) => daysBetween(r.receivedAt!, r.acknowledgedAt ?? today));
  const typical = median(ackTimes);
  const unread = receivedReports.filter((r) => !r.acknowledgedAt);
  const openAsks = company.asks.filter((a) => !a.answeredAt);
  const longestAsk = openAsks.map((a) => ({ a, days: daysBetween(a.openedAt, today) })).sort((x, y) => y.days - x.days)[0];
  const answered = company.asks.filter((a) => a.answeredAt);
  const askTimes = answered.map((a) => daysBetween(a.openedAt, a.answeredAt!));
  const lastNote = company.notes.map((n) => n.date).sort().at(-1) ?? null;
  const sinceNote = lastNote ? daysBetween(lastNote, today) : daysBetween(company.investment.date, today);

  const signals: Signal[] = [
    {
      label: "Typical time to read a report",
      value: typical == null ? "—" : typical === 0 ? "same day" : plural(Math.round(typical), "day"),
      ok: typical == null || typical <= R.ackDays,
    },
    { label: "Reports not read yet", value: String(unread.length), ok: unread.length === 0 },
    {
      label: "Founder asks open",
      value: openAsks.length ? `${openAsks.length} (oldest ${longestAsk.days ? plural(longestAsk.days, "day") : "opened today"})` : "none",
      ok: !longestAsk || longestAsk.days <= R.askOpenDays,
    },
    {
      label: "Asks answered in",
      value: askTimes.length ? `${plural(Math.round(median(askTimes)!), "day")} (typical)` : company.asks.length ? "none answered yet" : "no asks yet",
      ok: true,
    },
    { label: "Last note to the founder", value: lastNote ? fmtShort(lastNote) : "none yet", ok: sinceNote <= R.noteDays },
  ];

  const slow: string[] = [];
  if (typical != null && typical > R.ackDays)
    slow.push(`Reports wait ${plural(Math.round(typical), "day")} to be read (typical); the aim is ${R.ackDays}.`);
  for (const r of unread) {
    const waiting = daysBetween(r.receivedAt!, today);
    if (waiting > R.ackDays) slow.push(`${monthName(r.month)} report has waited ${waiting} days for someone to read it.`);
  }
  if (longestAsk && longestAsk.days > R.askOpenDays)
    slow.push(`A founder ask has been open ${longestAsk.days} days: “${longestAsk.a.topic}”.`);
  if (sinceNote > R.noteDays && daysBetween(company.investment.date, today) > R.noteDays)
    slow.push(lastNote ? `No note to the founder since ${fmtShort(lastNote)}.` : "No note to the founder since the investment.");
  if (slow.length) return { band: "Slow", reasons: slow, signals };

  const reasons = [
    typical == null ? "No reports to read yet." : `Reports read in ${typical <= 1 ? "a day or less" : plural(Math.round(typical), "day")} (typical).`,
  ];
  if (openAsks.length) reasons.push(`${plural(openAsks.length, "founder ask")} open, within ${R.askOpenDays} days.`);
  return { band: "Responsive", reasons, signals };
}

function fmtShort(iso: string): string {
  const d = new Date(iso.slice(0, 10));
  return `${d.getUTCDate()} ${fmtMonth(iso.slice(0, 7)).split(" ")[0]}`;
}

// ---- Flags on reported numbers: for a person to check, never corrected ----

export type PortfolioFlagKind = "mismatch" | "move" | "runway" | "plan";

export interface PortfolioFlag {
  kind: PortfolioFlagKind;
  month: string;
  metric: MetricKey;
  title: string;
  detail: string;
  page?: number;
}

export function runwayMonths(r: MonthlyReport): number | null {
  const cash = r.numbers.cash?.value;
  const burn = r.numbers.burn?.value;
  if (cash == null || burn == null || burn <= 0) return null;
  return cash / burn;
}

export function portfolioFlags(company: PortfolioCompany, today: string): PortfolioFlag[] {
  const R = HEALTH_RULES;
  const money = (n: number) => fmtMoney(n, company.currency);
  const reports = company.reports.filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today).sort((a, b) => a.month.localeCompare(b.month));
  const flags: PortfolioFlag[] = [];

  for (const r of reports) {
    for (const m of METRICS) {
      const n = r.numbers[m.key];
      if (n?.inFile != null && n.inFile !== n.value) {
        const show = m.money ? money : String;
        flags.push({
          kind: "mismatch",
          month: r.month,
          metric: m.key,
          title: `${m.label.split(" (")[0]} for ${fmtMonth(r.month)}: the form and the MIS disagree`,
          detail: `The founder typed ${show(n.value)}; page ${n.page} of the MIS shows ${show(n.inFile)}. Ask which is right. Neither is changed here.`,
          page: n.page,
        });
      }
    }
  }

  for (let i = 1; i < reports.length; i++) {
    const prev = reports[i - 1].numbers.revenue?.value;
    const cur = reports[i].numbers.revenue?.value;
    if (prev && cur != null && Math.abs(cur / prev - 1) > R.moveShare) {
      const change = Math.round((cur / prev - 1) * 100);
      flags.push({
        kind: "move",
        month: reports[i].month,
        metric: "revenue",
        title: `Revenue ${change > 0 ? "rose" : "fell"} ${Math.abs(change)}% from ${monthName(reports[i - 1].month)} to ${monthName(reports[i].month)}`,
        detail: `${money(prev)} to ${money(cur)}. Worth asking whether this will last.`,
        page: reports[i].numbers.revenue?.page,
      });
    }
  }

  const latest = reports.at(-1);
  const runway = latest ? runwayMonths(latest) : null;
  if (latest && runway != null && runway < R.runwayMonths)
    flags.push({
      kind: "runway",
      month: latest.month,
      metric: "cash",
      title: `Runway about ${runway.toFixed(1)} months at ${monthName(latest.month)}'s burn`,
      detail: `Cash ${money(latest.numbers.cash!.value)} divided by net burn ${money(latest.numbers.burn!.value)}, worked out by code.`,
      page: latest.numbers.cash?.page,
    });

  const planReport = reports.find((r) => r.month === company.pitch.plan.month);
  const planned = company.pitch.plan.revenue;
  const actual = planReport?.numbers.revenue?.value;
  if (planReport && actual != null && Math.abs(actual / planned - 1) > R.planShare) {
    const diff = Math.round((actual / planned - 1) * 100);
    flags.push({
      kind: "plan",
      month: planReport.month,
      metric: "revenue",
      title: `${fmtMonth(planReport.month)} revenue is ${Math.abs(diff)}% ${diff < 0 ? "below" : "above"} the pitch deck's plan`,
      detail: `The deck (page ${company.pitch.plan.page}) planned ${money(planned)} for ${fmtMonth(planReport.month)}; the founder reported ${money(actual)}.`,
      page: planReport.numbers.revenue?.page,
    });
  }

  return flags.sort((a, b) => b.month.localeCompare(a.month));
}

/** Everything still owed by the company, newest first: overdue reports, missing numbers, overdue documents. */
export interface MissingItem {
  key: string; // used for reminders
  what: string;
  detail: string;
  overdueDays: number;
  reminders: string[];
}

export function missingItems(company: PortfolioCompany, today: string): MissingItem[] {
  const items: MissingItem[] = [];
  for (const r of dueReports(company, today)) {
    const status = reportStatus(r, today);
    if (status === "missing")
      items.push({
        key: `${company.id}:${r.month}`,
        what: `${fmtMonth(r.month)} report`,
        detail: `The MIS file and four numbers, due ${fmtShort(r.dueDate)}.`,
        overdueDays: daysLate(r, today),
        reminders: r.reminders ?? [],
      });
    else if (r.receivedAt) {
      const gaps = METRICS.filter((m) => !r.numbers[m.key]).map((m) => m.label.split(" (")[0].toLowerCase());
      if (gaps.length || !r.fileName)
        items.push({
          key: `${company.id}:${r.month}`,
          what: `${fmtMonth(r.month)} report, part missing`,
          detail: [!r.fileName && "the MIS file", gaps.length && `${gaps.join(", ")}`].filter(Boolean).join(" and ") + " not sent.",
          overdueDays: daysLate({ ...r, receivedAt: null }, today),
          reminders: r.reminders ?? [],
        });
    }
    if (r.question && !r.question.answeredAt && daysBetween(r.question.askedAt, today) > HEALTH_RULES.followUpDays)
      items.push({
        key: `${company.id}:${r.month}:question`,
        what: `Answer to the fund's question on ${monthName(r.month)}`,
        detail: `“${r.question.text}”`,
        overdueDays: daysBetween(r.question.askedAt, today) - HEALTH_RULES.followUpDays,
        reminders: [],
      });
  }
  for (const q of company.requests) {
    if (!q.receivedAt && q.dueDate <= today)
      items.push({
        key: `${company.id}:${q.id}`,
        what: q.title,
        detail: `Asked ${fmtShort(q.askedAt)}, due ${fmtShort(q.dueDate)}.`,
        overdueDays: daysBetween(q.dueDate, today),
        reminders: q.reminders ?? [],
      });
  }
  return items.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** The report the founder should send next: the oldest one owed, else the next month's. */
export function nextReportMonth(company: PortfolioCompany, today: string): string {
  const owed = dueReports(company, today).find((r) => reportStatus(r, today) === "missing");
  if (owed) return owed.month;
  const sent = company.reports.filter((r) => r.receivedAt).map((r) => r.month).sort().at(-1);
  return sent ? addMonths(sent, 1) : company.investment.date.slice(0, 7);
}

export { fmtShort };
