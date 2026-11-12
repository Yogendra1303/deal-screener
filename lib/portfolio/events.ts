// Everything that happened between the fund and a company, newest first. Built from the record.
import { fmtMonth } from "../format";
import { usd } from "../rules";
import { daysLate, fmtShort } from "./health";
import type { PortfolioCompany } from "./types";

export interface PortfolioEvent {
  date: string;
  who: "fund" | "company" | "screener";
  title: string;
  detail?: string;
}

export function companyEvents(c: PortfolioCompany, today: string): PortfolioEvent[] {
  const ev: PortfolioEvent[] = [
    { date: c.pitch.receivedAt, who: "company", title: "Pitch deck received", detail: c.pitch.deckFile },
    { date: c.pitch.receivedAt, who: "screener", title: `Screened: suggested ${c.pitch.band}` },
    { date: c.pitch.meetingAt, who: "fund", title: "First meeting with the founders", detail: c.partner },
    { date: c.investment.date, who: "fund", title: `Invested: ${c.investment.round}, ${usd(c.investment.amountUsd)} for ${c.investment.ownershipPct}%` },
  ];
  for (const r of c.reports) {
    if (r.receivedAt) {
      const late = r.receivedAt.slice(0, 10) > r.dueDate ? ` (${daysLate(r, today)} days late${r.excused ? ", agreed" : ""})` : "";
      ev.push({ date: r.receivedAt, who: "company", title: `${fmtMonth(r.month)} report sent${late}`, detail: r.fileName });
    }
    if (r.acknowledgedAt) ev.push({ date: r.acknowledgedAt, who: "fund", title: `${fmtMonth(r.month)} report read` });
    for (const d of r.reminders ?? []) ev.push({ date: d, who: "fund", title: `Reminder sent for the ${fmtMonth(r.month)} report` });
    if (r.question) {
      ev.push({ date: r.question.askedAt, who: "fund", title: `Question on the ${fmtMonth(r.month)} report`, detail: r.question.text });
      if (r.question.answeredAt) ev.push({ date: r.question.answeredAt, who: "company", title: "Founder answered", detail: r.question.answer });
    }
  }
  for (const q of c.requests) {
    ev.push({ date: q.askedAt, who: "fund", title: `Asked for: ${q.title}`, detail: `Due ${fmtShort(q.dueDate)}` });
    if (q.receivedAt) ev.push({ date: q.receivedAt, who: "company", title: `${q.title} sent`, detail: q.fileName });
    for (const d of q.reminders ?? []) ev.push({ date: d, who: "fund", title: `Reminder sent: ${q.title}` });
  }
  for (const a of c.asks) {
    ev.push({ date: a.openedAt, who: "company", title: `Founder asked: ${a.topic}`, detail: a.text });
    if (a.answeredAt) ev.push({ date: a.answeredAt, who: "fund", title: "Fund answered the ask", detail: a.outcome });
  }
  for (const n of c.notes) ev.push({ date: n.date, who: "fund", title: `Note from ${n.author}`, detail: n.text });
  return ev.filter((e) => e.date.slice(0, 10) <= today).sort((a, b) => b.date.localeCompare(a.date));
}
