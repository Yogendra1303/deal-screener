// Which data the workspace shows. FULL_90: the whole 6-month sample. TEST_10: only the 10 test decks.
// ZERO: no sample data at all, only pitches uploaded in this browser. Nothing is deleted; the mode only hides.
import { SAMPLES, SEED_RESULTS } from "./data";
import { FLOW } from "./flow";
import { SEED_INBOUND } from "./links";

export type WorkspaceMode = "FULL_90" | "TEST_10" | "ZERO";
export const MODES: WorkspaceMode[] = ["FULL_90", "TEST_10", "ZERO"];
export const MODE_KEY = "fundhub.workspaceMode";

const TEST = new Set([...SAMPLES.map((s) => s.id), ...Object.keys(SEED_RESULTS)]);
const HISTORY = new Set(FLOW.map((c) => c.id));
const SEEDED = new Set([...TEST, ...HISTORY, ...SEED_INBOUND.map((i) => i.id)]);

/** True for a pitch someone added in this browser, not part of the sample data. */
export const isUploaded = (id: string) => !SEEDED.has(id);
export const isTestDeck = (id: string) => TEST.has(id);
export const isHistory = (id: string) => HISTORY.has(id);

/** Whether a deal shows in the given mode. Uploaded pitches show in every mode. */
export function visibleIn(mode: WorkspaceMode, id: string): boolean {
  if (mode === "FULL_90" || isUploaded(id)) return true;
  if (mode === "TEST_10") return TEST.has(id);
  return false;
}

export const MODE_TEXT: Record<WorkspaceMode, { name: string; short: string; help: string }> = {
  FULL_90: { name: "Full demo data", short: "Full sample", help: "The 6-month sample: about 90 decks, with the 10 test decks and 80 archived ones." },
  TEST_10: { name: "10 test decks only", short: "10 test decks", help: "Only the 10 test decks, each with a real PDF and, for most, a monthly CSV. The 80 archived decks are hidden." },
  ZERO: { name: "Empty workspace", short: "Empty", help: "No sample data. Only pitches you upload in this browser show, so you can build the pipeline from zero." },
};
