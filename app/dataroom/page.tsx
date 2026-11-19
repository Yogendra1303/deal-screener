"use client";

// Fund-wide Data Room: clean 3-tab enterprise vault with Company Vault, Incoming Files feed,
// Team Backlog, inline owner assignment, document preview, and Company Quick-Detail Drawer.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { NumButton, TileIcon, usePanels, type TileSpec } from "@/components/cards";
import { DocDrawer, MICRO, useDocs } from "@/components/docs";
import { FileName, useDataRoom, type RoomFile, type RoomRow } from "@/components/founder-links";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { AiText, ChannelChip, FileIt, roomTiles, useCanAct } from "@/components/room";
import { Avatar } from "@/components/shell";
import { Button, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FOLDERS, TO_FILE } from "@/lib/dataroom";
import { addDays, fmtDay } from "@/lib/dates";
import type { DocCode, SourceDoc } from "@/lib/docs";
import { PITCH_INBOX, linkPath } from "@/lib/links";
import { usd } from "@/lib/rules";
import { ANALYSTS, PARTNER } from "@/lib/team";

type RoomTab = "vault" | "files" | "backlog";
type FeedFilter = "all" | "new_pitch" | "unassigned" | "to_file" | "diligence";
type DirScope = "all" | "pitch" | "portfolio" | "unassigned";

export default function DataRoomPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading data room…</p>}>
      <DataRoomContent />
    </Suspense>
  );
}

function DataRoomContent() {
  const searchParams = useSearchParams();
  const w = useWorkspace();
  const links = useLinks();
  const p = usePortfolio();
  const all = useDataRoom();
  const canAct = useCanAct();
  const docsFor = useDocs();
  const panels = usePanels();

  const partner = w.role === "Partner";
  const currentUserName = w.userName || w.me || PARTNER.name;
  const rows = useMemo(() => (partner ? all : all.filter((r) => r.owner === w.me)), [all, partner, w.me]);
  const unpicked = useMemo(() => (partner ? [] : all.filter((r) => r.side === "pitch" && !r.owner)), [all, partner]);
  const visibleRows = useMemo(() => (partner ? rows : [...rows, ...unpicked]), [partner, rows, unpicked]);

  const ownerChoices = useMemo(() => {
    const names = [currentUserName, ...ANALYSTS.map((a) => a.name), PARTNER.name];
    return [...new Set(names.filter(Boolean))];
  }, [currentUserName]);

  const [activeTab, setActiveTab] = useState<RoomTab>("vault");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [feedWindow, setFeedWindow] = useState<"all" | "7d">("all");
  const [feedQuery, setFeedQuery] = useState("");
  const [showAllFeed, setShowAllFeed] = useState(false);

  const [dirScope, setDirScope] = useState<DirScope>("all");
  const [dirOwner, setDirOwner] = useState<string>("all");
  const [dirQuery, setDirQuery] = useState("");
  const [showRoutes, setShowRoutes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ name: string; docs: SourceDoc[]; start: number } | null>(null);
  const closeDocPreview = useCallback(() => setDocPreview(null), []);
  const closeInspect = useCallback(() => setInspectId(null), []);

  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "unassigned") {
      setActiveTab("vault");
      setDirScope("unassigned");
      setFeedFilter("unassigned");
    }
  }, [searchParams]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const assignOwner = useCallback(
    (r: RoomRow, owner: string) => {
      if (r.side === "pitch") links.claim(r.id, owner);
      else p.setOwner(r.id, owner);
      showToast(owner ? `Assigned ${r.name} to ${owner}.` : `Moved ${r.name} to Unassigned.`);
    },
    [links, p, showToast],
  );

  const tiles = useMemo(
    () => roomTiles(visibleRows, canAct, w.me, links.markChecked),
    [visibleRows, canAct, w.me, links.markChecked],
  );
  const unassignedCount = useMemo(
    () => visibleRows.filter((r) => r.side === "pitch" && !r.owner).length,
    [visibleRows],
  );
  const lateWaitingCount = useMemo(
    () => visibleRows.reduce((n, r) => n + r.missing.filter((m) => m.answer !== "Don't have" && m.overdue).length, 0),
    [visibleRows],
  );

  const freshTile = tiles[0];
  const toFileTile = tiles[1];
  const waitingTile = tiles[2];
  const aiTile = tiles[3];

  const feedItems = useMemo(() => {
    const since = addDays(links.today, -7);
    const q = feedQuery.trim().toLowerCase();
    const list: { r: RoomRow; f: RoomFile }[] = [];
    for (const r of visibleRows) {
      for (const f of r.shared) {
        if (feedWindow === "7d" && f.at <= since) continue;
        const isNewPitch = f.what === "Pitch deck" && r.side === "pitch";
        const isDiligence = f.channel === "Request link" || f.channel === "Email" || f.channel === "Founder portal";
        if (feedFilter === "new_pitch" && !isNewPitch) continue;
        if (feedFilter === "unassigned" && r.owner) continue;
        if (feedFilter === "to_file" && f.folder !== TO_FILE) continue;
        if (feedFilter === "diligence" && !isDiligence) continue;
        if (
          q &&
          !`${r.name} ${r.sector} ${r.stage} ${r.founder} ${f.name} ${f.what} ${f.channel} ${r.owner ?? "unassigned"}`
            .toLowerCase()
            .includes(q)
        ) {
          continue;
        }
        list.push({ r, f });
      }
    }
    return list.sort((a, b) => (b.f.at ?? "").localeCompare(a.f.at ?? "") || (a.r.name ?? "").localeCompare(b.r.name ?? ""));
  }, [visibleRows, links.today, feedWindow, feedFilter, feedQuery]);

  const dirRows = useMemo(() => {
    const q = dirQuery.trim().toLowerCase();
    return visibleRows
      .filter((r) => {
        if (dirScope === "pitch" && r.side !== "pitch") return false;
        if (dirScope === "portfolio" && r.side !== "portfolio") return false;
        if (dirScope === "unassigned" && r.owner) return false;
        if (dirOwner === "unassigned" && r.owner) return false;
        if (dirOwner !== "all" && dirOwner !== "unassigned" && r.owner !== dirOwner) return false;
        if (
          q &&
          !`${r.name} ${r.sector} ${r.stage} ${r.founder} ${r.country} ${r.owner ?? "unassigned"}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aUn = Number(a.side === "pitch" && !a.owner);
        const bUn = Number(b.side === "pitch" && !b.owner);
        if (aUn !== bUn) return bUn - aUn;
        if (b.newCount !== a.newCount) return b.newCount - a.newCount;
        return (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "") || a.name.localeCompare(b.name);
      });
  }, [visibleRows, dirScope, dirOwner, dirQuery]);

  const inspectedRow = useMemo(
    () => (inspectId ? visibleRows.find((r) => r.id === inspectId) ?? null : null),
    [inspectId, visibleRows],
  );

  const jumpToUnassignedVault = () => {
    setActiveTab("vault");
    setDirScope("unassigned");
    setDirOwner("all");
  };

  if (!links.ready) return <p className="text-sm text-slate-500">Loading data room…</p>;

  const shownFeed = showAllFeed ? feedItems : feedItems.slice(0, 15);
  const totalFilesCount = visibleRows.reduce((s, r) => s + r.shared.length, 0);

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Fund Operations · Document &amp; Intake Vault
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            {partner ? "Data room" : "Your data room"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {partner
              ? "Structured vault of every incoming pitch, founder upload, and diligence folder. Assign owners inline or inspect any record."
              : "Your assigned companies, unclaimed incoming pitches, and founder files waiting on review."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoutes((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {showRoutes ? "Hide intake routes" : "How files arrive"}
          </button>
          <Link
            href="/upload"
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-slate-800"
          >
            + Upload Pitch
          </Link>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-2xs"
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {showRoutes && <IntakeRoutesStrip />}

      {/* 4 Balanced, Non-Truncated KPI Tiles */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <button
          type="button"
          onClick={jumpToUnassignedVault}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md",
            unassignedCount > 0 ? "border-amber-300 ring-1 ring-amber-200/70" : "border-slate-200 hover:border-blue-300",
          )}
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="truncate">Unassigned pitches</span>
            {unassignedCount > 0 && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Assign</span>
            )}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {unassignedCount}
            <span className="ml-1 font-sans text-xs font-medium text-slate-400">decks</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 group-hover:text-blue-700">
            {unassignedCount > 0 ? "Assign an analyst or partner →" : "All incoming pitches assigned"}
          </p>
        </button>

        {[
          {
            spec: freshTile,
            label: "New from founders",
            unit: freshTile.count === 1 ? "file" : "files",
            sub: freshTile.count > 0 ? "Uploaded via request links →" : "All founder files reviewed",
            badge: freshTile.count > 0 ? "Review" : null,
            badgeTone: "bg-blue-50 text-blue-700",
          },
          {
            spec: toFileTile,
            label: "To file",
            unit: toFileTile.count === 1 ? "file" : "files",
            sub: toFileTile.count > 0 ? "Email & portal attachments →" : "All attachments filed",
            badge: toFileTile.count > 0 ? "Action" : null,
            badgeTone: "bg-amber-100 text-amber-900",
          },
          {
            spec: waitingTile,
            label: "Waiting on founders",
            unit: waitingTile.count === 1 ? "item" : "items",
            sub: waitingTile.count > 0 ? "Open requests & MIS items →" : "Nothing owed by founders",
            badge: lateWaitingCount > 0 ? `${lateWaitingCount} late` : null,
            badgeTone: "bg-rose-100 text-rose-800",
          },
        ].map(({ spec, label, unit, sub, badge, badgeTone }) => {
          const empty = spec.count === 0;
          return (
            <button
              key={spec.key}
              type="button"
              onClick={() => panels.open(spec.key)}
              className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="flex min-w-0 items-center gap-1.5">
                  <TileIcon name={spec.icon} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{label}</span>
                </span>
                {badge && (
                  <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold", badgeTone)}>{badge}</span>
                )}
              </div>
              <div className={cx("mt-2 font-mono text-2xl font-bold tabular-nums", empty ? "text-slate-300" : "text-slate-900")}>
                {spec.count}
                <span className="ml-1 font-sans text-xs font-medium text-slate-400">{unit}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 group-hover:text-blue-700">{sub}</p>
            </button>
          );
        })}
      </div>

      {/* Primary Segmented Workspace Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div
          className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/90 p-1 text-xs font-semibold"
          role="tablist"
          aria-label="Data room views"
        >
          {(
            [
              ["vault", `Company Vault (${visibleRows.length})`],
              ["files", `Incoming Files (${totalFilesCount})`],
              ["backlog", partner ? "Team Backlog" : "Your To-Do"],
            ] as [RoomTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={activeTab === k}
              onClick={() => setActiveTab(k)}
              className={cx(
                "cursor-pointer rounded-lg px-3.5 py-1.5 transition-colors",
                activeTab === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => panels.open(aiTile.key)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span className="font-mono font-semibold text-slate-900">{aiTile.count}</span>
          <span>waiting for AI →</span>
        </button>
      </div>

      {/* TAB 1: COMPANY VAULT (1 Clean Row per Company, Zero Duplication) */}
      {activeTab === "vault" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  ["all", `All (${visibleRows.length})`],
                  ["pitch", `Pitches (${visibleRows.filter((r) => r.side === "pitch").length})`],
                  ["portfolio", `Portfolio (${visibleRows.filter((r) => r.side === "portfolio").length})`],
                  ["unassigned", `Unassigned (${unassignedCount})`],
                ] as [DirScope, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDirScope(k)}
                  className={cx(
                    "cursor-pointer rounded-md border px-2.5 py-1 font-medium transition-colors",
                    dirScope === k
                      ? "border-slate-900 bg-slate-900 text-white shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownSelect
                ariaLabel="Filter by owner"
                value={dirOwner}
                onChange={setDirOwner}
                options={[
                  { value: "all", label: "All owners" },
                  { value: "unassigned", label: "Unassigned" },
                  ...ownerChoices.map((n) => ({ value: n, label: n })),
                ]}
                size="sm"
              />
              <input
                type="search"
                value={dirQuery}
                onChange={(e) => setDirQuery(e.target.value)}
                placeholder="Search company, founder…"
                className="w-52 max-w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {dirRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              <p>No companies match these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setDirScope("all");
                  setDirOwner("all");
                  setDirQuery("");
                }}
                className="mt-2 cursor-pointer text-xs font-semibold text-blue-600 hover:underline"
              >
                Reset filters →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="px-5 py-3">Company &amp; Founder</th>
                    <th className="w-24 px-4 py-3">Received</th>
                    <th className="w-48 px-4 py-3">Source Files</th>
                    <th className="w-52 px-4 py-3">Diligence Coverage</th>
                    <th className="w-44 px-4 py-3">Assigned To</th>
                    <th className="w-36 px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/75">
                  {dirRows.map((r) => {
                    const docs = r.side === "pitch" ? docsFor(r.id) : [];
                    const misCount = r.shared.filter((x) => x.folder === "reports").length;
                    const heldCount = r.shared.filter((x) => x.folder !== TO_FILE).length;
                    const dueCount = r.missing.filter((m) => m.answer !== "Don't have").length;
                    const canAssign = partner || (r.side === "pitch" && !r.owner);
                    const folderSummary = FOLDERS.filter((f) => r.side === "portfolio" || f.id !== "reports")
                      .map((f) => {
                        const n = r.shared.filter((x) => x.folder === f.id).length;
                        const owed = r.missing.filter((m) => m.folder === f.id && m.answer !== "Don't have").length;
                        return `${f.n}. ${f.name.split(" ")[0]}: ${n}${owed ? ` (${owed} due)` : ""}`;
                      })
                      .join(" · ");

                    return (
                      <tr
                        key={r.id}
                        className={cx(
                          "transition-colors hover:bg-blue-50/30",
                          r.side === "pitch" && !r.owner ? "bg-amber-50/25" : "even:bg-slate-50/35",
                        )}
                      >
                        <td className="max-w-[280px] px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectId(r.id)}
                              className="cursor-pointer truncate text-left font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {r.name}
                            </button>
                            <span
                              className={cx(
                                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                r.side === "portfolio" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {r.side === "pitch" ? "Pitch" : "Portfolio"}
                            </span>
                            {r.newCount > 0 && (
                              <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {r.newCount} new
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-0.5 truncate text-xs text-slate-500"
                            title={`${r.sector} · ${r.stage}${r.askUsd ? ` · ${usd(r.askUsd)}` : ""} · ${r.founder}`}
                          >
                            {r.sector} · {r.stage}
                            {r.askUsd ? ` · ${usd(r.askUsd)}` : ""} · {r.founder}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 align-middle font-mono text-xs tabular-nums text-slate-600">
                          {fmtDay(r.receivedAt)}
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          {r.side === "pitch" ? (
                            <CompactDocStrip
                              docs={docs}
                              onOpen={(idx) => setDocPreview({ name: r.name, docs, start: idx })}
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/dataroom/${r.id}#company`}
                                className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-700 hover:border-slate-400 hover:bg-white"
                              >
                                DECK
                              </Link>
                              <Link
                                href={`/dataroom/${r.id}#reports`}
                                className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-800 hover:bg-emerald-100"
                              >
                                {misCount} MIS
                              </Link>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-middle" title={folderSummary}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cx(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                                dueCount > 0
                                  ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"
                                  : heldCount > 0
                                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                                    : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {heldCount} {heldCount === 1 ? "file" : "files"}
                              {dueCount > 0 ? ` · ${dueCount} due` : ""}
                            </span>
                            {r.toFile > 0 && (
                              <Link
                                href={`/dataroom/${r.id}#to-file`}
                                className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-900 hover:bg-amber-200"
                              >
                                {r.toFile} to file
                              </Link>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                          {canAssign ? (
                            <DropdownSelect
                              ariaLabel={`Assign owner for ${r.name}`}
                              value={r.owner ?? ""}
                              placeholder="Unassigned"
                              tone={!r.owner ? "warn" : "default"}
                              onChange={(next) => assignOwner(r, next)}
                              options={[
                                ...(r.side === "pitch" ? [{ value: "", label: "Unassigned" }] : []),
                                ...ownerChoices.map((n) => ({ value: n, label: n })),
                              ]}
                              align="right"
                              size="xs"
                              className="w-36"
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              {r.owner ? (
                                <>
                                  <Avatar name={r.owner} size="xs" /> {r.owner.split(" ")[0]}
                                </>
                              ) : (
                                <span className="font-semibold text-amber-700">Unassigned</span>
                              )}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectId(r.id)}
                              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:text-blue-700"
                            >
                              Inspect
                            </button>
                            <Link
                              href={`/dataroom/${r.id}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              Room →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/70 px-5 py-2.5 text-xs text-slate-500">
            <span>Showing {dirRows.length} of {visibleRows.length} records</span>
            <span>Click any company or Inspect to view founder details, all files, and 6-folder diligence status.</span>
          </div>
        </section>
      )}

      {/* TAB 2: INCOMING FILES ACTIVITY FEED (Clean Columns, Zero Collision) */}
      {activeTab === "files" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  ["all", "All files"],
                  ["new_pitch", "Pitch decks"],
                  ["unassigned", "Unassigned"],
                  ["to_file", "To file"],
                  ["diligence", "Diligence uploads"],
                ] as [FeedFilter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFeedFilter(k)}
                  className={cx(
                    "cursor-pointer rounded-md border px-2.5 py-1 font-medium transition-colors",
                    feedFilter === k
                      ? "border-slate-900 bg-slate-900 text-white shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
                {(
                  [
                    ["all", "All dates"],
                    ["7d", "Last 7d"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFeedWindow(k)}
                    className={cx(
                      "cursor-pointer rounded px-2 py-1 font-medium transition-colors",
                      feedWindow === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={feedQuery}
                onChange={(e) => setFeedQuery(e.target.value)}
                placeholder="Filter company, file, founder…"
                className="w-52 max-w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {shownFeed.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">No files match these filters.</p>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    <th className="w-20 px-4 py-3">Date</th>
                    <th className="w-56 px-4 py-3">Company</th>
                    <th className="px-4 py-3">File &amp; Context</th>
                    <th className="w-36 px-4 py-3">Route</th>
                    <th className="w-40 px-4 py-3">Owner</th>
                    <th className="w-36 px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/75">
                  {shownFeed.map(({ r, f }) => {
                    const isDeck = f.what === "Pitch deck" && r.side === "pitch";
                    const canAssign = partner || (r.side === "pitch" && !r.owner);
                    return (
                      <tr
                        key={`${r.id}:${f.key}`}
                        className="transition-colors even:bg-slate-50/35 hover:bg-blue-50/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle font-mono text-xs tabular-nums text-slate-500">
                          {fmtDay(f.at)}
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectId(r.id)}
                              className="cursor-pointer truncate text-left font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {r.name}
                            </button>
                            {f.folder === TO_FILE ? (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                                To file
                              </span>
                            ) : f.isNew ? (
                              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                New
                              </span>
                            ) : isDeck ? (
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                Deck
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {r.stage}
                            {r.askUsd ? ` · ${usd(r.askUsd)}` : ""} · {r.founder}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          <div className="min-w-0">
                            <FileName f={f.file} href={f.href} name={f.name} className="block truncate text-sm font-medium" />
                            <p className="mt-0.5 truncate text-xs text-slate-500" title={f.what}>
                              {f.what}
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                          <ChannelChip c={f.channel} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                          {canAssign ? (
                            <DropdownSelect
                              ariaLabel={`Assign owner for ${r.name}`}
                              value={r.owner ?? ""}
                              placeholder="Unassigned"
                              tone={!r.owner ? "warn" : "default"}
                              onChange={(next) => assignOwner(r, next)}
                              options={[
                                ...(r.side === "pitch" ? [{ value: "", label: "Unassigned" }] : []),
                                ...ownerChoices.map((n) => ({ value: n, label: n })),
                              ]}
                              size="xs"
                              className="w-36"
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                              {r.owner ? (
                                <>
                                  <Avatar name={r.owner} size="xs" /> {r.owner.split(" ")[0]}
                                </>
                              ) : (
                                <span className="font-semibold text-amber-700">Unassigned</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-2">
                            {f.isNew && f.check && canAct(r) ? (
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                onClick={() => {
                                  links.markChecked(f.check!.reqId, f.check!.itemId, w.me);
                                  showToast(`Marked ${f.name} as checked.`);
                                }}
                              >
                                Check
                              </Button>
                            ) : null}
                            <Link
                              href={`/dataroom/${r.id}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                            >
                              Room →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {feedItems.length > 15 && (
            <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-2.5 text-center">
              <button
                type="button"
                onClick={() => setShowAllFeed((v) => !v)}
                className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {showAllFeed ? "Show latest 15 files" : `Show all ${feedItems.length} files`}
              </button>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: TEAM BACKLOG / ANALYST TO-DO */}
      {activeTab === "backlog" && (
        partner ? <ByAnalyst rows={all} onFilterUnassigned={jumpToUnassignedVault} /> : <ToDo rows={rows} />
      )}

      {/* Drawers */}
      {panels.render(tiles)}
      {inspectedRow && (
        <RoomQuickDrawer
          row={inspectedRow}
          docs={inspectedRow.side === "pitch" ? docsFor(inspectedRow.id) : []}
          canAssign={partner || (inspectedRow.side === "pitch" && !inspectedRow.owner)}
          canAct={canAct(inspectedRow)}
          ownerChoices={ownerChoices}
          onAssign={(owner) => assignOwner(inspectedRow, owner)}
          onMarkChecked={(reqId, itemId, fileName) => {
            links.markChecked(reqId, itemId, w.me);
            showToast(`Marked ${fileName} as checked.`);
          }}
          onPreviewDoc={(idx, docs) => setDocPreview({ name: inspectedRow.name, docs, start: idx })}
          onClose={closeInspect}
        />
      )}
      {docPreview && <DocDrawer name={docPreview.name} docs={docPreview.docs} start={docPreview.start} onClose={closeDocPreview} />}
    </div>
  );
}

/** Single-row source file badge strip (never wraps into jagged multi-line piles). */
function CompactDocStrip({ docs, onOpen }: { docs: SourceDoc[]; onOpen: (idx: number) => void }) {
  const unique: { doc: SourceDoc; index: number }[] = [];
  const seen = new Set<DocCode>();
  docs.forEach((doc, index) => {
    if (!seen.has(doc.code)) {
      seen.add(doc.code);
      unique.push({ doc, index });
    }
  });
  const shown = unique.slice(0, 3);
  const extra = unique.length - shown.length;
  if (!unique.length) return <span className="text-xs text-slate-400">No files</span>;
  return (
    <div className="flex items-center gap-1">
      {shown.map(({ doc, index }) => (
        <button
          key={doc.code}
          type="button"
          onClick={() => onOpen(index)}
          title={`${doc.title}: ${doc.fileName}. Click to preview or download.`}
          className={cx(MICRO, "cursor-pointer hover:border-blue-400 hover:bg-white hover:text-blue-700")}
        >
          {doc.code}
        </button>
      ))}
      {extra > 0 && (
        <button
          type="button"
          onClick={() => onOpen(shown.length)}
          title={`View all ${unique.length} source files`}
          className="inline-flex cursor-pointer items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-slate-600 hover:border-blue-400 hover:text-blue-700"
        >
          +{extra}
        </button>
      )}
    </div>
  );
}

/** Clean enterprise right-side slide-over drawer showing full company & pitch details, files, and diligence coverage. */
function RoomQuickDrawer({
  row,
  docs,
  canAssign,
  canAct,
  ownerChoices,
  onAssign,
  onMarkChecked,
  onPreviewDoc,
  onClose,
}: {
  row: RoomRow;
  docs: SourceDoc[];
  canAssign: boolean;
  canAct: boolean;
  ownerChoices: string[];
  onAssign: (owner: string) => void;
  onMarkChecked: (reqId: string, itemId: string, fileName: string) => void;
  onPreviewDoc: (idx: number, docs: SourceDoc[]) => void;
  onClose: () => void;
}) {
  const [copiedInbox, setCopiedInbox] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const folders = FOLDERS.filter((f) => row.side === "portfolio" || f.id !== "reports");
  const waiting = row.missing.filter((m) => m.answer !== "Don't have");

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="room-drawer-title">
      <button type="button" onClick={onClose} aria-label="Close drawer" className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="room-drawer-title" className="truncate text-lg font-semibold text-slate-900">
                  {row.name}
                </h2>
                <span
                  className={cx(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    row.side === "portfolio" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700",
                  )}
                >
                  {row.side === "pitch" ? `Pitch · ${row.status}` : "Portfolio"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {row.sector} · {row.stage}
                {row.askUsd ? ` · ${usd(row.askUsd)}` : ""} · {row.country}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Link
              href={`/dataroom/${row.id}`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Open full data room →
            </Link>
            <Link
              href={row.href}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open {row.side === "pitch" ? "pitch review" : "company page"} →
            </Link>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Founder & Assignment Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Founder</p>
                <p className="mt-0.5 font-semibold text-slate-900">{row.founder}</p>
                <p className="truncate text-slate-500">{row.email}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assigned Owner</p>
                <div className="mt-1">
                  {canAssign ? (
                    <DropdownSelect
                      ariaLabel={`Assign owner for ${row.name}`}
                      value={row.owner ?? ""}
                      placeholder="Unassigned"
                      tone={!row.owner ? "warn" : "default"}
                      onChange={onAssign}
                      options={[
                        ...(row.side === "pitch" ? [{ value: "", label: "Unassigned" }] : []),
                        ...ownerChoices.map((n) => ({ value: n, label: n })),
                      ]}
                      size="xs"
                      className="w-full"
                    />
                  ) : (
                    <span className="font-semibold text-slate-900">{row.owner ?? "Unassigned"}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-slate-500">Company upload inbox: </span>
                <span className="font-mono text-slate-800">{row.inbox}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(row.inbox).then(
                    () => {
                      setCopiedInbox(true);
                      window.setTimeout(() => setCopiedInbox(false), 1800);
                    },
                    () => undefined,
                  )
                }
                className="shrink-0 cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                {copiedInbox ? "Copied ✓" : "Copy inbox"}
              </button>
            </div>
          </section>

          {/* Source Documents Quick Preview */}
          {docs.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Source Documents ({docs.length})
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {docs.map((d, idx) => (
                  <button
                    key={d.fileName}
                    type="button"
                    onClick={() => onPreviewDoc(idx, docs)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-white hover:text-blue-700"
                  >
                    <span className="font-mono text-[10px] font-bold uppercase text-slate-500">{d.code}</span>
                    <span>{d.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* All Received Files for This Company */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Received Files ({row.shared.length})
              </h3>
            </div>
            {row.shared.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">No files received yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {row.shared.map((f) => (
                  <li key={f.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FileName f={f.file} href={f.href} name={f.name} className="truncate text-sm font-medium" />
                        {f.folder === TO_FILE && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                            To file
                          </span>
                        )}
                        {f.isNew && f.folder !== TO_FILE && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{f.what}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <ChannelChip c={f.channel} />
                        <span>{fmtDay(f.at)}</span>
                        <span>·</span>
                        <AiText s={f.ai} />
                      </p>
                    </div>
                    {f.isNew && f.check && canAct && (
                      <Button
                        variant="secondary"
                        className="shrink-0 px-2.5 py-1 text-xs"
                        onClick={() => onMarkChecked(f.check!.reqId, f.check!.itemId, f.name)}
                      >
                        Mark checked
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 6-Folder Diligence Breakdown */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diligence Folders</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {folders.map((f) => {
                const n = row.shared.filter((x) => x.folder === f.id).length;
                const owed = row.missing.filter((m) => m.folder === f.id && m.answer !== "Don't have").length;
                return (
                  <Link
                    key={f.id}
                    href={`/dataroom/${row.id}#${f.id}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs transition-colors hover:border-blue-300 hover:bg-white"
                  >
                    <p className="font-semibold text-slate-800">
                      {f.n}. {f.name.split(" ")[0]}
                    </p>
                    <p className={cx("mt-1 font-mono text-[11px] font-semibold", owed ? "text-amber-800" : n ? "text-emerald-700" : "text-slate-400")}>
                      {n} held{owed ? ` · ${owed} due` : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Waiting on Founder */}
          {waiting.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-2xs">
              <div className="border-b border-rose-100 bg-rose-50/60 px-4 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                  Waiting on Founder ({waiting.length})
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {waiting.map((m) => (
                  <li key={m.key} className="px-4 py-2.5 text-xs">
                    <p className="font-semibold text-slate-900">{m.label}</p>
                    <p className={cx("mt-0.5", m.overdue ? "font-medium text-rose-700" : "text-slate-500")}>{m.meta}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function IntakeRoutesStrip() {
  const routes: [string, string][] = [
    ["1. Pitch link", "Public form on the website or an analyst link. Lands here, on Pitches, and on Home."],
    ["2. Pitch email", `Decks emailed to ${PITCH_INBOX} become a new pitch automatically.`],
    ["3. Request link", "Analyst requests documents; founders upload on one page without sign-up."],
    ["4. Company inbox", "Each company gets a dedicated email address; attachments queue under To file."],
    ["5. Founder portal", "Founders sign in by email to view open asks and monthly MIS schedules."],
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">How files reach the fund</h2>
          <p className="text-xs text-slate-500">Founders never see the internal dashboard. Every upload and email lands in this room.</p>
        </div>
        <Link href="/method" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
          How numbers work →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {routes.map(([title, desc]) => (
          <div key={title} className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="mt-1 leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Partner: who is behind on founder files, one row per owner. Each number opens the drawer behind it. */
function ByAnalyst({ rows, onFilterUnassigned }: { rows: RoomRow[]; onFilterUnassigned: () => void }) {
  const links = useLinks();
  const canAct = useCanAct();
  const w = useWorkspace();
  const panels = usePanels();
  const specs: TileSpec[] = [];
  const ownerNames = [
    ...new Set([
      ...ANALYSTS.map((a) => a.name),
      ...rows.map((r) => r.owner).filter((o): o is string => Boolean(o)),
    ]),
    "",
  ];
  const data = ownerNames.map((name) => {
    const mine = rows.filter((r) => (r.owner ?? "") === name);
    const t = roomTiles(mine, canAct, w.me, links.markChecked).map((x) => ({
      ...x,
      key: `${name || "nobody"}:${x.key}`,
      title: `${x.title.split(" · ")[0]}: ${name ? name.split(" ")[0] : "unassigned"}`,
    }));
    const waitingSpec = t[2];
    const lateEntries = (waitingSpec.entries ?? []).filter((e) => e.tone !== "info");
    const lateSpec: TileSpec = {
      ...waitingSpec,
      key: `${name || "nobody"}:late`,
      title: `Late from founders: ${name ? name.split(" ")[0] : "unassigned"}`,
      count: lateEntries.length,
      tone: lateEntries.length ? "urgent" : "info",
      explain: "Things the fund asked for that are past the reply-by date and still haven't arrived.",
      clear: "Nothing is late.",
      how: "Only request lines past the reply-by date the analyst set (7 days by default), and monthly reports past day 15 of the next month.",
      entries: lateEntries,
    };
    specs.push(...t, lateSpec);
    return { name, companies: mine.length, t, late: lateSpec };
  });
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Team data room backlog</h2>
        <p className="text-xs text-slate-500">Files waiting on each team member, and what founders still owe them. Click any count to inspect.</p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-5 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Companies</th>
              <th className="px-4 py-3 text-right">New to check</th>
              <th className="px-4 py-3 text-right">To file</th>
              <th className="px-4 py-3 text-right">Waiting</th>
              <th className="px-4 py-3 text-right">Late</th>
              <th className="px-5 py-3 text-right">Not read by AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/75">
            {data
              .filter((d) => d.companies > 0)
              .map((d) => {
                const [fresh, toFile, waiting, ai] = d.t;
                return (
                  <tr key={d.name || "nobody"} className="transition-colors even:bg-slate-50/35 hover:bg-blue-50/30">
                    <td className="px-5 py-3.5 align-middle">
                      {d.name ? (
                        <Link
                          href={
                            ANALYSTS.some((a) => a.name === d.name)
                              ? `/team?who=${d.name.split(" ")[0].toLowerCase()}`
                              : "/team"
                          }
                          className="flex items-center gap-2 font-semibold text-slate-900 hover:text-blue-700"
                        >
                          <Avatar name={d.name} size="xs" /> {d.name}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onFilterUnassigned}
                          className="cursor-pointer font-semibold text-amber-800 hover:text-amber-950 hover:underline"
                        >
                          Unassigned ({d.companies}) →
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono tabular-nums text-slate-700">{d.companies}</td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <NumButton n={fresh.count} tone={fresh.count ? "new" : "plain"} label={fresh.title} onClick={() => panels.open(fresh.key)} />
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <NumButton n={toFile.count} tone={toFile.count ? "new" : "plain"} label={toFile.title} onClick={() => panels.open(toFile.key)} />
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <NumButton n={waiting.count} label={waiting.title} onClick={() => panels.open(waiting.key)} />
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <NumButton n={d.late.count} tone={d.late.count ? "bad" : "plain"} label={d.late.title} onClick={() => panels.open(d.late.key)} />
                    </td>
                    <td className="px-5 py-3.5 text-right align-middle">
                      <NumButton n={ai.count} label={ai.title} onClick={() => panels.open(ai.key)} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {panels.render(specs)}
    </section>
  );
}

/** Analyst: today's jobs on founder files, in priority order. */
function ToDo({ rows }: { rows: RoomRow[] }) {
  const links = useLinks();
  const w = useWorkspace();
  const [copied, setCopied] = useState<string | null>(null);
  const check = rows.flatMap((r) => r.shared.filter((f) => f.isNew && f.folder !== TO_FILE && f.check).map((f) => ({ r, f })));
  const file = rows.flatMap((r) => r.shared.filter((f) => f.folder === TO_FILE).map((f) => ({ r, f })));
  const chase = rows.flatMap((r) => r.missing.filter((m) => m.overdue && m.linkId).map((m) => ({ r, m })));
  const total = check.length + file.length + chase.length;
  const nudge = (r: RoomRow, label: string, linkId: string) =>
    `Hi ${r.founder.split(" ")[0]}, a quick nudge on "${label}". It's on the same page as before: ${window.location.origin}${linkPath(linkId)}\n\nIf you don't have it, just say so on the page.\n\nThanks,\n${w.me}`;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Your to-do on founder files</h2>
        <span className="text-xs text-slate-500">{total ? `${total} ${total === 1 ? "job" : "jobs"}, in priority order` : "All clear"}</span>
      </div>
      {total === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing to check, file or chase.</p>
      ) : (
        <ol className="divide-y divide-slate-200/75 px-5">
          {check.map(({ r, f }) => (
            <Job key={f.key} kind="Check" r={r} f={f} detail={`Answers: ${f.what}`}>
              <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => links.markChecked(f.check!.reqId, f.check!.itemId, w.me)}>
                Mark as checked
              </Button>
            </Job>
          ))}
          {file.map(({ r, f }) => (
            <Job key={f.key} kind="File" r={r} f={f} detail={`Email: "${f.email?.subject}" from ${f.sender}`}>
              <FileIt r={r} f={f} />
            </Job>
          ))}
          {chase.map(({ r, m }) => (
            <li key={m.key} className="flex flex-wrap items-start gap-3 py-3.5">
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-200">
                Chase
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <Link href={`/dataroom/${r.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                  {r.name}
                </Link>
                <span className="text-slate-700">: {m.label}</span>
                <span className="block text-xs text-rose-700">{m.meta}</span>
              </span>
              <Button
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() =>
                  navigator.clipboard?.writeText(nudge(r, m.label, m.linkId!)).then(
                    () => setCopied(m.key),
                    () => setCopied(null),
                  )
                }
              >
                {copied === m.key ? "Copied ✓" : "Copy a nudge"}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Job({ kind, r, f, detail, children }: { kind: string; r: RoomRow; f: RoomFile; detail: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-3.5">
      <span
        className={cx(
          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
          kind === "File" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-blue-50 text-blue-700 ring-blue-200",
        )}
      >
        {kind}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
          <Link href={`/dataroom/${r.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
            {r.name}
          </Link>
          <FileName f={f.file} href={f.href} name={f.name} className="min-w-0" />
          <ChannelChip c={f.channel} />
        </span>
        <span className="block text-xs text-slate-500">
          {detail} · {fmtDay(f.at)}
        </span>
        {kind === "File" && children}
      </span>
      {kind !== "File" && <span className="shrink-0 self-center">{children}</span>}
    </li>
  );
}
