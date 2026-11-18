"use client";

import Link from "next/link";
import { useState } from "react";
import type { FlowRow } from "@/components/flow";
import { Avatar } from "@/components/shell";
import { useStore } from "@/components/store";
import { DropdownSelect, cx } from "@/components/ui";
import { fmtDay } from "@/lib/dates";
import { usd } from "@/lib/rules";
import type { DealStatus } from "@/lib/types";

interface LaneConfig {
  status: DealStatus;
  label: string;
  dot: string;
  bar: string;
  badge: string;
  defaultCollapsed?: boolean;
}

const LANES: LaneConfig[] = [
  { status: "New", label: "New Inbound", dot: "bg-blue-600", bar: "border-l-blue-600", badge: "bg-blue-50 text-blue-700" },
  { status: "Reviewing", label: "Reviewing", dot: "bg-indigo-500", bar: "border-l-indigo-500", badge: "bg-indigo-50 text-indigo-700" },
  { status: "Meeting set", label: "Meeting Set", dot: "bg-emerald-500", bar: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  { status: "On hold", label: "On Hold", dot: "bg-amber-500", bar: "border-l-amber-500", badge: "bg-amber-50 text-amber-700" },
  { status: "Passed", label: "Passed", dot: "bg-slate-400", bar: "border-l-slate-400", badge: "bg-slate-100 text-slate-600", defaultCollapsed: true },
];

const PREVIEW_LIMIT = 4;

export function PipelineKanban({ rows, showOwners = true }: { rows: FlowRow[]; showOwners?: boolean }) {
  const store = useStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<DealStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [focusedLane, setFocusedLane] = useState<DealStatus | null>(null);
  const [expanded, setExpanded] = useState<Partial<Record<DealStatus, boolean>>>({});
  const [collapsed, setCollapsed] = useState<Partial<Record<DealStatus, boolean>>>({ Passed: true });

  async function moveDeal(id: string, target: DealStatus) {
    setSavingId(id);
    store.setStatus(id, target);
    // Ensure destination lane is visible so the user immediately sees the moved pitch
    setCollapsed((prev) => ({ ...prev, [target]: false }));
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

  function toggleExpand(status: DealStatus) {
    setCollapsed((prev) => ({ ...prev, [status]: false }));
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  }

  function toggleCollapse(status: DealStatus) {
    setCollapsed((prev) => {
      const next = !prev[status];
      if (next) setExpanded((e) => ({ ...e, [status]: false }));
      return { ...prev, [status]: next };
    });
  }

  const orderedLanes = focusedLane
    ? [...LANES.filter((l) => l.status === focusedLane), ...LANES.filter((l) => l.status !== focusedLane)]
    : LANES;

  return (
    <div className="space-y-3">
      {/* Compact Stage Jump & Drop Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stages</span>
          {LANES.map((lane) => {
            const count = rows.filter((r) => r.status === lane.status).length;
            const isFocused = focusedLane === lane.status;
            const isDrop = hoverLane === lane.status;
            return (
              <button
                key={lane.status}
                type="button"
                onClick={() => {
                  if (isFocused) {
                    setFocusedLane(null);
                  } else {
                    setFocusedLane(lane.status);
                    setCollapsed((prev) => ({ ...prev, [lane.status]: false }));
                    setExpanded((prev) => ({ ...prev, [lane.status]: true }));
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHoverLane(lane.status);
                }}
                onDragLeave={() => setHoverLane((cur) => (cur === lane.status ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  const dealId = e.dataTransfer.getData("text/plain") || draggingId;
                  setHoverLane(null);
                  setDraggingId(null);
                  if (dealId) {
                    const found = rows.find((r) => r.id === dealId);
                    if (found && found.status !== lane.status) void moveDeal(dealId, lane.status);
                  }
                }}
                className={cx(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                  isDrop
                    ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20"
                    : isFocused
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100",
                )}
                title={`Click to open ${lane.label} at the top, or drop a pitch card here`}
              >
                <span className={cx("h-1.5 w-1.5 rounded-full", lane.dot)} />
                <span>{lane.label}</span>
                <span className={cx("font-mono text-[11px] font-bold tabular-nums", isFocused ? "text-slate-300" : "text-slate-400")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {focusedLane && (
          <button
            type="button"
            onClick={() => setFocusedLane(null)}
            className="cursor-pointer text-xs font-medium text-blue-700 hover:underline"
          >
            Reset stage order
          </button>
        )}
      </div>

      {/* Horizontal Collapsible & Expandable Swimlanes */}
      {orderedLanes.map((lane) => {
        const laneRows = rows.filter((r) => r.status === lane.status);
        const isCollapsed = Boolean(collapsed[lane.status]);
        const isExpanded = Boolean(expanded[lane.status]);
        const isDropTarget = hoverLane === lane.status;
        const visibleRows = isCollapsed ? [] : isExpanded ? laneRows : laneRows.slice(0, PREVIEW_LIMIT);
        const hiddenCount = Math.max(0, laneRows.length - PREVIEW_LIMIT);

        return (
          <section
            key={lane.status}
            aria-label={lane.label}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverLane(lane.status);
            }}
            onDragLeave={() => setHoverLane((cur) => (cur === lane.status ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              const dealId = e.dataTransfer.getData("text/plain") || draggingId;
              setHoverLane(null);
              setDraggingId(null);
              if (dealId) {
                const found = rows.find((r) => r.id === dealId);
                if (found && found.status !== lane.status) void moveDeal(dealId, lane.status);
              }
            }}
            className={cx(
              "overflow-hidden rounded-xl border border-slate-200/90 border-l-[3px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all",
              lane.bar,
              isDropTarget && "ring-2 ring-blue-500 bg-blue-50/30",
            )}
          >
            {/* Swimlane Header */}
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <button
                type="button"
                onClick={() => toggleCollapse(lane.status)}
                className="flex cursor-pointer items-center gap-2 text-left"
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cx("h-3.5 w-3.5 text-slate-400 transition-transform", !isCollapsed && "rotate-90")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                <span className={cx("h-2 w-2 rounded-full", lane.dot)} />
                <h3 className="text-xs font-semibold text-slate-900">{lane.label}</h3>
                <span className={cx("rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums", lane.badge)}>
                  {laneRows.length}
                </span>
                {isDropTarget && (
                  <span className="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Drop to move here
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                {laneRows.length > PREVIEW_LIMIT && !isCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(lane.status)}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    {isExpanded ? "Show less" : `See more (+${hiddenCount})`}
                  </button>
                )}
                {isCollapsed && laneRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(lane.status)}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
                  >
                    Expand ({laneRows.length})
                  </button>
                )}
                {!isCollapsed && laneRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(lane.status)}
                    className="cursor-pointer px-1 text-[11px] font-medium text-slate-400 hover:text-slate-700"
                  >
                    Hide
                  </button>
                )}
              </div>
            </header>

            {/* Horizontal 4-Card Grid (Clean Row, Zero Vertical Clutter) */}
            {!isCollapsed && (
              <div className="p-3">
                {laneRows.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
                    No pitches in {lane.label.toLowerCase()} — drag any pitch card here to move it.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {visibleRows.map((r) => {
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
                              setHoverLane(null);
                            }}
                            className={cx(
                              "flex cursor-grab flex-col justify-between rounded-lg border border-slate-200/90 bg-white p-3 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs active:cursor-grabbing",
                              r.isLiveSubmission && r.status === "New" && "border-blue-200/90 bg-blue-50/20",
                              draggingId === r.id && "opacity-50",
                              savingId === r.id && "ring-1 ring-blue-400",
                            )}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={r.href}
                                  className="min-w-0 flex-1 text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                                >
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
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                              <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-slate-400">
                                {fmtDay(r.last)}
                              </span>
                              <DropdownSelect<DealStatus>
                                ariaLabel={`Move ${r.name} stage`}
                                size="xs"
                                align="right"
                                value={r.status}
                                onChange={(s) => void moveDeal(r.id, s)}
                                options={LANES.map((opt) => opt.status)}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {hiddenCount > 0 && !isExpanded && (
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleExpand(lane.status)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <span>See all {laneRows.length} in {lane.label}</span>
                          <span className="font-mono text-[11px] text-slate-400">(+{hiddenCount} more)</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
