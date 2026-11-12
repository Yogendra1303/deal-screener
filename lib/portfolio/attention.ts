// One plain line per company on what needs the fund, worked out by code. The first line is the
// headline; the rest are shown on request. No AI and no scores.
import { fmtMoney, fmtMonth } from "../format";
import { companyHealth, fmtShort, fundHealth, portfolioFlags, runwayMonths, daysBetween } from "./health";
import type { MonthlyReport, PortfolioCompany } from "./types";

/** Partners ask "who runs out of cash in under nine months?", so the watch line sits there. */
export const WATCH_RUNWAY_MONTHS = 9;

export type AttentionLevel = "high" | "medium" | "low" | "good";

export interface Attention {
  level: AttentionLevel;
  text: string;
  /** Which tab of the company page shows the detail. */
  tab: "overview" | "numbers" | "reporting" | "activity";
  /** The number it is about, matching a KeyFact key, if any. */
  fact?: string;
}

const RANK: Record<AttentionLevel, number> = { high: 0, medium: 1, low: 2, good: 3 };

export function latestRunway(c: PortfolioCompany, today: string): { months: number; report: MonthlyReport } | null {
  const sent = c.reports.filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today).sort((a, b) => b.month.localeCompare(a.month));
  for (const r of sent) {
    const m = runwayMonths(r);
    if (m != null) return { months: m, report: r };
  }
  return null;
}

export function attentionFor(c: PortfolioCompany, today: string): Attention[] {
  const out: Attention[] = [];
  const health = companyHealth(c, today);
  const fund = fundHealth(c, today);
  const flags = portfolioFlags(c, today);
  const rw = latestRunway(c, today);
  const month = (m: string) => fmtMonth(m).split(" ")[0];

  if (rw && rw.months < WATCH_RUNWAY_MONTHS)
    out.push({
      level: rw.months < 6 ? "high" : "medium",
      text: `Cash covers about ${rw.months.toFixed(1)} months at ${month(rw.report.month)}'s burn.`,
      tab: "overview",
      fact: "runway",
    });
  if (health.band === "Gone quiet") out.push({ level: "high", text: health.reasons[0], tab: "reporting" });
  for (const f of flags.filter((x) => x.kind === "mismatch"))
    out.push({ level: "high", text: f.title.replace(": the form and the MIS disagree", ": form and MIS disagree") + ".", tab: "numbers", fact: f.metric });
  for (const f of flags.filter((x) => x.kind === "plan"))
    out.push(
      f.title.includes("below")
        ? { level: "medium", text: f.title + ".", tab: "numbers", fact: "plan" }
        : { level: "good", text: f.title + ".", tab: "numbers", fact: "plan" },
    );
  if (health.band === "Slipping") out.push({ level: "medium", text: health.reasons[0], tab: "reporting" });
  if (fund.band === "Slow") for (const r of fund.reasons) out.push({ level: "medium", text: `On us: ${r.charAt(0).toLowerCase()}${r.slice(1)}`, tab: "reporting" });
  for (const f of flags.filter((x) => x.kind === "move"))
    out.push({ level: "low", text: f.title + ".", tab: "numbers", fact: "revenue" });
  for (const a of c.asks.filter((x) => !x.answeredAt)) {
    const days = daysBetween(a.openedAt, today);
    if (days <= 14) out.push({ level: "low", text: `Founder asked: ${a.topic.toLowerCase()} (${days === 0 ? "today" : `${days} days ago`}).`, tab: "activity" });
  }
  if (c.nextRound) out.push({ level: "medium", text: `Raising a ${c.nextRound.round} in ${c.nextRound.when}. Follow-on decision ahead.`, tab: "overview" });

  // Good news is worth a line too, when nothing else is.
  const plan = c.pitch.plan;
  const planReport = c.reports.find((r) => r.month === plan.month && r.numbers.revenue);
  if (planReport && !flags.some((f) => f.kind === "plan")) {
    const diff = Math.round((planReport.numbers.revenue!.value / plan.revenue - 1) * 100);
    out.push({
      level: "good",
      text: diff >= 0 ? `${month(plan.month)} revenue ${fmtMoney(planReport.numbers.revenue!.value, c.currency)}, ${diff}% ahead of the deck's plan.` : `${month(plan.month)} revenue within ${Math.abs(diff)}% of the deck's plan.`,
      tab: "numbers",
      fact: "plan",
    });
  }
  if (health.band === "Too early")
    out.push({ level: "good", text: `New investment (${fmtShort(c.investment.date)}). First report in; the deck's plan is for ${fmtMonth(plan.month)}.`, tab: "overview" });

  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

export function needsAttention(list: Attention[]): boolean {
  return list.some((a) => a.level === "high" || a.level === "medium");
}
