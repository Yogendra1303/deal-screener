// A five-line brief a partner can read in a minute. Each line says who wrote it (code or AI)
// and cites the numbers or pages behind it, so every line can be opened and checked.
import { fmtMoney, fmtMonth } from "./format";
import { usd } from "./rules";
import { sheetGrowth } from "./sheet";
import { companyHealth, fundHealth } from "./portfolio/health";
import { latestRunway } from "./portfolio/attention";
import type { PortfolioCompany } from "./portfolio/types";
import type { KeyFact } from "./provenance";
import type { Question } from "./questions";
import type { DealResult } from "./types";

export interface Cite {
  label: string;
  fact?: string; // opens that number's evidence
  tab?: string; // or switches to a tab
  href?: string; // or opens a link
}

export interface BriefLine {
  topic: string;
  text: string;
  by: "Code" | "AI";
  cites: Cite[];
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export function dealBrief(deal: DealResult, facts: KeyFact[], deckUrl: string | null): BriefLine[] {
  const r = deal.record;
  const f = (k: string) => facts.find((x) => x.key === k);
  const deckPage = (p: number | null | undefined): Cite[] => (p ? [{ label: `Deck p. ${p}`, href: deckUrl ? `${deckUrl}#page=${p}` : undefined }] : []);
  const lines: BriefLine[] = [
    { topic: "What", text: r.oneLiner, by: "AI", cites: deckPage(r.company.description.page ?? r.company.name.page) },
  ];

  const sheet = deal.sheet ?? [];
  const last = [...sheet].reverse().find((x) => x.revenue != null);
  const g = sheet.length ? sheetGrowth(sheet) : null;
  if (last) {
    const cur = last.currency || r.traction.arr.currency || "";
    lines.push({
      topic: "Traction",
      text: `The founder's sheet shows ${fmtMoney(last.revenue, cur)} revenue in ${fmtMonth(last.month)}${g ? `, about ${g.pct.toFixed(0)}% growth a month since ${fmtMonth(g.from.month).split(" ")[0]}` : ""}${last.customers ? `, and ${last.customers} paying customers` : ""}.`,
      by: "Code",
      cites: [
        { label: "Revenue", fact: "revenue" },
        ...(g ? [{ label: "Growth", fact: "growth" }] : []),
        ...(last.customers ? [{ label: "Customers", fact: "customers" }] : []),
      ],
    });
  } else if (f("revenue")) {
    lines.push({ topic: "Traction", text: `The deck claims ${f("revenue")!.value}. No sheet was sent to check it.`, by: "Code", cites: [{ label: "Revenue", fact: "revenue" }] });
  }

  lines.push({
    topic: "Team",
    text: firstSentence(deal.ai.team.reason),
    by: "AI",
    cites: [...deckPage(r.team[0]?.page), ...(deal.profiles.length ? [{ label: "Profiles (sample)", tab: "team" }] : [])],
  });

  const round = f("round");
  const cap = f("valuation");
  lines.push({
    topic: "Round",
    text: `Raising ${round?.value ?? (deal.form.amountUsd ? usd(deal.form.amountUsd) : "an amount not stated")} at ${deal.form.stage}. ${cap?.status === "Missing" ? "No valuation or cap is stated, so the fund's stake can't be worked out yet." : `Valuation or cap: ${cap?.value}.`}`,
    by: "Code",
    cites: [
      { label: "Round", fact: "round" },
      { label: "Cap", fact: "valuation" },
    ],
  });

  const conflicts = facts.filter((x) => x.status === "Conflict");
  const missing = facts.filter((x) => x.status === "Missing" && x.headline);
  const before: string[] = [];
  if (conflicts.length) before.push(`clear ${conflicts.length === 1 ? "one conflict" : `${conflicts.length} conflicts`} (${conflicts.map((x) => x.label.toLowerCase()).join(", ")})`);
  if (missing.length) before.push(`ask for ${missing.map((x) => x.label.toLowerCase()).join(", ")}`);
  lines.push({
    topic: "Before a call",
    text: before.length ? `${before.join(", and ").replace(/^./, (c) => c.toUpperCase())}.` : "Nothing to clear. The deck, form and sheet agree.",
    by: "Code",
    cites: [...conflicts, ...missing].map((x) => ({ label: x.label, fact: x.key })),
  });
  return lines;
}

export function portfolioBrief(c: PortfolioCompany, facts: KeyFact[], questions: Question[], today: string): BriefLine[] {
  const f = (k: string) => facts.find((x) => x.key === k)!;
  const lines: BriefLine[] = [];
  const sent = c.reports.filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today && r.numbers.revenue);
  const last = sent.at(-1);
  const prev = sent.at(-2);
  const month = (m: string) => fmtMonth(m).split(" ")[0];

  if (last) {
    const v = last.numbers.revenue!.value;
    const change = prev ? Math.round((v / prev.numbers.revenue!.value - 1) * 100) : null;
    const plan = f("plan");
    const planText =
      plan.status === "Reported" || plan.status === "Conflict"
        ? `; ${plan.value.replace(/^[+−]/, "")} ${plan.value.startsWith("−") ? "below" : "ahead of"} the deck's plan for ${month(c.pitch.plan.month)}`
        : plan.status === "Missing"
          ? `; ${month(c.pitch.plan.month)}, the deck's plan month, hasn't been reported`
          : "";
    lines.push({
      topic: "Revenue",
      text: `${month(last.month)} revenue ${fmtMoney(v, c.currency)}${change != null ? `, ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% on ${month(prev!.month)}` : ""}${planText}.${f("revenue").status === "Conflict" ? " The founder's form and the MIS file disagree on it." : ""}`,
      by: "Code",
      cites: [
        { label: "Revenue", fact: "revenue" },
        { label: "Plan", fact: "plan" },
      ],
    });
  } else lines.push({ topic: "Revenue", text: "No report with revenue yet.", by: "Code", cites: [] });

  const rw = latestRunway(c, today);
  const bm = f("burnMultiple").value.endsWith("×");
  if (rw)
    lines.push({
      topic: "Cash",
      text: `About ${rw.months.toFixed(1)} months of runway at ${month(rw.report.month)}'s net burn of ${fmtMoney(rw.report.numbers.burn!.value, c.currency)}${bm ? `; burn multiple ${f("burnMultiple").value}` : f("burnMultiple").sub === "Revenue fell" ? "; revenue is falling, so burn buys no growth" : ""}.`,
      by: "Code",
      cites: [
        { label: "Runway", fact: "runway" },
        ...(f("burnMultiple").value !== "—" ? [{ label: "Burn multiple", fact: "burnMultiple" }] : []),
      ],
    });

  const ch = companyHealth(c, today);
  const fh = fundHealth(c, today);
  lines.push({
    topic: "Reporting",
    text: `Company: ${ch.band.toLowerCase()}. ${ch.reasons[0]} Fund: ${fh.band.toLowerCase()}. ${fh.reasons[0]}`,
    by: "Code",
    cites: [{ label: "Reporting", tab: "reporting" }],
  });

  const open = questions.filter((q) => !q.answer);
  const asks = c.asks.filter((a) => !a.answeredAt);
  const parts: string[] = [];
  if (open.length) parts.push(`${open.length} open ${open.length === 1 ? "question" : "questions"} inside the fund`);
  if (asks.length) parts.push(`${asks.length} founder ${asks.length === 1 ? "ask" : "asks"} waiting on us`);
  if (c.nextRound) parts.push(`a ${c.nextRound.round} planned for ${c.nextRound.when} (${c.nextRound.source.toLowerCase()})`);
  lines.push({
    topic: "Open",
    text: parts.length ? `${parts.join("; ").replace(/^./, (x) => x.toUpperCase())}.` : "Nothing open.",
    by: "Code",
    cites: asks.length ? [{ label: "Activity", tab: "activity" }] : [],
  });
  return lines;
}
