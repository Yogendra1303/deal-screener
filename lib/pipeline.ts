// One deck, start to finish: read it, check it, score it, band it.
import { extractRecord } from "./extract";
import { assessDeal } from "./assess";
import { runChecks } from "./checks";
import { findProfiles, findRegistry } from "./fixtures";
import { lookupFacts } from "./lookups";
import { MODEL } from "./ai";
import { DEFAULT_RULES, bandFor, completenessScore, consistencyScore, fitScore } from "./rules";
import type { DealResult, Flag, FormInput, Profile, RegistryRecord, RunStep, Score, SheetRow } from "./types";
import type { Assessment, DealRecord, Research } from "./schema";

export async function processDeal(input: {
  id: string;
  source: DealResult["source"];
  receivedAt: string;
  form: FormInput;
  pdfBase64: string;
  fileName: string;
  deckUrl: string | null;
  sheet: SheetRow[] | null;
  onStep?: (message: string) => void;
}): Promise<DealResult> {
  const runLog: RunStep[] = [];
  const say = input.onStep ?? (() => {});

  // 1. AI reads the deck into the standard record.
  say("Reading the deck and filling the standard record");
  const { record, step: readStep } = await extractRecord(input.pdfBase64);
  runLog.push(readStep);

  // 2. Code checks against the form, the sheet and the sample registry.
  say("Checking numbers against the sheet, the form and the registry");
  let t = Date.now();
  const { registry, profiles, flags } = await checkStageLive({ record, form: input.form, sheet: input.sheet });
  runLog.push({ step: "Number and registry checks", ms: Date.now() - t });

  // 3. AI judges traction and team, checks founder roles against profiles, writes questions.
  say("Scoring traction and team, checking founder profiles");
  const { assessment, step: assessStep } = await assessDeal({
    record,
    form: input.form,
    flags,
    sheet: input.sheet,
    registry,
    profiles,
  });
  runLog.push(assessStep);

  // 4. Founder conflicts become flags; code makes the remaining scores and the band.
  t = Date.now();
  const deal = finishDeal({ ...input, record, sheet: input.sheet, registry, profiles, flags, assessment, model: MODEL, runLog });
  runLog.push({ step: "Scores and band", ms: Date.now() - t });
  say("Done");
  return deal;
}

/** Code checks against the form, the sheet and the sample registry and profiles. */
export function checkStage(args: { record: DealRecord; form: FormInput; sheet: SheetRow[] | null }) {
  const { record, form, sheet } = args;
  const registry = findRegistry(form.companyName) ?? findRegistry(record.company.name.value ?? "");
  const founderNames = [...form.founders.map((f) => f.name), ...record.team.map((f) => f.name)];
  const profiles = findProfiles(founderNames);
  const flags: Flag[] = runChecks({ record, form, sheet, registry });
  return { registry, profiles, flags };
}

/** Same checks, but the registry record and founder profiles come from the live lookups (see lib/lookups). */
export async function checkStageLive(args: { record: DealRecord; form: FormInput; sheet: SheetRow[] | null }) {
  const { record, form, sheet } = args;
  const { registry, profiles } = await lookupFacts(form, {
    companyName: record.company.name.value ?? "",
    founderNames: record.team.map((f) => f.name),
  });
  const flags: Flag[] = runChecks({ record, form, sheet, registry });
  return { registry, profiles, flags };
}

/** Turns founder conflicts into flags, makes the code scores and the band, and assembles the result. */
export function finishDeal(a: {
  id: string;
  source: DealResult["source"];
  receivedAt: string;
  form: FormInput;
  fileName: string;
  deckUrl: string | null;
  record: DealRecord;
  sheet: SheetRow[] | null;
  registry: RegistryRecord | null;
  profiles: Profile[];
  flags: Flag[];
  assessment: Assessment;
  model: string;
  runLog: RunStep[];
  processedBy?: DealResult["processedBy"];
  research?: Research | null;
}): DealResult {
  const flags = [...a.flags];
  for (const c of a.assessment.founderChecks.filter((c) => c.verdict === "conflict")) {
    flags.push({
      checkId: "founder_vs_profile",
      kind: "conflict",
      title: `${c.founder}: claimed role doesn't match the profile`,
      detail: c.detail,
      sources: [
        { label: "Deck", value: c.claim },
        { label: a.profiles.some((p) => !/sample/i.test(p.source)) ? "Profile (live)" : "Profile (sample)", value: c.detail },
      ],
    });
  }
  const scores: Score[] = [
    fitScore(a.form, DEFAULT_RULES),
    { key: "traction", label: "Traction evidence", by: "AI", ...a.assessment.traction },
    consistencyScore(flags),
    { key: "team", label: "Team signals", by: "AI", ...a.assessment.team },
    completenessScore(a.record),
  ];
  const { band, reasons } = bandFor(scores);
  return {
    id: a.id,
    source: a.source,
    receivedAt: a.receivedAt,
    processedAt: new Date().toISOString(),
    model: a.model,
    processedBy: a.processedBy ?? "api",
    form: a.form,
    deck: { fileName: a.fileName, url: a.deckUrl },
    record: a.record,
    sheet: a.sheet,
    registry: a.registry,
    profiles: a.profiles,
    flags,
    ai: a.assessment,
    scores,
    band,
    bandReasons: reasons,
    research: a.research ?? null,
    runLog: a.runLog,
  };
}
