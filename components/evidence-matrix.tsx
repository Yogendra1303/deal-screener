"use client";

// Diligence, math gap first (audit section 9). Every cross-check as one row: what the deck claims, what the
// other source supports, the signed variance, the state and where each figure comes from. The first conflict
// is lifted into a focus panel with its arithmetic written out. Evidence state is shown on its own; the
// suggested band sits below in its own card, because a conflict never moves a pitch down.
import { evidenceMatrix, type EvidenceRow, type EvidenceState } from "@/lib/evidence-matrix";
import type { DealResult } from "@/lib/types";
import { cx } from "./ui";

const STATE: Record<EvidenceState, { label: string; cls: string }> = {
  conflict: { label: "Conflict", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  match: { label: "Matched", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  not_run: { label: "Not run", cls: "border-slate-200 bg-slate-50 text-slate-600" },
};

function StateTag({ state }: { state: EvidenceState }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold", STATE[state].cls)}>{STATE[state].label}</span>;
}

function DeckSource({ row, deckUrl }: { row: EvidenceRow; deckUrl: string | null }) {
  if (!row.deckPage) return <span className="text-slate-500">Deck</span>;
  return deckUrl ? (
    <a href={`${deckUrl}#page=${row.deckPage}`} target="_blank" rel="noreferrer" className="font-medium text-violet-700 underline-offset-2 hover:underline" title={row.deckQuote ?? undefined}>
      Deck p.{row.deckPage}
    </a>
  ) : (
    <span title={row.deckQuote ?? undefined}>Deck p.{row.deckPage}</span>
  );
}

export function EvidenceMatrix({ deal, deckUrl }: { deal: DealResult; deckUrl: string | null }) {
  const rows = evidenceMatrix({ record: deal.record, form: deal.form, sheet: deal.sheet, registry: deal.registry });
  const focus = rows.find((r) => r.state === "conflict");
  const ran = rows.filter((r) => r.state !== "not_run");
  const conflicts = rows.filter((r) => r.state === "conflict").length;

  return (
    <section aria-labelledby="evidence-matrix-title" className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="evidence-matrix-title" className="text-base font-semibold leading-6 text-slate-900">
          Evidence: deck against its sources
        </h2>
        <p className="text-xs leading-[18px] text-slate-600">
          {ran.length} of {rows.length} checks ran · {conflicts} {conflicts === 1 ? "conflict" : "conflicts"} · founder numbers are never corrected
        </p>
      </div>

      {focus && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[.04em] text-rose-800">{focus.metric}: conflict</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs leading-[18px] text-slate-600">Deck claim</p>
              <p className="text-2xl font-semibold leading-8 tabular-nums text-slate-900">{focus.deck}</p>
              <p className="text-xs leading-[18px] text-slate-600">
                <DeckSource row={focus} deckUrl={deckUrl} />
              </p>
            </div>
            <div>
              <p className="text-xs leading-[18px] text-slate-600">Support</p>
              <p className="text-2xl font-semibold leading-8 tabular-nums text-slate-900">{focus.support}</p>
              <p className="text-xs leading-[18px] text-slate-600">{focus.supportSource}</p>
            </div>
            <div>
              <p className="text-xs leading-[18px] text-slate-600">Variance</p>
              <p className="text-[28px] font-bold leading-9 tabular-nums text-rose-700">{focus.varianceText}</p>
              <p className="text-xs leading-[18px] text-slate-600">{focus.rule}</p>
            </div>
          </div>
          {focus.formula && <p className="mt-3 font-mono text-sm tabular-nums text-slate-800">{focus.formula}</p>}
          {focus.note && <p className="mt-1 text-xs leading-[18px] text-slate-600">{focus.note}</p>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Every cross-check with the deck claim, the supporting figure, the variance, its state and the source</caption>
          <thead>
            <tr className="text-left text-xs font-semibold tracking-[.04em] text-slate-600">
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Metric</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Deck claim</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">CSV / form / registry support</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-right">Variance</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">State</th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.checkId} className={cx("align-top", r.state === "conflict" && "bg-rose-50/40")}>
                <th scope="row" className="border-b border-slate-100 px-3 py-3 text-left font-medium text-slate-900">
                  {r.metric}
                  <span className="block text-xs font-normal leading-[18px] text-slate-500">{r.rule}</span>
                </th>
                <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-800">{r.deck ?? <span className="text-slate-400">Not stated</span>}</td>
                <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-800">{r.support ?? <span className="text-slate-400">None</span>}</td>
                <td className={cx("whitespace-nowrap border-b border-slate-100 px-3 py-3 text-right font-semibold tabular-nums", r.state === "conflict" ? "text-rose-700" : "text-slate-700")}>{r.varianceText}</td>
                <td className="border-b border-slate-100 px-3 py-3">
                  <StateTag state={r.state} />
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-xs leading-[18px] text-slate-600">
                  <DeckSource row={r} deckUrl={deckUrl} /> · {r.supportSource}
                  {r.state === "not_run" && r.note && <span className="block text-slate-500">{r.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
