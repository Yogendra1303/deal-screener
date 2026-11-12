// The fund's own people, and who at the fund knows each company. Fictional sample data.
// Email and calendar aren't connected, so contacts on pitches are samples, and contacts on
// portfolio companies come from what people did in the hub (notes, replies, questions).
import { daysBetween } from "./portfolio/health";
import type { PortfolioCompany } from "./portfolio/types";
import { fmtMonth } from "./format";

export type Role = "Partner" | "Analyst";

export interface Member {
  name: string;
  role: Role;
  initials: string;
  tone: string; // avatar colour
}

export const TEAM: Member[] = [
  { name: "Kabir Shah", role: "Partner", initials: "KS", tone: "bg-indigo-600 text-white" },
  { name: "Riya Menon", role: "Analyst", initials: "RM", tone: "bg-teal-600 text-white" },
  { name: "Arjun Bhat", role: "Analyst", initials: "AB", tone: "bg-amber-500 text-white" },
];

export const PARTNER = TEAM[0];
export const ANALYSTS = TEAM.filter((m) => m.role === "Analyst");

export function member(name: string): Member {
  return (
    TEAM.find((m) => m.name === name) ?? {
      name,
      role: "Analyst",
      initials: name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      tone: "bg-slate-400 text-white",
    }
  );
}

/** Who looks after each pitch. Unlisted pitches are unassigned. */
export const DEAL_OWNERS: Record<string, string> = {
  ledgerly: "Riya Menon",
  freightnest: "Arjun Bhat",
  mandiflow: "Arjun Bhat",
};

export type TouchKind = "Email" | "Meeting" | "Call" | "Note" | "Reply" | "Question";

export interface Touch {
  date: string;
  kind: TouchKind;
  what: string;
}

export interface Contact {
  person: string; // someone at the fund
  knows: string; // a founder
  how: string;
  touches: Touch[];
  sample: boolean; // true = made up for the demo; false = worked out from what happened in the hub
}

export type Strength = "Close" | "Known" | "Cold";

/** Plain rule, no AI: three or more touches in 90 days is close; any touch in 180 days is known. */
export function strengthOf(c: Contact, today: string): Strength {
  const recent = (days: number) => c.touches.filter((t) => t.date <= today && daysBetween(t.date, today) <= days).length;
  if (recent(90) >= 3) return "Close";
  if (recent(180) >= 1) return "Known";
  return "Cold";
}

export function lastTouch(c: Contact, today: string): Touch | undefined {
  return [...c.touches].filter((t) => t.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Sample contacts for pitches, as if email and calendar were connected. */
export const DEAL_CONTACTS: Record<string, Contact[]> = {
  ledgerly: [
    {
      person: "Kabir Shah",
      knows: "Ananya Rao",
      how: "Introduced by the CFO of a portfolio company",
      sample: true,
      touches: [
        { date: "2026-08-20", kind: "Email", what: "Intro email" },
        { date: "2026-09-03", kind: "Meeting", what: "Coffee in Pune" },
        { date: "2026-10-12", kind: "Email", what: "Asked when the round opens" },
      ],
    },
    {
      person: "Riya Menon",
      knows: "Ananya Rao",
      how: "Received the deck",
      sample: true,
      touches: [{ date: "2026-10-27", kind: "Email", what: "Confirmed the deck arrived" }],
    },
  ],
};

/** For portfolio companies, contacts come from what happened in the hub, not from samples. */
export function portfolioContacts(c: PortfolioCompany, today: string): Contact[] {
  const ceo = c.founders[0]?.name ?? "the founders";
  const touchesFor = (person: string): Touch[] => {
    const t: Touch[] = c.notes.filter((n) => n.author === person).map((n) => ({ date: n.date, kind: "Note", what: "Note to the founder" }));
    if (person === c.owner) {
      for (const r of c.reports) {
        if (r.acknowledgedAt) t.push({ date: r.acknowledgedAt, kind: "Reply", what: `Read the ${fmtMonth(r.month)} report` });
        if (r.question) t.push({ date: r.question.askedAt, kind: "Question", what: "Question on a report" });
      }
      for (const a of c.asks) if (a.answeredAt) t.push({ date: a.answeredAt, kind: "Reply", what: `Answered: ${a.topic}` });
    }
    if (person === c.partner) t.push({ date: c.pitch.meetingAt, kind: "Meeting", what: "First meeting" });
    return t.filter((x) => x.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  };
  return [c.partner, c.owner]
    .filter((p, i, all) => all.indexOf(p) === i)
    .map((person) => ({
      person,
      knows: ceo,
      how: person === c.partner ? "Partner on the investment" : "Looks after the company",
      sample: false,
      touches: touchesFor(person),
    }));
}
