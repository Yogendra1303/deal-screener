// The diligence checklist a partner runs on every pitch, filled in by code from the record.
// Questions follow common early-stage practice (YC-style application questions and standard
// seed and Series A request lists). Nothing here is decided by AI: a line is Done only when
// a second source agrees, and every open line turns into a request to the founder.
import { dealFacts, type FactStatus, type KeyFact } from "./provenance";
import type { DealResult } from "./types";

export type DDStatus = "Done" | "Claimed" | "Conflict" | "Ask founder" | "Later";

export const DD_MEANING: Record<DDStatus, string> = {
  Done: "Backed by a second source, or the founder's own data sheet",
  Claimed: "Only the deck says it. Ask for proof",
  Conflict: "Two sources disagree. Settle before deciding",
  "Ask founder": "Not received. Goes on the request list",
  Later: "Not expected at this stage. Ask before a term sheet",
};

export interface DDItem {
  id: string;
  question: string; // what the partner wants to know
  why: string; // why it matters, in a partner's words
  request: string; // what to ask the founder for
  status: DDStatus;
  found?: string; // what the record already holds, with its source
  fact?: string; // key of a KeyFact to open in the evidence panel
}

export interface DDSection {
  key: string;
  title: string;
  items: DDItem[];
}

const FROM_FACT: Record<FactStatus, DDStatus> = { Checked: "Done", Reported: "Done", Claimed: "Claimed", Conflict: "Conflict", Missing: "Ask founder" };

const LATE_STAGE = new Set(["Series A", "Series B", "Series C"]);
const REGULATED = /fintech|health|insur|lending|pay/i;

export function diligence(deal: DealResult): DDSection[] {
  const facts = dealFacts(deal);
  const f = (key: string) => facts.find((x) => x.key === key);
  const fromFact = (key: string, base: Omit<DDItem, "status" | "found" | "fact">): DDItem => {
    const k: KeyFact | undefined = f(key);
    if (!k) return { ...base, status: "Ask founder" };
    return {
      ...base,
      status: FROM_FACT[k.status],
      found: k.status === "Missing" ? undefined : `${k.value}${k.sub ? ` (${k.sub})` : ""} · ${k.evidence.map((e) => e.source).join(", ")}`,
      fact: key,
    };
  };
  const r = deal.record;
  const late = LATE_STAGE.has(deal.form.stage);
  const checks = deal.ai.founderChecks;
  const teamStatus: DDStatus = !r.team.length ? "Ask founder" : checks.some((c) => c.verdict === "conflict") ? "Conflict" : checks.length && checks.every((c) => c.verdict === "match") ? "Done" : "Claimed";

  return [
    {
      key: "team",
      title: "Founders and team",
      items: [
        {
          id: "founders",
          question: "Who are the founders, and have they done this before?",
          why: "At seed the team is most of the bet. Past roles should match their public profiles.",
          request: "LinkedIn profiles and a short note on what each founder did before",
          status: teamStatus,
          found: r.team.length ? `${r.team.map((t) => `${t.name}${t.role ? `, ${t.role}` : ""}`).join("; ")} · deck${checks.length ? ", profiles (sample)" : ""}` : undefined,
        },
        {
          id: "equity",
          question: "Are the founders full-time, and how is equity split and vested?",
          why: "Founders under about 50% at seed, or with no vesting, make later rounds harder.",
          request: "Cap table with every holder, plus founder vesting terms",
          status: "Ask founder",
        },
        fromFact("team", {
          id: "team-size",
          question: "How big is the team, and who are the next key hires?",
          why: "Shows whether the plan for the money is realistic.",
          request: "Org chart and the hiring plan for the next 12 months",
        }),
      ],
    },
    {
      key: "market",
      title: "Product and market",
      items: [
        {
          id: "what",
          question: "What does it do, for whom, and why do they pay?",
          why: "If the partner can't say it in one sentence, the pitch isn't clear yet.",
          request: "A 2-minute product demo video or a live demo",
          status: r.oneLiner ? "Claimed" : "Ask founder",
          found: r.oneLiner ? `${r.oneLiner} · deck` : undefined,
        },
        {
          id: "size",
          question: "How big can this get, counted bottom-up?",
          why: "Top-down market sizes are almost always too big. Count buyers times price.",
          request: "Their own bottom-up market sizing: number of buyers, price, share",
          status: deal.research?.marketSize.low != null ? "Done" : r.market.sizeClaim.amount != null ? "Claimed" : "Ask founder",
          found:
            deal.research?.marketSize.low != null
              ? `AI research: ${deal.research.marketSize.whatItCounts}`
              : r.market.sizeClaim.amount != null
                ? `${r.market.sizeClaim.currency ?? ""} ${r.market.sizeClaim.amount.toLocaleString("en-IN")} · deck`
                : undefined,
        },
        {
          id: "competition",
          question: "Who else does this, and why will this team win?",
          why: "A deck that names no competitors usually hasn't looked.",
          request: "Their view of the top 3 competitors and why customers switch to them",
          status: deal.research?.competitors.length ? "Done" : r.market.competitors.length ? "Claimed" : "Ask founder",
          found: deal.research?.competitors.length
            ? `${deal.research.competitors.length} found by AI web research`
            : r.market.competitors.length
              ? `${r.market.competitors.map((c) => c.name).join(", ")} · deck`
              : undefined,
        },
        {
          id: "why-now",
          question: "Why now? What changed that makes this possible today?",
          why: "Timing explains why bigger companies haven't done it already.",
          request: "Ask on the first call",
          status: "Ask founder",
        },
      ],
    },
    {
      key: "traction",
      title: "Traction and revenue quality",
      items: [
        fromFact("revenue", {
          id: "revenue",
          question: "Is the revenue real and recurring?",
          why: "Deck revenue often includes one-offs or annualises a single good month.",
          request: "Monthly revenue for the last 12 months, and 6 months of bank statements",
        }),
        fromFact("growth", {
          id: "growth",
          question: "How fast is it growing, month on month?",
          why: "Seed companies are expected to grow 10% or more a month.",
          request: "Monthly revenue and customers sheet, 12 months",
        }),
        fromFact("customers", {
          id: "customers",
          question: "How many paying customers, and who are the biggest?",
          why: "Paying, not pilots or free users.",
          request: "Customer list with monthly revenue per customer",
        }),
        fromFact("concentration", {
          id: "concentration",
          question: "How much revenue comes from the top 3 customers?",
          why: "Above 40% from three customers, losing one could sink the company.",
          request: "Revenue by customer for the last 6 months",
        }),
        fromFact("retention", {
          id: "retention",
          question: "Do customers stay and spend more?",
          why: "Net revenue retention above 100% means growth without new sales.",
          request: "Cohort table: revenue by month of first purchase",
        }),
        fromFact("margin", {
          id: "margin",
          question: "What is the gross margin?",
          why: "Software should be above 70%. Low margins limit what growth is worth.",
          request: "Profit and loss statement, monthly, last 12 months",
        }),
        {
          id: "unit",
          question: "What does a customer cost to win, and how fast is that paid back?",
          why: "Payback over 18 months means growth burns a lot of cash.",
          request: "Sales and marketing spend by month, and new customers by month",
          status: "Ask founder",
        },
      ],
    },
    {
      key: "money",
      title: "Cash and the round",
      items: [
        fromFact("burn", {
          id: "burn",
          question: "How much cash goes out each month?",
          why: "Net burn sets the runway and how much the round really buys.",
          request: "Monthly profit and loss and cash flow, last 12 months",
        }),
        fromFact("runway", {
          id: "runway",
          question: "How long does the cash last today?",
          why: "Under 6 months, the founder may take any terms.",
          request: "Latest bank balance and the burn plan",
        }),
        fromFact("round", {
          id: "round",
          question: "How much are they raising, and on what instrument?",
          why: "The deck and the form should agree.",
          request: "Term sheet or SAFE draft, if one exists",
        }),
        fromFact("valuation", {
          id: "valuation",
          question: "At what valuation or cap?",
          why: "Without it the fund can't size its cheque or its ownership.",
          request: "Valuation or cap they expect, and any offers in hand",
        }),
        {
          id: "use",
          question: "What will the money buy, and what milestone does it reach?",
          why: "The next round needs a clear milestone, usually 18 to 24 months away.",
          request: "Use of funds and an 18 to 24 month plan with the milestone for the next raise",
          status: r.round.useOfFunds.value ? "Claimed" : "Ask founder",
          found: r.round.useOfFunds.value ? `${r.round.useOfFunds.value} · deck` : undefined,
        },
        {
          id: "prior",
          question: "Who has invested before, and on what terms?",
          why: "Earlier terms, like a low cap or special rights, carry into this round.",
          request: "List of past rounds with investors, amounts and instruments",
          status: r.round.priorFunding.value ? "Claimed" : "Ask founder",
          found: r.round.priorFunding.value ? `${r.round.priorFunding.value} · deck` : undefined,
        },
      ],
    },
    {
      key: "legal",
      title: "Legal and compliance",
      items: [
        fromFact("founded", {
          id: "incorporation",
          question: "Is the company registered as the deck says?",
          why: "Name, date and directors should match the company registry.",
          request: "Certificate of incorporation and list of directors",
        }),
        {
          id: "ip",
          question: "Does the company own its code, brand and IP?",
          why: "Founders and contractors must have assigned their work to the company.",
          request: "IP assignment agreements for founders and key contractors",
          status: late ? "Ask founder" : "Later",
        },
        {
          id: "licence",
          question: "Does the business need a licence to operate?",
          why: "Payments, lending and health often need a regulator's approval.",
          request: "Licences held or applied for, and any letters from regulators",
          status: REGULATED.test(deal.form.sector) ? "Ask founder" : "Later",
        },
        {
          id: "disputes",
          question: "Any legal cases, unpaid taxes or disputes?",
          why: "A surprise here can stop a closing.",
          request: "Statement of pending litigation and tax filings for the last 2 years",
          status: late ? "Ask founder" : "Later",
        },
      ],
    },
    {
      key: "references",
      title: "References",
      items: [
        {
          id: "customer-refs",
          question: "What do customers say, unprompted?",
          why: "Two or three customer calls tell more than any deck.",
          request: "3 customers the fund can call, including one who nearly left",
          status: "Later",
        },
        {
          id: "founder-refs",
          question: "What do people who worked with the founders say?",
          why: "Back-channel references find what the founders won't mention.",
          request: "Done by the fund through its own network, not from the founder's list",
          status: "Later",
        },
      ],
    },
  ];
}

export function ddCounts(sections: DDSection[]) {
  const all = sections.flatMap((s) => s.items);
  const by = (st: DDStatus) => all.filter((i) => i.status === st).length;
  return { total: all.length, done: by("Done"), claimed: by("Claimed"), conflict: by("Conflict"), ask: by("Ask founder"), later: by("Later") };
}

/** A plain request the analyst can send the founder: every open line, grouped. */
export function requestText(deal: DealResult, sections: DDSection[], from: string): string {
  const lines: string[] = [];
  for (const s of sections) {
    const open = s.items.filter((i) => (i.status === "Ask founder" || i.status === "Claimed" || i.status === "Conflict") && !/^(Ask on|Done by the fund)/.test(i.request));
    if (!open.length) continue;
    lines.push(`${s.title}:`);
    for (const i of open) lines.push(`- ${i.request}${i.status === "Conflict" ? " (two of your documents show different figures; which is right?)" : ""}`);
    lines.push("");
  }
  const first = deal.form.founders[0]?.name.split(" ")[0] ?? "there";
  return `Hi ${first},\n\nThanks for sending ${deal.form.companyName}'s deck. To take this further, could you share the following? A shared folder is fine.\n\n${lines.join("\n")}\nThanks,\n${from}`;
}
