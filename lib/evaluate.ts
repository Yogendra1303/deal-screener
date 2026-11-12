// Scores the screener against the planted answer key. Used by the Results page and the sample script.
import { ANSWER_KEY } from "./data";
import { DEFAULT_RULES, rescore } from "./rules";
import { compareWithGold } from "./gold";
import type { Band, CheckId, DealResult } from "./types";

export interface DeckEvaluation {
  id: string;
  planted: string;
  processed: boolean;
  expected: CheckId[];
  found: CheckId[];
  caught: CheckId[];
  missed: CheckId[];
  falseAlarms: CheckId[];
  expectedBand: Band;
  band: Band | null;
  seconds: number | null;
  costUsd: number | null;
  factsRight: number;
  factsTotal: number;
  factErrors: { field: string; expected: string; got: string }[];
  byChat?: boolean;
}

export interface Evaluation {
  decks: DeckEvaluation[];
  processed: number;
  planted: number;
  caught: number;
  missed: number;
  falseAlarms: number;
  bandMatches: number;
  avgSeconds: number | null;
  avgCostUsd: number | null;
  factsRight: number;
  factsTotal: number;
  byChat: number;
}

const SCREENING_STEPS = ["Read the deck", "Number and registry checks", "Score and write questions", "Scores and band"];

export function evaluate(deals: DealResult[]): Evaluation {
  const decks: DeckEvaluation[] = Object.entries(ANSWER_KEY).map(([id, key]) => {
    const raw = deals.find((d) => d.id === id);
    if (!raw) {
      return {
        id, planted: key.planted, processed: false, expected: key.issues, found: [], caught: [], missed: key.issues,
        falseAlarms: [], expectedBand: key.band, band: null, seconds: null, costUsd: null,
        factsRight: 0, factsTotal: 0, factErrors: [],
      };
    }
    const deal = rescore(raw, DEFAULT_RULES); // judge bands against the sample rules, not edited ones
    const found = [...new Set(deal.flags.map((f) => f.checkId))];
    const steps = deal.runLog.filter((s) => SCREENING_STEPS.includes(s.step));
    const facts = compareWithGold(deal.record, key.gold);
    return {
      id,
      planted: key.planted,
      processed: true,
      expected: key.issues,
      found,
      caught: key.issues.filter((c) => found.includes(c)),
      missed: key.issues.filter((c) => !found.includes(c)),
      falseAlarms: found.filter((c) => !key.issues.includes(c)),
      expectedBand: key.band,
      band: deal.band,
      seconds: deal.processedBy === "chat" ? null : steps.reduce((a, s) => a + s.ms, 0) / 1000,
      costUsd: deal.processedBy === "chat" ? null : steps.reduce((a, s) => a + (s.costUsd ?? 0), 0),
      byChat: deal.processedBy === "chat",
      factsRight: facts.filter((f) => f.ok).length,
      factsTotal: facts.length,
      factErrors: facts.filter((f) => !f.ok).map(({ field, expected, got }) => ({ field, expected, got })),
    };
  });
  const done = decks.filter((d) => d.processed);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    decks,
    processed: done.length,
    planted: done.reduce((a, d) => a + d.expected.length, 0),
    caught: done.reduce((a, d) => a + d.caught.length, 0),
    missed: done.reduce((a, d) => a + d.missed.length, 0),
    falseAlarms: done.reduce((a, d) => a + d.falseAlarms.length, 0),
    bandMatches: done.filter((d) => d.band === d.expectedBand).length,
    avgSeconds: avg(done.filter((d) => d.seconds != null).map((d) => d.seconds!)),
    avgCostUsd: avg(done.filter((d) => d.costUsd != null).map((d) => d.costUsd!)),
    byChat: done.filter((d) => d.byChat).length,
    factsRight: done.reduce((a, d) => a + d.factsRight, 0),
    factsTotal: done.reduce((a, d) => a + d.factsTotal, 0),
  };
}
