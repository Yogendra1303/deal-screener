// Static sample data that ships with the app.
import samplesJson from "../data/samples.json";
import seedJson from "../data/sample-results.json";
import answerKeyJson from "../data/answer-key.json";
import type { CheckId, DealResult, FormInput, Band } from "./types";
import type { Gold } from "./gold";

export interface SampleEntry {
  id: string;
  receivedAt: string;
  form: FormInput;
  deckFile: string;
  sheetFile: string | null;
}

export const SAMPLES = samplesJson as SampleEntry[];
export const SEED_RESULTS = seedJson as unknown as Record<string, DealResult>;
export const ANSWER_KEY = answerKeyJson as Record<string, { issues: CheckId[]; band: Band; planted: string; gold: Gold }>;

export function sampleById(id: string): SampleEntry | undefined {
  return SAMPLES.find((s) => s.id === id);
}
