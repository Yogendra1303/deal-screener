"use client";

import Link from "next/link";
import { useState } from "react";
import type { FlowRow } from "@/components/flow";
import { Avatar } from "@/components/shell";
import { useStore } from "@/components/store";
import { DropdownSelect, cx } from "@/components/ui";
import { usd } from "@/lib/rules";
import type { DealStatus } from "@/lib/types";

const COLUMNS: { status: DealStatus; label: string; accent: string; badge: string }[] = [
  { status: "New", label: "New Inbound", accent: "border-t-blue-600", badge: "bg-blue-50 text-blue-700" },
  { status: "Reviewing", label: "Reviewing", accent: "border-t-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  { status: "Meeting set", label: "Meeting Set", accent: "border-t-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  { status: "On hold", label: "On Hold", accent: "border-t-amber-500", badge: "bg-amber-50 text-amber-700" },
  { status: "Passed", label: "Passed", accent: "border-t-slate-400", badge: "bg-slate-100 text-slate-600" },
];

export function PipelineKanban({ rows, showOwners = true }: { rows: FlowRow[]; showOwners?: boolean }) {
  const store = useStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<DealStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function moveDeal(id: string, target: DealStatus) {
    setSavingId(id);
    store.setStatus(id, target);
    try {
      await fetch(`/api/deals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
    } catch {
      // store already persisted optimistically
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[980px] grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const colRows = rows.filter((r) => r.status === col.status);
          const isDropTarget = hoverCol === col.status;
          return (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverCol(col.status);
              }}
              onDragLeave={() => setHoverCol((cur) => (cur === col.status ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const dealId = e.dataTransfer.getData("text/plain") || draggingId;
                setHoverCol(null);
                setDraggingId(null);
                if (dealId) {
                  const found = rows.find((r) => r.id === dealId);
                  if (found && found.status !== col.status) {
                    void moveDeal(dealId, col.status);
                  }
                }
              }}
              className={cx(
                "flex min-h-[420px] flex-col rounded-xl border border-slate-200 border-t-[3px] bg-slate-50/80 p-2.5 transition-all",
                col.accent,
                isDropTarget && "ring-2 ring-blue-500 bg-blue-50/40",
              )}
            >
              <header className="mb-2.5 flex items-center justify-between gap-2 px-1">
                <h3 className="text-xs font-semibold text-slate-800">{col.label}</h3>
                <span className={cx("rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums", col.badge)}>
                  {colRows.length}
                </span>
              </header>

              <div className="flex-1 space-y-2">
                {colRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                    Drop pitch here
                  </div>
                ) : (
                  colRows.slice(0, 40).map((r) => {
                    const hasGap = Boolean(r.cover?.flags.some((f) => f.kind === "conflict"));
                    return (
                      <article
                        key={r.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", r.id);
                          setDraggingId(r.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setHoverCol(null);
                        }}
                        className={cx(
                          "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs active:cursor-grabbing",
                          draggingId === r.id && "opacity-50",
                          savingId === r.id && "ring-1 ring-blue-400",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link href={r.href} className="min-w-0 flex-1 text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                            <span className="inline-flex items-center gap-1.5">
                              {r.isLiveSubmission && (
                                <span title="Live pitch submission" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                              )}
                              <span className="truncate">{r.name}</span>
                            </span>
                          </Link>
                          {showOwners && r.owner && <Avatar name={r.owner} size="xs" />}
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {r.sector} · {r.stage}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {r.askUsd ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                              {usd(r.askUsd)}
                            </span>
                          ) : null}
                          {r.fit === "Strong" && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Strong Fit
                            </span>
                          )}
                          {hasGap && (
                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                              Math Gap
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                          <span className="text-[10px] text-slate-400">{r.last.slice(0, 10)}</span>
                          <DropdownSelect<DealStatus>
                            ariaLabel={`Move ${r.name} stage`}
                            size="xs"
                            align="right"
                            value={r.status}
                            onChange={(s) => void moveDeal(r.id, s)}
                            options={COLUMNS.map((opt) => opt.status)}
                          />
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
