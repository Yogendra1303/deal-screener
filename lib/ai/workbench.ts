// The account bridge. The same three AI jobs the API runs (read the deck, score it, research the market)
// as prompts a person copies into Claude.ai or ChatGPT on their own subscription, and parsers that take
// the JSON back, validate it against the app's schemas and run the same code checks, scores and band.
// Code still does every sum; the AI only reads and judges. Nothing here needs an API key.
import { z } from "zod";
import { AssessmentSchema, DealRecordSchema, DealRecordWireSchema, ResearchSchema, toRecord, type Assessment, type DealRecord, type Research } from "../schema";
import { ASSESS_SYSTEM, EXTRACT_SYSTEM, RESEARCH_SYSTEM, assessContext, researchBrief } from "../prompts";
import { checkStage, finishDeal } from "../pipeline";
import { findProfiles, findRegistry } from "../fixtures";
import type { DealResult, FormInput, SheetRow } from "../types";

export const BRIDGE_TOOLS = {
  claude: { name: "Claude.ai", url: "https://claude.ai/new", model: "claude.ai (own account)" },
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/", model: "chatgpt.com (own account)" },
} as const;
export type BridgeTool = keyof typeof BRIDGE_TOOLS;

function schemaText(schema: z.ZodType): string {
  const j = z.toJSONSchema(schema) as Record<string, unknown>;
  delete j.$schema;
  return JSON.stringify(j, null, 1);
}

const OUTPUT_RULES = `Answer with one JSON object only: no words before or after it, no markdown fence. It must validate against this JSON schema exactly (every key present, no extra keys):`;

/** Step 1 of reading a deck: the person attaches the PDF and pastes this. The answer is the standard deal record. */
export function buildExtractionPrompt(a: { form: FormInput; sheet: SheetRow[] | null; fileName: string }): string {
  return [
    EXTRACT_SYSTEM,
    "",
    `The pitch deck is the attached PDF (${a.fileName}). Fill the standard deal record from it.`,
    "",
    "What the founder entered on the intake form (for context only; record what the deck states, not the form):",
    JSON.stringify(a.form, null, 1),
    a.sheet?.length ? `\nThe founder also sent a monthly sheet (${a.sheet.length} months, ${a.sheet[0].month} to ${a.sheet[a.sheet.length - 1].month}). Do not copy its numbers into the record; code compares the two afterwards.` : "",
    "",
    OUTPUT_RULES,
    schemaText(DealRecordWireSchema),
  ].join("\n");
}

/** Step 2: code has run its checks on the record; the AI judges traction and team and writes questions. */
export function buildAssessmentPrompt(a: { record: DealRecord; form: FormInput; sheet: SheetRow[] | null }): string {
  const { registry, profiles, flags } = checkStage({ record: a.record, form: a.form, sheet: a.sheet });
  const context = assessContext({ record: a.record, form: a.form, flags, sheet: a.sheet, registry, profiles });
  return [ASSESS_SYSTEM, "", "Assess this deal.", "", JSON.stringify(context, null, 1), "", OUTPUT_RULES, schemaText(AssessmentSchema)].join("\n");
}

/** The research pack: competitors, a bottom-up market size and red flags, from live web search in the chat. */
export function buildResearchPrompt(a: { form: FormInput; record: DealRecord }): string {
  return [
    RESEARCH_SYSTEM.replace("When finished, call submit_research exactly once.", "Use web search. When finished, answer with the JSON below."),
    "",
    "Research this company.",
    "",
    JSON.stringify(researchBrief(a.form, a.record), null, 1),
    "",
    OUTPUT_RULES,
    schemaText(ResearchSchema),
  ].join("\n");
}

/** Takes the JSON out of whatever was pasted: fences, a sentence before it, trailing text. */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object found in what was pasted.");
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(`The JSON doesn't parse: ${(e as Error).message}`);
  }
}

function issues(err: z.ZodError): string {
  return err.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/** A pasted deal record, in the wire shape the prompt asks for or the stored shape the app keeps. */
export function parseRecordJson(text: string): DealRecord {
  const raw = extractJson(text) as Record<string, unknown>;
  const inner = raw && typeof raw === "object" && "record" in raw ? (raw.record as unknown) : raw;
  const wire = DealRecordWireSchema.safeParse(inner);
  if (wire.success) return toRecord(wire.data);
  const stored = DealRecordSchema.safeParse(inner);
  if (stored.success) return stored.data;
  throw new Error(`The deal record doesn't match the format: ${issues(wire.error)}`);
}

export function parseAssessmentJson(text: string): Assessment {
  const raw = extractJson(text) as Record<string, unknown>;
  const inner = raw && typeof raw === "object" && "assessment" in raw ? (raw.assessment as unknown) : raw;
  const r = AssessmentSchema.safeParse(inner);
  if (!r.success) throw new Error(`The assessment doesn't match the format: ${issues(r.error)}`);
  return r.data;
}

export function parseResearchJson(text: string): Research {
  const raw = extractJson(text) as Record<string, unknown>;
  const inner = raw && typeof raw === "object" && "research" in raw ? (raw.research as unknown) : raw;
  const r = ResearchSchema.safeParse(inner);
  if (!r.success) throw new Error(`The research pack doesn't match the format: ${issues(r.error)}`);
  return r.data;
}

/** One paste that holds both the record and the assessment skips step 2. */
export function parseBothJson(text: string): { record: DealRecord; assessment: Assessment | null } {
  const raw = extractJson(text) as Record<string, unknown>;
  const record = parseRecordJson(JSON.stringify(raw && "record" in raw ? raw.record : raw));
  const assessment = raw && typeof raw === "object" && "assessment" in raw ? parseAssessmentJson(JSON.stringify(raw.assessment)) : null;
  return { record, assessment };
}

export interface ExtractionInput {
  id: string;
  source: DealResult["source"];
  receivedAt: string;
  form: FormInput;
  fileName: string;
  deckUrl: string | null;
  sheet: SheetRow[] | null;
  record: DealRecord;
  assessment: Assessment;
  /** Which account read it, for the audit trail. */
  tool: BridgeTool;
  research?: Research | null;
}

/** The same code path as the API run: checks, founder conflicts, scores and band. Marked as read in chat. */
export function applyExtraction(a: ExtractionInput): DealResult {
  const t = Date.now();
  const { registry, profiles, flags } = checkStage({ record: a.record, form: a.form, sheet: a.sheet });
  const checksMs = Date.now() - t;
  return finishDeal({
    id: a.id,
    source: a.source,
    receivedAt: a.receivedAt,
    form: a.form,
    fileName: a.fileName,
    deckUrl: a.deckUrl,
    record: a.record,
    sheet: a.sheet,
    registry,
    profiles,
    flags,
    assessment: a.assessment,
    model: BRIDGE_TOOLS[a.tool].model,
    processedBy: "chat",
    research: a.research ?? null,
    runLog: [
      { step: "Read the deck", ms: 0 },
      { step: "Number and registry checks", ms: checksMs },
      { step: "Score and write questions", ms: 0 },
      { step: "Scores and band", ms: 0 },
    ],
  });
}

/** The registry and profile fixtures a deck will be checked against, so the modal can say what code will compare. */
export function fixturesFor(form: FormInput) {
  return { registry: findRegistry(form.companyName), profiles: findProfiles(form.founders.map((f) => f.name)) };
}
