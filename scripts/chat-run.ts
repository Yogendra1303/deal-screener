// Screens sample decks without an API key: a person runs the AI steps in a Claude chat on their
// own account, saves the AI's answers as JSON, and this script runs the same code checks, scores
// and bands as the live app. Results are marked "screened in chat" (no time or cost measured).
//
//   npm run chat-run -- context ledgerly   print what the AI sees for the assessment step
//                                          (needs data/chat-run/ledgerly.record.json)
//   npm run chat-run -- build              validate the chat answers and write data/sample-results.json
//
// Files in data/chat-run/ for each deck:
//   <id>.record.json      the standard deal record (lib/schema.ts DealRecordSchema), read from the PDF
//                         following the rules in lib/extract.ts
//   <id>.assessment.json  traction and team judgement, founder checks, questions (AssessmentSchema),
//                         following the rules in lib/assess.ts
//   <id>.research.json    optional: top companies in the same space, market size, red flags (ResearchSchema)
//
// Any other deck (one you downloaded, not one of the 10 samples) also needs:
//   <id>.form.json        { "receivedAt": ISO date, "deckFile": "<id>.pdf", "sheetFile": null, "form": FormInput }
// with the PDF at public/decks/<deckFile>. Steps: docs/screen-a-deck.md
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AssessmentSchema, DealRecordSchema, ResearchSchema } from "../lib/schema";
import { checkStage, finishDeal } from "../lib/pipeline";
import { assessContext, ASSESS_SYSTEM } from "../lib/prompts";
import { parseSheet } from "../lib/sheet";
import { SAMPLES, type SampleEntry } from "../lib/data";
import { evaluate } from "../lib/evaluate";
import type { DealResult } from "../lib/types";

const root = process.cwd();
const dir = path.join(root, "data", "chat-run");
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

/** A built-in sample deck, or any other deck described by data/chat-run/<id>.form.json. */
function entryFor(id: string): { sample: SampleEntry; folder: "samples" | "decks" } {
  const sample = SAMPLES.find((s) => s.id === id);
  if (sample) return { sample, folder: "samples" };
  const formFile = path.join(dir, `${id}.form.json`);
  if (!existsSync(formFile)) throw new Error(`No sample deck called "${id}", and no ${id}.form.json in data/chat-run.`);
  const f = readJson(formFile);
  return { sample: { id, receivedAt: f.receivedAt, form: f.form, deckFile: f.deckFile, sheetFile: f.sheetFile ?? null }, folder: "decks" };
}

function loadSample(id: string) {
  const { sample, folder } = entryFor(id);
  const sheet = sample.sheetFile
    ? parseSheet(readFileSync(path.join(root, "public", folder, sample.sheetFile), "utf8"))
    : null;
  const record = DealRecordSchema.parse(readJson(path.join(dir, `${id}.record.json`)));
  return { sample, sheet, record, folder };
}

function context(id: string) {
  const { sample, sheet, record } = loadSample(id);
  const { registry, profiles, flags } = checkStage({ record, form: sample.form, sheet });
  console.log(ASSESS_SYSTEM);
  console.log("\nAssess this deal.\n");
  console.log(JSON.stringify(assessContext({ record, form: sample.form, flags, sheet, registry, profiles }), null, 1));
}

function build() {
  const outFile = path.join(root, "data", "sample-results.json");
  const results: Record<string, DealResult> = readJson(outFile);
  const extra = readdirSync(dir)
    .filter((f) => f.endsWith(".form.json"))
    .map((f) => f.replace(/\.form\.json$/, ""))
    .filter((id) => !SAMPLES.some((s) => s.id === id));
  for (const id of [...SAMPLES.map((s) => s.id), ...extra]) {
    const files = ["record", "assessment"].map((k) => path.join(dir, `${id}.${k}.json`));
    if (!files.every(existsSync)) continue;
    const { sample, sheet, record, folder } = loadSample(id);
    const assessment = AssessmentSchema.parse(readJson(files[1]));
    const researchFile = path.join(dir, `${id}.research.json`);
    const research = existsSync(researchFile) ? ResearchSchema.parse(readJson(researchFile)) : null;
    const { registry, profiles, flags } = checkStage({ record, form: sample.form, sheet });
    results[id] = finishDeal({
      id,
      source: folder === "samples" ? "sample" : "upload",
      receivedAt: sample.receivedAt,
      form: sample.form,
      fileName: sample.deckFile,
      deckUrl: `/${folder}/${sample.deckFile}`,
      record,
      sheet,
      registry,
      profiles,
      flags,
      assessment,
      research,
      model: "Claude, in a chat on this account (no API key)",
      processedBy: "chat",
      runLog: [],
    });
    console.log(`${id}: ${results[id].band}, ${results[id].flags.length} flag(s)`);
  }
  writeFileSync(outFile, JSON.stringify(results, null, 1) + "\n");
  const ev = evaluate(Object.values(results));
  console.log(`\nPlanted issues caught: ${ev.caught} of ${ev.planted}. False alarms: ${ev.falseAlarms}.`);
  console.log(`Numbers read right: ${ev.factsRight} of ${ev.factsTotal}. Bands as expected: ${ev.bandMatches} of ${ev.processed}.`);
}

const [cmd, id] = process.argv.slice(2);
if (cmd === "context" && id) context(id);
else if (cmd === "build") build();
else console.log("Use: npm run chat-run -- context <deck id>   or   npm run chat-run -- build");
