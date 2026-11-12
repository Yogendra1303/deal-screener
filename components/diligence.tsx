"use client";

import { useMemo, useState } from "react";
import { useEvidence } from "./evidence";
import { FileName, RequestBuilder, openLines } from "./founder-links";
import { useLinks } from "./links-store";
import { cx } from "./ui";
import { useWorkspace } from "./workspace";
import { fmtDay } from "@/lib/dates";
import { DD_MEANING, diligence, type DDItem, type DDSection, type DDStatus } from "@/lib/diligence";
import { itemStatus, type FounderRequest, type ItemAnswer } from "@/lib/links";
import { dealFacts } from "@/lib/provenance";
import type { DealResult } from "@/lib/types";

/** The checklist's own statuses, plus where the founder request stands. */
type View = DDStatus | "Received" | "Asked";

const MEANING: Record<View, string> = {
  ...DD_MEANING,
  Received: "The founder sent a file. Someone at the fund needs to check it. A received file never closes a conflict on its own",
  Asked: "Asked through a founder link. Waiting for the founder",
};

const PILL: Record<View, string> = {
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Received: "bg-slate-900 text-white ring-indigo-600",
  Asked: "bg-slate-100 text-slate-700 ring-slate-200",
  Claimed: "bg-slate-100 text-slate-700 ring-slate-200",
  Conflict: "bg-red-50 text-red-700 ring-red-200",
  "Ask founder": "bg-amber-50 text-amber-800 ring-amber-200",
  Later: "bg-slate-100 text-slate-500 ring-slate-200",
};
const BAR: Record<View, string> = {
  Done: "bg-emerald-500",
  Received: "bg-slate-600",
  Asked: "bg-slate-300",
  Claimed: "bg-slate-400",
  Conflict: "bg-red-500",
  "Ask founder": "bg-amber-400",
  Later: "bg-slate-200",
};
const ORDER: View[] = ["Done", "Received", "Asked", "Claimed", "Conflict", "Ask founder", "Later"];

interface Link {
  r: FounderRequest;
  itemId: string;
  answer?: ItemAnswer;
  late: boolean;
}

export interface ViewItem extends DDItem {
  view: View;
  link?: Link;
}

export interface DiligenceView {
  sections: (Omit<DDSection, "items"> & { items: ViewItem[] })[];
  counts: Record<View, number>;
  total: number;
  open: number;
}

/** The checklist with founder requests laid over it. A file a person has checked counts as a second source. */
export function useDiligenceView(deal: DealResult): DiligenceView;
export function useDiligenceView(deal: DealResult | undefined): DiligenceView | null;
export function useDiligenceView(deal: DealResult | undefined): DiligenceView | null {
  const links = useLinks();
  return useMemo(() => {
    if (!deal) return null;
    const reqs = links.requestsFor(deal.id);
    const linkFor = (id: string): Link | undefined => {
      for (const r of reqs) {
        const i = r.items.find((x) => (x.dd ?? x.id) === id);
        if (i) return { r, itemId: i.id, answer: r.answers[i.id], late: itemStatus(r, i.id, links.today) === "Overdue" };
      }
      return undefined;
    };
    const sections: DiligenceView["sections"] = diligence(deal).map((s) => ({
      ...s,
      items: s.items.map((i) => {
        const link = i.status === "Done" ? undefined : linkFor(i.id);
        let view: View = i.status;
        // A file arriving does not settle a conflict: the line stays Conflict until someone checks the file.
        if (link?.answer?.state === "Sent") view = link.r.checked[link.itemId] ? "Done" : i.status === "Conflict" ? "Conflict" : "Received";
        else if (link && !link.answer) view = "Asked";
        return { ...i, view, link };
      }),
    }));
    const all = sections.flatMap((s) => s.items);
    const counts = Object.fromEntries(ORDER.map((v) => [v, all.filter((i) => i.view === v).length])) as Record<View, number>;
    return { sections, counts, total: all.length, open: all.length - counts.Later };
  }, [deal, links]);
}

export function DiligenceChecklist({ deal }: { deal: DealResult }) {
  const w = useWorkspace();
  const ev = useEvidence();
  const links = useLinks();
  const { sections, counts, total, open } = useDiligenceView(deal);
  const facts = useMemo(() => dealFacts(deal), [deal]);
  const [asking, setAsking] = useState(false);
  const toAsk = openLines(deal);

  return (
    <div className="space-y-5">
      {asking && (
        <RequestBuilder
          target={{ companyId: deal.id, companyName: deal.form.companyName, side: "pitch", founder: deal.form.founders[0]?.name ?? "", candidates: toAsk }}
          onClose={() => setAsking(false)}
        />
      )}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Diligence checklist</h2>
            <p className="mt-1 text-sm text-slate-600">
              The questions a partner asks on every pitch, filled in from the deck, the founder&apos;s sheet and the checks. A line is Done only
              when a second source backs it, or someone at the fund has checked the founder&apos;s file. Everything open can go to the founder as
              one link.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums text-slate-900">
              {counts.Done}
              <span className="text-lg text-slate-400"> / {open}</span>
            </p>
            <p className="text-xs text-slate-500">answered with proof, for this stage</p>
          </div>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          {ORDER.map((s) => (counts[s] ? <span key={s} className={BAR[s]} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {ORDER.filter((s) => counts[s] || !["Received", "Asked"].includes(s)).map((s) => (
            <span key={s} className="flex items-center gap-1.5" title={MEANING[s]}>
              <span className={cx("h-2 w-2 rounded-full", BAR[s])} />
              <span className="font-semibold text-slate-900">{counts[s]}</span> {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {w.role === "Analyst" ? (
            <button onClick={() => setAsking(true)} className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Ask the founder for what&apos;s open
            </button>
          ) : (
            <span className="text-xs text-slate-500">Analysts send requests to founders. You see what was asked and what came back.</span>
          )}
          {counts.Received > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-200">
              {counts.Received} new from the founder, check below
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => {
          const done = s.items.filter((i) => i.status === "Done").length;
          return (
            <section key={s.key} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              <header className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <span className="text-xs text-slate-500">
                  {done} of {s.items.length} done
                </span>
              </header>
              <ul className="divide-y divide-slate-100">
                {s.items.map((i) => {
                  const fact = i.fact ? facts.find((x) => x.key === i.fact) : undefined;
                  return (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{i.question}</p>
                        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", PILL[i.view])} title={MEANING[i.view]}>
                          {i.view === "Asked" && i.link?.late ? "Asked, late" : i.view}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{i.why}</p>
                      {i.found && (
                        <p className="mt-1.5 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">Found: </span>
                          {fact ? (
                            <button onClick={() => ev.open({ fact, company: { id: deal.id, name: deal.form.companyName, side: "deal" } })} className="text-left text-indigo-700 hover:underline">
                              {i.found}
                            </button>
                          ) : (
                            i.found
                          )}
                        </p>
                      )}
                      {i.link && <FounderAnswer item={i} onCheck={() => links.markChecked(i.link!.r.id, i.link!.itemId, w.me)} />}
                      {i.view !== "Done" && !i.link && (
                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">Ask for: </span>
                          {i.request}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Questions follow common early-stage practice: YC-style application questions and the usual seed and Series A request lists. Legal
        and reference lines move to &quot;Ask founder&quot; from Series A, or before a term sheet.
      </p>
    </div>
  );
}

function FounderAnswer({ item, onCheck }: { item: ViewItem; onCheck: () => void }) {
  const l = item.link!;
  const a = l.answer;
  const checked = l.r.checked[l.itemId];
  return (
    <div className={cx("mt-2 rounded-lg px-2.5 py-2 text-xs", item.view === "Received" ? "bg-slate-100 ring-1 ring-inset ring-slate-200" : "bg-slate-50")}>
      {!a && (
        <p className="text-slate-700">
          Asked by {l.r.from.split(" ")[0]} on {fmtDay(l.r.sentAt)} · {l.late ? <span className="font-medium text-red-700">late, was due {fmtDay(l.r.due)}</span> : `due ${fmtDay(l.r.due)}`}
        </p>
      )}
      {a?.state === "Sent" && (
        <>
          <p className="font-medium text-slate-800">Founder sent, {fmtDay(a.at)}:</p>
          {item.view === "Conflict" && <p className="mt-0.5 text-red-700">File received, but the conflict stays open until someone checks it against the deck.</p>}
          <ul className="mt-1 space-y-0.5">
            {a.files.map((f) => (
              <li key={f.name + f.at} className="flex min-w-0">
                <FileName f={f} className="min-w-0" />
              </li>
            ))}
          </ul>
          {checked ? (
            <p className="mt-1 text-emerald-700">
              Checked by {checked.by.split(" ")[0]} on {fmtDay(checked.at)}
            </p>
          ) : (
            <button onClick={onCheck} className="mt-1.5 font-semibold text-indigo-700 hover:text-indigo-900">
              I&apos;ve checked it against the deck
            </button>
          )}
        </>
      )}
      {a?.state === "Don't have" && (
        <p className="text-slate-700">
          <span className="font-medium">Founder doesn&apos;t have it</span>
          {a.note ? `: “${a.note}”` : "."} Raise it on the call.
        </p>
      )}
      {a?.state === "Later" && (
        <p className="text-slate-700">
          <span className="font-medium">Founder will send it by {a.by ? fmtDay(a.by) : "a later date"}</span>
          {a.note ? `: “${a.note}”` : "."}
        </p>
      )}
    </div>
  );
}
