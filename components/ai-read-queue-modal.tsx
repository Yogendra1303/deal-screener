"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AIWorkbenchModal, type WorkbenchJob } from "@/components/ai-workbench";
import { useLinks } from "@/components/links-store";
import { useStore } from "@/components/store";
import { cx } from "@/components/ui";
import { fmtDay } from "@/lib/dates";
import { usd } from "@/lib/rules";

interface CandidatePitch {
  id: string;
  companyName: string;
  sector: string;
  stage: string;
  askUsd: number | null;
  receivedAt: string;
  founderName?: string;
  aiState: "unread" | "deterministic" | "ai_read";
  isLive: boolean;
  job: Extract<WorkbenchJob, { kind: "extract" }>;
}

export function AIReadQueueModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const store = useStore();
  const links = useLinks();
  const [tab, setTab] = useState<"needs_ai" | "all">("needs_ai");
  const [search, setSearch] = useState("");
  const [activeJob, setActiveJob] = useState<Extract<WorkbenchJob, { kind: "extract" }> | null>(null);

  useEffect(() => {
    if (!isOpen || activeJob) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, activeJob, onClose]);

  const candidates = useMemo<CandidatePitch[]>(() => {
    const map = new Map<string, CandidatePitch>();

    // 1. Inbound pitches (submitted via /pitch or email) that aren't processed with full AI yet
    for (const i of links.inbound) {
      if (!i?.id || !i.form) continue;
      const existingDeal = store.getDeal(i.id);
      const pdfFile = i.files?.find((f) => /\.pdf$/i.test(f.name)) ?? i.files?.[0];
      const aiModel = existingDeal?.model || "";
      const aiState: CandidatePitch["aiState"] = !existingDeal
        ? "unread"
        : aiModel.includes("deterministic")
          ? "deterministic"
          : "ai_read";

      map.set(i.id, {
        id: i.id,
        companyName: i.form.companyName || "Submitted Pitch",
        sector: i.form.sector || "Technology",
        stage: i.form.stage || "Seed",
        askUsd: i.form.amountUsd ?? null,
        receivedAt: i.receivedAt || "",
        founderName: i.form.founders?.[0]?.name,
        aiState,
        isLive: true,
        job: {
          kind: "extract",
          id: i.id,
          source: "upload",
          receivedAt: i.receivedAt || new Date().toISOString(),
          form: i.form,
          fileName: pdfFile?.name || `${i.form.companyName || i.id}-deck.pdf`,
          deckUrl: pdfFile?.url || `/api/files/${encodeURIComponent(i.id)}/deck_pdf`,
          deckKey: pdfFile?.key || i.id,
          sheet: existingDeal?.sheet ?? i.manual?.sheet ?? null,
          existing: existingDeal ?? null,
        },
      });
    }

    // 2. Unprocessed sample decks waiting for AI reading
    for (const s of store.unprocessed) {
      if (map.has(s.id)) continue;
      map.set(s.id, {
        id: s.id,
        companyName: s.form.companyName,
        sector: s.form.sector,
        stage: s.form.stage,
        askUsd: s.form.amountUsd,
        receivedAt: s.receivedAt,
        founderName: s.form.founders?.[0]?.name,
        aiState: "unread",
        isLive: false,
        job: {
          kind: "extract",
          id: s.id,
          source: "sample",
          receivedAt: s.receivedAt,
          form: s.form,
          fileName: s.deckFile,
          deckUrl: `/samples/${s.deckFile}`,
          deckKey: null,
          sheet: null,
          existing: null,
        },
      });
    }

    // 3. Existing deals in store (can run AI if deterministic or re-run AI for deeper report)
    for (const d of store.deals) {
      if (map.has(d.id)) continue;
      const aiState: CandidatePitch["aiState"] = (d.model || "").includes("deterministic") ? "deterministic" : "ai_read";
      map.set(d.id, {
        id: d.id,
        companyName: d.form.companyName,
        sector: d.form.sector,
        stage: d.form.stage,
        askUsd: d.form.amountUsd,
        receivedAt: d.receivedAt,
        founderName: d.form.founders?.[0]?.name,
        aiState,
        isLive: d.source === "upload",
        job: {
          kind: "extract",
          id: d.id,
          source: d.source,
          receivedAt: d.receivedAt,
          form: d.form,
          fileName: d.deck.fileName,
          deckUrl: d.deck.url || `/api/files/${encodeURIComponent(d.id)}/deck_pdf`,
          deckKey: d.id,
          sheet: d.sheet,
          existing: d,
        },
      });
    }

    return [...map.values()].sort(
      (a, b) =>
        Number(a.aiState === "ai_read") - Number(b.aiState === "ai_read") ||
        Number(b.isLive) - Number(a.isLive) ||
        (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""),
    );
  }, [links.inbound, store]);

  if (!isOpen) return null;

  if (activeJob) {
    return (
      <AIWorkbenchModal
        job={activeJob}
        onClose={() => setActiveJob(null)}
        onDone={() => {
          setActiveJob(null);
          onClose();
        }}
      />
    );
  }

  const needsAi = candidates.filter((c) => c.aiState !== "ai_read");
  const q = search.trim().toLowerCase();
  const baseList = tab === "needs_ai" ? needsAi : candidates;
  const shown = baseList.filter(
    (c) => !q || `${c.companyName} ${c.sector} ${c.stage} ${c.founderName ?? ""}`.toLowerCase().includes(q),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select a submitted pitch for AI reading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">AI Reading Queue</p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">Select a submitted pitch for AI deep reading</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick any unread or submitted deck below to run full slide-by-slide AI extraction, math verification, and investment memo generation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("needs_ai")}
              className={cx(
                "cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors",
                tab === "needs_ai" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              Needs AI Read ({needsAi.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("all")}
              className={cx(
                "cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors",
                tab === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              All Submitted ({candidates.length})
            </button>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter submitted pitches…"
            className="h-8 w-52 rounded-md border border-slate-200 px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {shown.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              {tab === "needs_ai"
                ? "Every submitted pitch already has an AI report. Switch to “All Submitted” to re-run any deck."
                : "No pitches match that search."}
            </div>
          ) : (
            shown.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/80">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{c.companyName}</span>
                    {c.isLive && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        Live
                      </span>
                    )}
                    <span
                      className={cx(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        c.aiState === "unread"
                          ? "bg-amber-50 text-amber-800"
                          : c.aiState === "deterministic"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {c.aiState === "unread" ? "Not read by AI" : c.aiState === "deterministic" ? "Quick check only" : "AI Report Ready"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {c.sector} · {c.stage}
                    {c.askUsd ? ` · ${usd(c.askUsd)}` : ""}
                    {c.founderName ? ` · ${c.founderName}` : ""}
                    {c.receivedAt ? ` · ${fmtDay(c.receivedAt.slice(0, 10))}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveJob(c.job)}
                  className="shrink-0 cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-blue-700"
                >
                  {c.aiState === "ai_read" ? "Re-run AI →" : "Read with AI →"}
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
          <span>Want to manually upload a brand-new deck instead?</span>
          <Link href="/upload" onClick={onClose} className="font-semibold text-blue-700 hover:underline">
            Go to + Upload Pitch →
          </Link>
        </footer>
      </div>
    </div>
  );
}
