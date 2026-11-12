"use client";

// The AI workbench. One modal, two ways to run the same job:
//   1. My Claude / ChatGPT account: copy a prompt, run it in the chat on your own subscription, paste the JSON back.
//      Code validates it, runs the checks, scores and band, and saves the result. No API key anywhere.
//   2. Direct API key: the server runs it when ANTHROPIC_API_KEY is set.
// Either way the result is marked with how it was made.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BRIDGE_TOOLS,
  applyExtraction,
  buildAssessmentPrompt,
  buildExtractionPrompt,
  buildResearchPrompt,
  parseAssessmentJson,
  parseBothJson,
  parseResearchJson,
  type BridgeTool,
} from "@/lib/ai/workbench";
import { processOnServer, processSample } from "@/lib/client-api";
import { loadDeck } from "@/lib/deckstore";
import { sampleById } from "@/lib/data";
import type { Assessment, DealRecord, Research } from "@/lib/schema";
import type { DealResult, FormInput, SheetRow } from "@/lib/types";
import { useStore } from "./store";
import { Button, Notice, Spinner, cx } from "./ui";

export type WorkbenchJob =
  | {
      kind: "extract";
      id: string;
      source: DealResult["source"];
      receivedAt: string;
      form: FormInput;
      fileName: string;
      /** Where the deck can be fetched for the API run and downloaded for the chat run. */
      deckUrl: string | null;
      /** This browser's copy of the deck, when it was uploaded here. */
      deckKey?: string | null;
      sheet: SheetRow[] | null;
      /** A result that already exists; a re-run replaces it but keeps the research pack. */
      existing?: DealResult | null;
    }
  | { kind: "research"; id: string; form: FormInput; record: DealRecord; deal?: DealResult | null };

type Mode = "ACCOUNT_BRIDGE" | "API_KEY";

const area = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] leading-snug text-slate-800 focus:border-slate-900 focus:outline-none";

export function AIWorkbenchModal({ job, onClose, onDone }: { job: WorkbenchJob; onClose: () => void; onDone?: (deal: DealResult | null) => void }) {
  const store = useStore();
  const hasKey = Boolean(store.server?.hasKey);
  const [mode, setMode] = useState<Mode>(store.settings.aiMode === "API_KEY" && hasKey ? "API_KEY" : "ACCOUNT_BRIDGE");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = job.kind === "extract" ? (job.existing ? "Re-run the AI deck extraction" : "Run the AI deck extraction") : "Generate a live research pack";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="wb-title">
      <button className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI workbench · {job.form.companyName}</p>
            <h2 id="wb-title" className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            Close
          </button>
        </div>
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2">
          {(
            [
              ["ACCOUNT_BRIDGE", "My Claude / ChatGPT account", "No API key"],
              ["API_KEY", "Direct API key", hasKey ? "Key is set on the server" : "No key on the server"],
            ] as [Mode, string, string][]
          ).map(([m, label, hint]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                store.setSettings({ aiMode: m });
              }}
              className={cx(
                "rounded-t-lg border border-b-0 px-3 py-2 text-left text-sm",
                mode === m ? "border-slate-200 bg-white font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
              <span className="block text-[11px] font-normal text-slate-500">{hint}</span>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {mode === "ACCOUNT_BRIDGE" ? (
            job.kind === "extract" ? (
              <BridgeExtract job={job} onDone={onDone} onClose={onClose} />
            ) : (
              <BridgeResearch job={job} onDone={onDone} onClose={onClose} />
            )
          ) : (
            <ApiRun job={job} hasKey={hasKey} onDone={onDone} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Shared pieces ----------

function PromptBox({ prompt, tool, setTool, attach }: { prompt: string; tool: BridgeTool; setTool: (t: BridgeTool) => void; attach?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  async function copyAndOpen(t: BridgeTool) {
    setTool(t);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    window.open(BRIDGE_TOOLS[t].url, "_blank", "noopener");
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => copyAndOpen("claude")}>Copy prompt &amp; open Claude.ai</Button>
        <Button variant="secondary" onClick={() => copyAndOpen("chatgpt")}>
          Copy &amp; open ChatGPT
        </Button>
        {copied && <span className="text-xs font-medium text-emerald-700">Copied. Paste it into the chat{attach ? " with the deck attached" : ""}.</span>}
        <span className="ml-auto text-xs text-slate-500">
          Using <span className="font-medium text-slate-700">{BRIDGE_TOOLS[tool].name}</span>
        </span>
      </div>
      {attach}
      <details className="rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600">Show the prompt ({prompt.length.toLocaleString("en-US")} characters)</summary>
        <textarea readOnly value={prompt} rows={10} className={cx(area, "rounded-t-none border-0 border-t border-slate-200")} />
      </details>
    </div>
  );
}

function PasteBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={7} placeholder={placeholder} className={area} spellCheck={false} />;
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-xl border p-4", done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200")}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={cx("grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold", done ? "bg-emerald-600 text-white" : "bg-slate-900 text-white")}>{done ? "✓" : n}</span>
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

// ---------- Deck extraction through the person's own account ----------

function BridgeExtract({ job, onDone, onClose }: { job: Extract<WorkbenchJob, { kind: "extract" }>; onDone?: (d: DealResult | null) => void; onClose: () => void }) {
  const store = useStore();
  const [tool, setTool] = useState<BridgeTool>("claude");
  const [paste1, setPaste1] = useState("");
  const [paste2, setPaste2] = useState("");
  const [record, setRecord] = useState<DealRecord | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<DealResult | null>(null);

  const prompt1 = useMemo(() => buildExtractionPrompt({ form: job.form, sheet: job.sheet, fileName: job.fileName }), [job]);
  const prompt2 = useMemo(() => (record ? buildAssessmentPrompt({ record, form: job.form, sheet: job.sheet }) : ""), [record, job]);
  const deckHref = job.deckUrl;

  function validateRecord() {
    setError(null);
    try {
      const both = parseBothJson(paste1);
      setRecord(both.record);
      if (both.assessment) setAssessment(both.assessment);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function validateAssessment() {
    setError(null);
    try {
      setAssessment(parseAssessmentJson(paste2));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function apply() {
    if (!record || !assessment) return;
    setError(null);
    try {
      const deal = applyExtraction({ ...job, record, assessment, tool, research: job.existing?.research ?? store.researchOf(job.id) });
      store.saveDeal(deal);
      setSaved(deal);
      onDone?.(deal);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const facts = record ? countFacts(record) : 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Three steps. The AI reads the deck and judges it in your own chat; the app checks the numbers, scores and bands by code, the same as an API run. The result is marked
        &quot;read in chat&quot;.
      </p>
      {error && <Notice tone="error">{error}</Notice>}

      <Step n={1} title="Read the deck into the standard record" done={Boolean(record)}>
        <PromptBox
          prompt={prompt1}
          tool={tool}
          setTool={setTool}
          attach={
            <p className="text-xs text-slate-600">
              Attach the deck PDF to the chat before sending.{" "}
              {deckHref ? (
                <a href={deckHref} download={job.fileName} className="font-medium text-slate-900 underline">
                  Download {job.fileName}
                </a>
              ) : (
                <span>Use {job.fileName} from the data room.</span>
              )}
            </p>
          }
        />
        {!record && (
          <>
            <PasteBox value={paste1} onChange={setPaste1} placeholder="Paste the JSON the chat answered with" />
            <Button onClick={validateRecord} disabled={!paste1.trim()}>
              Validate &amp; continue
            </Button>
          </>
        )}
        {record && (
          <p className="text-xs text-emerald-800">
            Record accepted: {facts} stated facts with page references{record.team.length ? `, ${record.team.length} founders` : ""}.{" "}
            <button onClick={() => (setRecord(null), setAssessment(null))} className="font-medium underline">
              Paste again
            </button>
          </p>
        )}
      </Step>

      <Step n={2} title="Score traction and team, write founder questions" done={Boolean(assessment)}>
        {!record ? (
          <p className="text-xs text-slate-500">Unlocks after step 1. The prompt includes the record and what the code checks found, so the AI judges with the sheet and registry in view.</p>
        ) : assessment ? (
          <p className="text-xs text-emerald-800">
            Assessment accepted: traction {assessment.traction.level.toLowerCase()}, team {assessment.team.level.toLowerCase()}, {assessment.founderQuestions.length} questions.
          </p>
        ) : (
          <>
            <PromptBox prompt={prompt2} tool={tool} setTool={setTool} />
            <PasteBox value={paste2} onChange={setPaste2} placeholder="Paste the assessment JSON" />
            <Button onClick={validateAssessment} disabled={!paste2.trim()}>
              Validate assessment
            </Button>
          </>
        )}
      </Step>

      <Step n={3} title="Apply to the deal" done={Boolean(saved)}>
        {saved ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-emerald-800">
              Saved. Band <span className="font-semibold">{saved.band}</span>, {saved.flags.filter((f) => f.kind === "conflict").length} conflicts found by code.
            </span>
            <Link href={`/deals/${saved.id}`} onClick={onClose} className="font-medium text-slate-900 underline">
              Open the deal
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-600">Code runs the number and registry checks, turns founder conflicts into flags, makes the five scores and the band, and saves the deal for everyone.</p>
            <Button onClick={apply} disabled={!record || !assessment}>
              Validate &amp; apply to deal
            </Button>
          </>
        )}
      </Step>
    </div>
  );
}

function countFacts(r: DealRecord): number {
  let n = 0;
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if ("page" in o && o.page != null && ("value" in o ? o.value != null : "amount" in o ? o.amount != null : true)) n++;
    for (const k of Object.keys(o)) walk(o[k]);
  };
  walk(r);
  return n;
}

// ---------- Research pack through the person's own account ----------

function BridgeResearch({ job, onDone, onClose }: { job: Extract<WorkbenchJob, { kind: "research" }>; onDone?: (d: DealResult | null) => void; onClose: () => void }) {
  const store = useStore();
  const [tool, setTool] = useState<BridgeTool>("claude");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Research | null>(null);
  const prompt = useMemo(() => buildResearchPrompt({ form: job.form, record: job.record }), [job]);

  function apply() {
    setError(null);
    try {
      const research = parseResearchJson(paste);
      attachResearch(store, job, research, BRIDGE_TOOLS[tool].model);
      setSaved(research);
      onDone?.(job.deal ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        The chat searches the web for the closest competitors, builds a bottom-up market size with its sources, and lists public red flags. Paste the JSON back and it is attached to this
        company with every link kept.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Step n={1} title="Run the research in your chat">
        <PromptBox prompt={prompt} tool={tool} setTool={setTool} attach={<p className="text-xs text-slate-600">Turn web search on in the chat so every claim has a link.</p>} />
      </Step>
      <Step n={2} title="Paste the JSON and attach it" done={Boolean(saved)}>
        {saved ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-emerald-800">
              Attached: {saved.competitors.length} competitors, {saved.sources.length} sources, {saved.redFlags.length} red flags.
            </span>
            <button onClick={onClose} className="font-medium text-slate-900 underline">
              Done
            </button>
          </div>
        ) : (
          <>
            <PasteBox value={paste} onChange={setPaste} placeholder="Paste the research JSON" />
            <Button onClick={apply} disabled={!paste.trim()}>
              Validate &amp; attach research pack
            </Button>
          </>
        )}
      </Step>
    </div>
  );
}

function attachResearch(store: ReturnType<typeof useStore>, job: Extract<WorkbenchJob, { kind: "research" }>, research: Research, model: string, step?: DealResult["runLog"][number]) {
  if (job.deal) {
    const runLog = [...job.deal.runLog.filter((s) => s.step !== "Research pack"), step ?? { step: "Research pack", ms: 0 }];
    store.saveDeal({ ...job.deal, research, runLog, ...(job.deal.processedBy === "chat" ? {} : {}), model: job.deal.model || model });
  } else {
    store.setResearch(job.id, research);
  }
}

// ---------- Direct API key ----------

function ApiRun({ job, hasKey, onDone, onClose }: { job: WorkbenchJob; hasKey: boolean; onDone?: (d: DealResult | null) => void; onClose: () => void }) {
  const store = useStore();
  const [state, setState] = useState<{ running: boolean; message: string; error?: boolean; done?: boolean }>({ running: false, message: "" });

  async function run() {
    setState({ running: true, message: "Starting" });
    try {
      if (job.kind === "research") {
        const res = await fetch("/api/ai/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "research", form: job.form, record: job.record }) });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `The server answered ${res.status}.`);
        attachResearch(store, job, j.research as Research, store.server?.model ?? "api", j.step);
        setState({ running: false, message: "Research pack attached.", done: true });
        onDone?.(job.deal ?? null);
        return;
      }
      const sample = sampleById(job.id);
      let deal: DealResult;
      if (sample && job.source === "sample") {
        deal = await processSample(job.id, (message) => setState({ running: true, message }));
      } else {
        const blob = await deckBlob(job);
        if (!blob) throw new Error("The deck PDF isn't available in this browser or on the server. Upload it again from Add a pitch.");
        const fd = new FormData();
        fd.set("deck", new File([blob], job.fileName, { type: "application/pdf" }));
        if (job.sheet?.length) fd.set("sheet", new File([sheetToCsv(job.sheet)], "monthly.csv", { type: "text/csv" }));
        fd.set("form", JSON.stringify(job.form));
        const got = await processOnServer(fd, (message) => setState({ running: true, message }));
        deal = { ...got, id: job.id, source: job.source, receivedAt: job.receivedAt, deck: { fileName: job.fileName, url: job.deckUrl }, research: job.existing?.research ?? null };
      }
      store.saveDeal(deal);
      setState({ running: false, message: `Done. Band ${deal.band}.`, done: true });
      onDone?.(deal);
    } catch (e) {
      setState({ running: false, message: (e as Error).message, error: true });
    }
  }

  return (
    <div className="space-y-3">
      {hasKey ? (
        <Notice tone="info">
          An API key is set on the server ({store.server?.model}). The job runs there in one to three minutes, and time and cost are recorded on the AI steps tab.
        </Notice>
      ) : (
        <Notice tone="warn">
          No API key on the server. Add <code className="rounded bg-white px-1">ANTHROPIC_API_KEY</code> to .env.local (local) or the Vercel project settings, never to the app or
          a chat. Until then, use the account tab.
        </Notice>
      )}
      <p className="text-sm text-slate-600">
        {job.kind === "extract"
          ? "Reads the deck, runs the checks, scores and bands it, and saves the deal for everyone."
          : "Searches the web for competitors, market size and red flags, and attaches the pack to this company."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={!hasKey || state.running}>
          {state.running && <Spinner />} {job.kind === "extract" ? (job.existing ? "Re-run with the API key" : "Run with the API key") : "Run research with the API key"}
        </Button>
        {state.done && (
          <button onClick={onClose} className="text-sm font-medium text-slate-900 underline">
            Close
          </button>
        )}
        {state.message && <span className={cx("text-xs", state.error ? "text-red-700" : "text-slate-600")}>{state.message}</span>}
      </div>
    </div>
  );
}

async function deckBlob(job: Extract<WorkbenchJob, { kind: "extract" }>): Promise<Blob | null> {
  if (job.deckKey) {
    const mine = await loadDeck(job.deckKey);
    if (mine) return mine;
  }
  if (job.deckUrl) {
    const r = await fetch(job.deckUrl).catch(() => null);
    if (r?.ok) return r.blob();
  }
  return null;
}

function sheetToCsv(rows: SheetRow[]): string {
  const head = "month,currency,revenue,customers,headcount,net_burn,cash";
  const cell = (v: number | string | null) => (v == null ? "" : String(v));
  return [head, ...rows.map((r) => [r.month, r.currency, cell(r.revenue), cell(r.customers), cell(r.headcount), cell(r.netBurn), cell(r.cash)].join(","))].join("\n");
}
