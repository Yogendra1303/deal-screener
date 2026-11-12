// Questions between partner and analyst, pinned to a company and often to one number.
// Each has an owner and a due date; an answer must say where it came from. Fictional samples.
import { daysBetween } from "./portfolio/health";

export interface Answer {
  text: string;
  source: string;
  by: string;
  at: string; // YYYY-MM-DD
}

export interface Question {
  id: string;
  companyId: string;
  companyName: string;
  side: "deal" | "portfolio";
  /** The number it is about, matching a KeyFact key, if any. */
  about?: { key: string; label: string };
  text: string;
  askedBy: string;
  owner: string;
  askedAt: string; // YYYY-MM-DD
  due: string; // YYYY-MM-DD
  answer?: Answer;
}

export type QuestionState = "Answered" | "Overdue" | "Open";

export function stateOf(q: Question, today: string): QuestionState {
  if (q.answer) return "Answered";
  return q.due < today ? "Overdue" : "Open";
}

export function ageText(q: Question, today: string): string {
  if (q.answer) {
    const d = daysBetween(q.askedAt, q.answer.at);
    return d === 0 ? "answered the same day" : `answered in ${d} ${d === 1 ? "day" : "days"}`;
  }
  const late = daysBetween(q.due, today);
  if (late > 0) return `${late} ${late === 1 ? "day" : "days"} overdue`;
  const left = -late;
  return left === 0 ? "due today" : `due in ${left} ${left === 1 ? "day" : "days"}`;
}

export const SEED_QUESTIONS: Question[] = [
  {
    id: "q-ledgerly-arr",
    companyId: "ledgerly",
    companyName: "Ledgerly",
    side: "deal",
    about: { key: "revenue", label: "Revenue" },
    text: "The deck says ₹7.5 Cr ARR; their own sheet supports about ₹5.76 Cr. Which is real? Ask Ananya how ARR is worked out before we meet.",
    askedBy: "Kabir Shah",
    owner: "Riya Menon",
    askedAt: "2026-10-28",
    due: "2026-10-31",
  },
  {
    id: "q-ledgerly-top",
    companyId: "ledgerly",
    companyName: "Ledgerly",
    side: "deal",
    about: { key: "concentration", label: "Top customer share" },
    text: "What share of revenue comes from the top three customers? It isn't in the deck.",
    askedBy: "Kabir Shah",
    owner: "Riya Menon",
    askedAt: "2026-10-28",
    due: "2026-11-02",
  },
  {
    id: "q-ledgerly-cap",
    companyId: "ledgerly",
    companyName: "Ledgerly",
    side: "deal",
    about: { key: "valuation", label: "Valuation or cap" },
    text: "The SAFE has no cap in the deck. What cap would we accept at this stage?",
    askedBy: "Riya Menon",
    owner: "Kabir Shah",
    askedAt: "2026-10-28",
    due: "2026-11-04",
  },
  {
    id: "q-voltnest-sep",
    companyId: "voltnest",
    companyName: "Voltnest",
    side: "portfolio",
    about: { key: "revenue", label: "Revenue (month)" },
    text: "September revenue: the founder typed ₹76 L, page 2 of the MIS shows ₹69 L. Which is right?",
    askedBy: "Kabir Shah",
    owner: "Riya Menon",
    askedAt: "2026-10-14",
    due: "2026-10-21",
  },
  {
    id: "q-mandiwise-plan",
    companyId: "mandiwise",
    companyName: "Mandiwise",
    side: "portfolio",
    about: { key: "plan", label: "Against the deck's plan" },
    text: "September is 33% below the plan in their deck. Is there a revised plan we can hold them to?",
    askedBy: "Kabir Shah",
    owner: "Arjun Bhat",
    askedAt: "2026-10-21",
    due: "2026-11-04",
  },
  {
    id: "q-sehatflow-runway",
    companyId: "sehatflow",
    companyName: "Sehatflow",
    side: "portfolio",
    about: { key: "runway", label: "Runway" },
    text: "Runway was under six months at July's burn and they've gone quiet. Do they have a bridge plan?",
    askedBy: "Kabir Shah",
    owner: "Riya Menon",
    askedAt: "2026-10-02",
    due: "2026-10-16",
  },
  {
    id: "q-brightcart-sep",
    companyId: "brightcart",
    companyName: "Brightcart",
    side: "portfolio",
    about: { key: "revenue", label: "Revenue (month)" },
    text: "Revenue jumped 23% in September. One new brand, or growth across customers?",
    askedBy: "Kabir Shah",
    owner: "Arjun Bhat",
    askedAt: "2026-10-27",
    due: "2026-11-03",
  },
  {
    id: "q-kitebay-plan",
    companyId: "kitebay",
    companyName: "Kitebay",
    side: "portfolio",
    about: { key: "plan", label: "Against the deck's plan" },
    text: "They're ahead of plan. Is the beat coming from one big customer?",
    askedBy: "Kabir Shah",
    owner: "Riya Menon",
    askedAt: "2026-09-20",
    due: "2026-09-27",
    answer: {
      text: "No. The returns module drove it across many brands; the largest customer is 11% of revenue.",
      source: "Kitebay Q2 board deck, page 6 (sample file)",
      by: "Riya Menon",
      at: "2026-09-25",
    },
  },
];
