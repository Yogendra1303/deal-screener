// Tests the parts that make Fund Hub a working app rather than a static demo: the server store and its
// projections, the CSV figures, and the account bridge (prompt out, JSON in, the same checks and band as
// an API run). Code only, no AI and no network. Run with `npm test`.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The file driver writes under these, so point them at a throwaway folder before anything imports it.
const tmp = mkdtempSync(path.join(tmpdir(), "fundhub-test-"));
process.env.FUNDHUB_DB_FILE = path.join(tmp, "runtime-db.json");
process.env.FUNDHUB_FILES_DIR = path.join(tmp, "files");
delete process.env.NEXT_PUBLIC_SUPABASE_URL;

import { SAMPLES, SEED_RESULTS } from "../lib/data";
import { parseCsv, summariseSheet } from "../lib/csv-parser";
import { applyExtraction, buildAssessmentPrompt, buildExtractionPrompt, buildResearchPrompt, extractJson, parseAssessmentJson, parseRecordJson, parseResearchJson } from "../lib/ai/workbench";
import { STATE_KEYS, baseRow, historicalRows, projectState } from "../lib/db/project";
import { clearState, driver, getSettings, getState, listDeals, listFiles, listSignals, mergeDeals, putFile, putState } from "../lib/db/repository";
import { AssessmentSchema, DealRecordSchema } from "../lib/schema";
import { readFileSync } from "node:fs";
import type { DealResult } from "../lib/types";

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed++;
}

// ---------- The monthly CSV ----------

const csv = `month,currency,revenue,customers,headcount,net_burn,cash
2026-04,USD,40000,70,18,30000,600000
2026-05,USD,43000,74,19,31000,569000
2026-06,USD,45000,78,19,31000,538000
2026-07,USD,48000,83,20,32000,506000
2026-08,USD,52000,88,21,33000,473000
2026-09,USD,56000,92,22,34000,439000`;

{
  const { rows, summary } = parseCsv(csv);
  check("csv: every month is read", rows.length === 6 && summary.months === 6 && summary.from === "2026-04" && summary.to === "2026-09");
  check("csv: MRR is the latest month's revenue", summary.mrr === 56000);
  check("csv: ARR is MRR times twelve, never a deck claim", summary.impliedArr === 672000);
  check("csv: month-on-month growth is the last two months", summary.momGrowthPct === 7.7, String(summary.momGrowthPct));
  check("csv: average growth is compounded over the window", summary.avgGrowthPct != null && Math.abs(summary.avgGrowthPct - 6.9) < 0.2, String(summary.avgGrowthPct));
  check("csv: runway is cash divided by burn", summary.runwayMonths === 12.9, String(summary.runwayMonths));
  check("csv: customers, headcount and cash come from the latest month", summary.customers === 92 && summary.headcount === 22 && summary.cash === 439000);
  const blank = summariseSheet(parseCsv("month,revenue\n2026-09,56000").rows);
  check("csv: a column the founder left out stays blank, never guessed", blank.burn === null && blank.cash === null && blank.runwayMonths === null && blank.momGrowthPct === null);
  let threw = "";
  try {
    parseCsv("foo,bar\n1,2");
  } catch (e) {
    threw = (e as Error).message;
  }
  check("csv: a sheet without month and revenue is refused with a plain message", threw.includes("month"), threw);
}

// ---------- The account bridge ----------

const record = DealRecordSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "data", "chat-run", "ledgerly.record.json"), "utf8")));
const assessment = AssessmentSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "data", "chat-run", "ledgerly.assessment.json"), "utf8")));
const ledgerly = SAMPLES.find((s) => s.id === "ledgerly")!;
const sheet = parseCsv(readFileSync(path.join(process.cwd(), "public", "samples", ledgerly.sheetFile!), "utf8")).rows;

{
  const p = buildExtractionPrompt({ form: ledgerly.form, sheet, fileName: ledgerly.deckFile });
  check("bridge: the extraction prompt carries the rules, the form and the JSON schema", p.includes("Record only what the deck itself states") && p.includes(ledgerly.form.companyName) && p.includes('"oneLiner"'));
  check("bridge: the extraction prompt never asks the model to do the sums", p.includes("Never work one number out from another"));
  const a = buildAssessmentPrompt({ record, form: ledgerly.form, sheet });
  check("bridge: the assessment prompt carries the record, the code checks and the sheet", a.includes("dealRecord") && a.includes("codeChecks") && a.includes("monthlySheet"));
  check("bridge: the assessment prompt forbids school, age and home town", a.includes("Never use school, gender, age, nationality, name, photo or home city"));
  const r = buildResearchPrompt({ form: ledgerly.form, record });
  check("bridge: the research prompt asks for sources and a bottom-up size", r.includes("bottom-up") && r.includes('"sources"'));
}

{
  check("bridge: JSON inside a markdown fence is read", (extractJson('Here you go:\n```json\n{"a":1}\n```') as { a: number }).a === 1);
  check("bridge: JSON with words around it is read", (extractJson('Sure. {"a":2} Hope that helps.') as { a: number }).a === 2);
  let msg = "";
  try {
    extractJson("I could not read the deck.");
  } catch (e) {
    msg = (e as Error).message;
  }
  check("bridge: a chat answer with no JSON is refused", msg.includes("No JSON object"), msg);

  const stored = parseRecordJson(JSON.stringify(record));
  check("bridge: a pasted record keeps every page reference", stored.traction.mrr.page === record.traction.mrr.page && stored.company.name.value === record.company.name.value);
  const wire = {
    ...JSON.parse(JSON.stringify(record)),
  };
  check("bridge: a wrapped { record: … } answer is accepted", parseRecordJson(JSON.stringify({ record: wire })).oneLiner === record.oneLiner);
  let bad = "";
  try {
    parseRecordJson('{"oneLiner": 5}');
  } catch (e) {
    bad = (e as Error).message;
  }
  check("bridge: a record in the wrong shape is refused and says which field", bad.includes("doesn't match the format"), bad);
  let badA = "";
  try {
    parseAssessmentJson(JSON.stringify({ ...assessment, traction: { ...assessment.traction, level: "Brilliant" } }));
  } catch (e) {
    badA = (e as Error).message;
  }
  check("bridge: an invented score level is refused", badA.includes("doesn't match the format"), badA);
  check("bridge: a valid assessment passes", parseAssessmentJson(JSON.stringify(assessment)).founderQuestions.length > 0);
  const research = JSON.parse(readFileSync(path.join(process.cwd(), "data", "chat-run", "ledgerly.research.json"), "utf8")) as unknown;
  check("bridge: a valid research pack passes", parseResearchJson(JSON.stringify(research)).competitors.length > 0);
}

let bridged: DealResult;
{
  bridged = applyExtraction({
    id: "ledgerly",
    source: "sample",
    receivedAt: ledgerly.receivedAt,
    form: ledgerly.form,
    fileName: ledgerly.deckFile,
    deckUrl: `/samples/${ledgerly.deckFile}`,
    sheet,
    record,
    assessment,
    tool: "claude",
  });
  const api = SEED_RESULTS["ledgerly"];
  check("bridge: applying the paste runs the same code checks as the API run", bridged.flags.length === api.flags.length, `${bridged.flags.length} vs ${api.flags.length}`);
  check("bridge: the band is worked out by code, not pasted", bridged.band === api.band, `${bridged.band} vs ${api.band}`);
  check("bridge: all five scores are made", bridged.scores.length === 5 && bridged.scores.every((s) => s.level));
  check("bridge: the run is marked as read in a chat, so the test page won't count it as blind", bridged.processedBy === "chat");
  check("bridge: the deck's own numbers are never rewritten", bridged.record.traction.mrr.amount === record.traction.mrr.amount);
}

// ---------- The server store ----------

async function serverTests() {
  check("db: with no Supabase variables the server keeps a file, so a hosted demo still saves", driver() === "file");

  await putState(STATE_KEYS.statuses, { ledgerly: "Meeting set" });
  const back = await getState<Record<string, string>>(STATE_KEYS.statuses);
  check("db: a store blob comes back exactly as it was saved", back?.ledgerly === "Meeting set");

  await projectState(STATE_KEYS.statuses, { ledgerly: "Meeting set", "fh-0007": "Passed" });
  const deals = await listDeals();
  check("db: a status change becomes a queryable row for every company it touches", deals.length === 2 && deals.every((d) => d.company_name && d.status));
  check("db: the row carries the company's own details, not just its id", Boolean(deals.find((d) => d.id === "ledgerly")?.sector));

  await projectState(STATE_KEYS.signals, {
    ledgerly: [{ id: "s1", kind: "Raised", at: "2026-10-02", text: "Raised a $6M Series A", publisher: "Entrackr", url: "https://example.com", by: "Kabir Shah", loggedAt: "2026-10-03T00:00:00Z" }],
  });
  const sigs = await listSignals("ledgerly");
  check("db: a logged signal becomes a row with its publisher and link", sigs.length === 1 && sigs[0].publisher === "Entrackr" && sigs[0].source_url === "https://example.com");
  await projectState(STATE_KEYS.signals, { ledgerly: [] });
  check("db: removing a signal removes its row", (await listSignals("ledgerly")).length === 0);

  await projectState(STATE_KEYS.mode, "TEST_10");
  await projectState(STATE_KEYS.settings, { aiMode: "ACCOUNT_BRIDGE" });
  const settings = await getSettings();
  check("db: the workspace mode and the AI mode are one row, not one per browser", settings.workspace_mode === "TEST_10" && settings.ai_mode === "ACCOUNT_BRIDGE");

  await putFile("ledgerly", "deck_pdf", "ledgerly.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.4 test"));
  await putFile("ledgerly", "deck_pdf", "ledgerly-v2.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.4 newer"));
  const files = await listFiles("ledgerly");
  check("db: re-uploading a deck replaces the old one instead of piling up", files.length === 1 && files[0].file_name === "ledgerly-v2.pdf");

  await mergeDeals([{ id: "ledgerly", band: "Priority" }]);
  const merged = (await listDeals()).find((d) => d.id === "ledgerly")!;
  check("db: a later save changes only the fields it carries", merged.band === "Priority" && merged.status === "Meeting set");

  check("db: every sample company can be described without opening the app", historicalRows().length > 50 && historicalRows().every((r) => r.company_name));
  check("db: a company the app has never seen still gets a usable row", baseRow("made-up-id").company_name === "made-up-id");

  await clearState();
  check("db: the factory reset empties the blobs and the rows", (await listDeals()).length === 0 && (await getState(STATE_KEYS.statuses)) === undefined);

  console.log(failed ? `\n${failed} failed` : "\nAll passed");
  process.exit(failed ? 1 : 0);
}

serverTests();
