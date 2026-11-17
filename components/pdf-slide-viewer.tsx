"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "@/components/ui";
import type { KeyFact } from "@/lib/provenance";
import type { DealResult } from "@/lib/types";

interface CitationItem {
  id: string;
  kind: "conflict" | "fact";
  label: string;
  value: string;
  page: number;
  quote?: string | null;
}

export function PdfSlideViewer({
  isOpen,
  onClose,
  deal,
  deckUrl,
  facts,
  initialPage = 1,
}: {
  isOpen: boolean;
  onClose: () => void;
  deal: DealResult;
  deckUrl: string;
  facts: KeyFact[];
  initialPage?: number;
}) {
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setPage(Math.max(1, initialPage));
  }, [initialPage, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const citations = useMemo<CitationItem[]>(() => {
    const list: CitationItem[] = [];

    deal.flags.forEach((fl, i) => {
      fl.sources.forEach((s, j) => {
        if (s.page && s.page > 0) {
          list.push({
            id: `flag-${i}-${j}`,
            kind: "conflict",
            label: `${fl.title} (${s.label})`,
            value: s.value,
            page: s.page,
            quote: s.quote,
          });
        }
      });
    });

    facts.forEach((f, i) => {
      f.evidence.forEach((ev, j) => {
        if (ev.page && ev.page > 0) {
          list.push({
            id: `fact-${i}-${j}`,
            kind: f.status === "Conflict" ? "conflict" : "fact",
            label: f.label,
            value: ev.value || f.value,
            page: ev.page,
            quote: ev.quote,
          });
        }
      });
    });

    return list.sort((a, b) => (a.kind === "conflict" ? -1 : 1) - (b.kind === "conflict" ? -1 : 1) || a.page - b.page);
  }, [deal.flags, facts]);

  if (!isOpen) return null;

  const iframeSrc = `${deckUrl}#page=${page}&view=FitH`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pitch deck viewer for ${deal.form.companyName}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/75 backdrop-blur-xs sm:p-4"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-slate-200">
        {/* Top toolbar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">{deal.form.companyName} · Side-by-Side Deck Review</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800">
              Slide p.{page}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="cursor-pointer px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="border-x border-slate-200 px-2.5 py-1 font-mono text-xs text-slate-600">p.{page}</span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="cursor-pointer px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Next →
              </button>
            </div>
            <a
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open Raw PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </header>

        {/* Split Pane Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="relative min-h-[380px] bg-slate-900">
            <iframe
              key={`${deckUrl}-${page}`}
              src={iframeSrc}
              title={`${deal.form.companyName} Pitch Deck Page ${page}`}
              className="h-full w-full border-0"
            />
          </div>

          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Click-to-Citation Index ({citations.length})
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Select any extracted metric or conflict to jump directly to its source slide.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {citations.length === 0 ? (
                <div className="p-5 text-xs text-slate-500">
                  No page-level slide citations were extracted for this deck yet. Use Prev / Next above to browse pages.
                </div>
              ) : (
                citations.map((item) => {
                  const active = selectedId === item.id || (!selectedId && item.page === page);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setPage(item.page);
                      }}
                      className={cx(
                        "block w-full cursor-pointer px-4 py-3 text-left transition-colors",
                        active ? "bg-blue-50/70" : "hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cx(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            item.kind === "conflict" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {item.kind === "conflict" ? "Math Gap" : "Cited Fact"}
                        </span>
                        <span className="font-mono text-xs font-semibold text-blue-700">Jump to p.{item.page} →</span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-xs text-slate-700">{item.value}</p>
                      {item.quote && <p className="mt-1 text-[11px] italic text-slate-500">“{item.quote}”</p>}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
