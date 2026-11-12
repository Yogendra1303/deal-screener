// Runs the screener on the 10 sample decks and saves the results into data/sample-results.json,
// so the hosted demo shows them without spending API credits.
//
//   npm run process-samples                 process samples that have no result yet
//   npm run process-samples -- --force      re-process all of them
//   npm run process-samples -- --only ledgerly,rostrly
//   npm run process-samples -- --research   also run the web research pack (slower, uses web search)
//   npm run process-samples -- --parallel 2 how many decks at once (default 3)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const root = process.cwd();
  if (existsSync(path.join(root, ".env.local"))) process.loadEnvFile(path.join(root, ".env.local"));

  // Imported after the env file is loaded, so model settings are picked up.
  const { processDeal } = await import("../lib/pipeline");
  const { runResearch } = await import("../lib/research");
  const { parseSheet } = await import("../lib/sheet");
  const { SAMPLES } = await import("../lib/data");
  const { evaluate } = await import("../lib/evaluate");
  const { hasKey, MODEL, EFFORT } = await import("../lib/ai");

  if (!hasKey()) {
    console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local first.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const research = args.includes("--research");
  const onlyArg = args[args.indexOf("--only") + 1];
  const only = args.includes("--only") && onlyArg ? onlyArg.split(",") : null;
  const parallelArg = Number(args[args.indexOf("--parallel") + 1]);
  const parallel = args.includes("--parallel") && parallelArg > 0 ? parallelArg : 3;

  const outFile = path.join(root, "data", "sample-results.json");
  const results: Record<string, unknown> = JSON.parse(readFileSync(outFile, "utf8"));
  const queue = SAMPLES.filter((s) => (only ? only.includes(s.id) : force || !results[s.id]));
  console.log(`Model ${MODEL}, effort ${EFFORT}. Processing ${queue.length} deck(s), ${parallel} at a time.\n`);

  let failures = 0;
  async function worker() {
    for (;;) {
      const s = queue.shift();
      if (!s) return;
      const started = Date.now();
      try {
        const deal = await processDeal({
          id: s.id,
          source: "sample",
          receivedAt: s.receivedAt,
          form: s.form,
          pdfBase64: readFileSync(path.join(root, "public", "samples", s.deckFile)).toString("base64"),
          fileName: s.deckFile,
          deckUrl: `/samples/${s.deckFile}`,
          sheet: s.sheetFile ? parseSheet(readFileSync(path.join(root, "public", "samples", s.sheetFile), "utf8")) : null,
        });
        if (research) {
          const r = await runResearch({ form: deal.form, record: deal.record });
          deal.research = r.research;
          deal.runLog.push(r.step);
        }
        results[s.id] = deal;
        writeFileSync(outFile, JSON.stringify(results, null, 1) + "\n");
        const cost = deal.runLog.reduce((a, x) => a + (x.costUsd ?? 0), 0);
        const flags = deal.flags.map((f) => f.checkId).join(", ") || "no flags";
        console.log(
          `✓ ${s.form.companyName.padEnd(13)} ${deal.band.padEnd(13)} ${((Date.now() - started) / 1000).toFixed(0)}s $${cost.toFixed(3)}  ${flags}`,
        );
      } catch (e) {
        failures++;
        console.error(`✗ ${s.form.companyName}: ${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));

  const ev = evaluate(Object.values(results) as Parameters<typeof evaluate>[0]);
  console.log(`\nPlanted issues caught: ${ev.caught} of ${ev.planted}`);
  console.log(`False alarms: ${ev.falseAlarms}`);
  console.log(`Bands as expected: ${ev.bandMatches} of ${ev.processed}`);
  if (ev.avgSeconds != null) console.log(`Average per deck: ${Math.round(ev.avgSeconds)}s, $${ev.avgCostUsd!.toFixed(3)}`);
  for (const d of ev.decks.filter((x) => x.missed.length || x.falseAlarms.length)) {
    console.log(`  ${d.id}: missed [${d.missed.join(", ")}] false alarms [${d.falseAlarms.join(", ")}]`);
  }
  console.log(`\nSaved to data/sample-results.json. Commit it so the hosted demo shows these results.`);
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
