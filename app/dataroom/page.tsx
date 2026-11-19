"use client";

// Everything founders have sent the fund, incoming pitches, inline owner assignment, and the full diligence index.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { NumButton, TileIcon, usePanels, type TileSpec } from "@/components/cards";
import { DocBadges, DocDrawer, useDocs } from "@/components/docs";
import { FileName, useDataRoom, type RoomFile, type RoomRow } from "@/components/founder-links";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { ChannelChip, FileIt, roomTiles, useCanAct } from "@/components/room";
import { Avatar } from "@/components/shell";
import { Button, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FOLDERS, TO_FILE } from "@/lib/dataroom";
import { addDays, fmtDay } from "@/lib/dates";
import type { SourceDoc } from "@/lib/docs";
import { PITCH_INBOX, linkPath } from "@/lib/links";
import { usd } from "@/lib/rules";
import { ANALYSTS, PARTNER } from "@/lib/team";

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

  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [feedWindow, setFeedWindow] = useState<"all" | "7d">("all");
  const [feedQuery, setFeedQuery] = useState("");
  const [showAllFeed, setShowAllFeed] = useState(false);

  const [dirScope, setDirScope] = useState<DirScope>("all");
  const [dirOwner, setDirOwner] = useState<string>("all");
  const [dirQuery, setDirQuery] = useState("");
  const [showRoutes, setShowRoutes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ name: string; docs: SourceDoc[]; start: number } | null>(null);
  const closeDocPreview = useCallback(() => setDocPreview(null), []);

  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "unassigned") {
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

  const jumpToUnassignedDirectory = () => {
    setDirScope("unassigned");
    setDirOwner("all");
    document.getElementById("room-directory")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!links.ready) return <p className="text-sm text-slate-500">Loading data room…</p>;

  const shownFeed = showAllFeed ? feedItems : feedItems.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Fund Operations · Document &amp; Intake Vault
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            {partner ? "Data room" : "Your data room"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {partner
              ? "Every incoming pitch deck, diligence file, and founder upload across the fund. Assign owners inline and open source documents directly."
              : "Your assigned pitches, unclaimed inbound decks, and company diligence files waiting on review."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoutes((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            {showRoutes ? "Hide intake routes" : "How files reach the fund"}
          </button>
          <Link
            href="/upload"
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
          >
            + Upload Pitch
          </Link>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {showRoutes && <IntakeRoutesStrip />}

      {/* 4 Balanced Interactive KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={jumpToUnassignedDirectory}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            unassignedCount > 0 ? "border-amber-300 ring-1 ring-amber-200/70" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Unassigned pitches</span>
            {unassignedCount > 0 && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Assign</span>
            )}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {unassignedCount}
            <span className="text-sm font-normal text-slate-400"> decks</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            {unassignedCount > 0 ? "Assign an analyst or partner below →" : "Every incoming pitch has an owner"}
          </p>
        </button>

        {[
          { spec: freshTile, badge: freshTile.count > 0 ? "Review" : null, badgeTone: "bg-indigo-50 text-indigo-700" },
          { spec: toFileTile, badge: toFileTile.count > 0 ? "Action" : null, badgeTone: "bg-amber-50 text-amber-800" },
          { spec: waitingTile, badge: null, badgeTone: "bg-rose-50 text-rose-700" },
        ].map(({ spec, badge, badgeTone }) => {
          const empty = spec.count === 0;
          return (
            <button
              key={spec.key}
              type="button"
              onClick={() => panels.open(spec.key)}
              className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5 truncate">
                  <TileIcon name={spec.icon} className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{spec.title.split(" · ")[0]}</span>
                </span>
                {badge && (
                  <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-bold", badgeTone)}>{badge}</span>
                )}
              </div>
              <div className={cx("mt-1.5 font-mono text-2xl font-bold", empty ? "text-slate-300" : "text-slate-900")}>
                {spec.count}
              </div>
              <p className="mt-1 truncate text-xs text-slate-500 group-hover:text-indigo-700">
                {empty ? spec.clear : spec.explain}
              </p>
            </button>
          );
        })}
      </div>

      {/* Section 1: Incoming Pitches & File Activity */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Incoming pitches &amp; recent files</h2>
            <p className="text-xs text-slate-500">
              Newest submissions and diligence uploads at the top. Inspect what arrived and assign an owner inline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => panels.open(aiTile.key)}
              className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <span className="font-mono font-semibold text-slate-900">{aiTile.count}</span> waiting for AI →
            </button>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              {(
                [
                  ["all", "All dates"],
                  ["7d", "Last 7 days"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFeedWindow(k)}
                  className={cx(
                    "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
                    feedWindow === k ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feed Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ["all", "All"],
                ["new_pitch", "New pitches"],
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
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={feedQuery}
            onChange={(e) => setFeedQuery(e.target.value)}
            placeholder="Filter by company, file, founder…"
            className="w-60 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {shownFeed.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No files match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Company &amp; Details</th>
                  <th className="px-4 py-2.5">File</th>
                  <th className="px-4 py-2.5">Route</th>
                  <th className="px-4 py-2.5">Assigned To</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownFeed.map(({ r, f }) => {
                  const isDeck = f.what === "Pitch deck" && r.side === "pitch";
                  const canAssign = partner || (r.side === "pitch" && !r.owner);
                  return (
                    <tr key={`${r.id}:${f.key}`} className="transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 align-middle font-mono text-xs tabular-nums text-slate-500">
                        {fmtDay(f.at)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/dataroom/${r.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                            {r.name}
                          </Link>
                          {isDeck ? (
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New pitch
                            </span>
                          ) : f.folder === TO_FILE ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                              To file
                            </span>
                          ) : f.isNew ? (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.sector} · {r.stage}
                          {r.askUsd ? ` · ${usd(r.askUsd)}` : ""} · {r.founder}
                        </p>
                      </td>
                      <td className="max-w-[18rem] px-4 py-3 align-middle">
                        <FileName f={f.file} href={f.href} name={f.name} className="block truncate text-sm font-medium" />
                        <p className="mt-0.5 truncate text-xs text-slate-500">{f.what}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        <ChannelChip c={f.channel} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        {canAssign ? (
                          <DropdownSelect
                            ariaLabel={`Assign owner for ${r.name}`}
                            value={r.owner ?? ""}
                            placeholder="Unassigned"
                            onChange={(next) => assignOwner(r, next)}
                            options={[
                              ...(r.side === "pitch" ? [{ value: "", label: "Unassigned" }] : []),
                              ...ownerChoices.map((n) => ({ value: n, label: n })),
                            ]}
                            size="xs"
                            buttonClassName={
                              !r.owner
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100/70"
                                : undefined
                            }
                          />
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-slate-600">
                            {r.owner ? (
                              <>
                                <Avatar name={r.owner} size="xs" /> {r.owner.split(" ")[0]}
                              </>
                            ) : (
                              <span className="font-medium text-amber-700">Unassigned</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                        <div className="inline-flex items-center gap-2">
                          {f.isNew && f.check && canAct(r) && (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => {
                                links.markChecked(f.check!.reqId, f.check!.itemId, w.me);
                                showToast(`Marked ${f.name} as checked.`);
                              }}
                            >
                              Mark checked
                            </Button>
                          )}
                          <Link
                            href={`/dataroom/${r.id}`}
                            className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                          >
                            Open →
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

        {feedItems.length > 12 && (
          <div className="border-t border-slate-100 px-5 py-2.5 text-center">
            <button
              type="button"
              onClick={() => setShowAllFeed((v) => !v)}
              className="cursor-pointer text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              {showAllFeed ? "Show top 12 files" : `Show all ${feedItems.length} files`}
            </button>
          </div>
        )}
      </section>

      {/* Section 2: Unified Company Vault & Source Files Directory */}
      <section id="room-directory" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Company vault &amp; diligence coverage</h2>
            <p className="text-xs text-slate-500">
              Every company&apos;s pitch files, source badges, 6 diligence folders, and owner assignment in one table.
            </p>
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
              placeholder="Search companies…"
              className="w-48 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ["all", `All (${visibleRows.length})`],
                ["pitch", `Pitches (${visibleRows.filter((r) => r.side === "pitch").length})`],
                ["portfolio", `Portfolio (${visibleRows.filter((r) => r.side === "portfolio").length})`],
                ["unassigned", `Unassigned (${visibleRows.filter((r) => !r.owner).length})`],
              ] as [DirScope, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDirScope(k)}
                className={cx(
                  "cursor-pointer rounded-md border px-2.5 py-1 font-medium transition-colors",
                  dirScope === k
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-slate-500">{dirRows.length} shown</span>
        </div>

        {dirRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No companies match your filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Source Files</th>
                  {FOLDERS.map((f) => (
                    <th key={f.id} title={f.holds} className="px-2.5 py-2.5 text-center">
                      {f.n}. {f.name.split(" ")[0]}
                    </th>
                  ))}
                  <th className="px-2.5 py-2.5 text-center">To file</th>
                  <th className="px-4 py-2.5 text-right">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dirRows.map((r) => {
                  const docs = r.side === "pitch" ? docsFor(r.id) : [];
                  const misCount = r.shared.filter((x) => x.folder === "reports").length;
                  const canAssign = partner || (r.side === "pitch" && !r.owner);
                  return (
                    <tr
                      key={r.id}
                      className={cx(
                        "transition-colors hover:bg-slate-50/80",
                        r.side === "pitch" && !r.owner && "bg-amber-50/25",
                      )}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/dataroom/${r.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                            {r.name}
                          </Link>
                          <span className="inline-flex items-center rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {r.side === "pitch" ? "Pitch" : "Portfolio"}
                          </span>
                          {r.newCount > 0 && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                              {r.newCount} new
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.sector} · {r.stage}
                          {r.askUsd ? ` · ${usd(r.askUsd)}` : ""} · {fmtDay(r.receivedAt)} · {r.founder}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {r.side === "pitch" ? (
                          <DocBadges
                            docs={docs}
                            onOpen={(i) => setDocPreview({ name: r.name, docs, start: i })}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <Link
                              href={`/dataroom/${r.id}#company`}
                              className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-700 hover:border-slate-400 hover:bg-white"
                            >
                              DECK
                            </Link>
                            <Link
                              href={`/dataroom/${r.id}#reports`}
                              className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-800 hover:bg-emerald-100"
                            >
                              {misCount} MIS
                            </Link>
                          </div>
                        )}
                      </td>

                      {FOLDERS.map((f) => {
                        if (f.id === "reports" && r.side === "pitch") {
                          return (
                            <td key={f.id} className="px-2.5 py-3 text-center align-middle text-slate-300">
                              -
                            </td>
                          );
                        }
                        const n = r.shared.filter((x) => x.folder === f.id).length;
                        const owed = r.missing.filter((m) => m.folder === f.id && m.answer !== "Don't have").length;
                        return (
                          <td key={f.id} className="px-2.5 py-3 text-center align-middle">
                            <Link
                              href={`/dataroom/${r.id}#${f.id}`}
                              title={`${n} ${n === 1 ? "file" : "files"} held${owed ? `, ${owed} due` : ""}`}
                              className={cx(
                                "inline-flex min-w-[2.25rem] justify-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                                owed
                                  ? "bg-amber-100 text-amber-900"
                                  : n
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-500",
                              )}
                            >
                              {owed ? `${n} / ${owed} due` : n}
                            </Link>
                          </td>
                        );
                      })}

                      <td className="px-2.5 py-3 text-center align-middle">
                        {r.toFile ? (
                          <Link
                            href={`/dataroom/${r.id}#to-file`}
                            className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 hover:bg-amber-200"
                          >
                            {r.toFile}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-slate-300">0</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                        {canAssign ? (
                          <DropdownSelect
                            ariaLabel={`Assign owner for ${r.name}`}
                            value={r.owner ?? ""}
                            placeholder="Unassigned"
                            onChange={(next) => assignOwner(r, next)}
                            options={[
                              ...(r.side === "pitch" ? [{ value: "", label: "Unassigned" }] : []),
                              ...ownerChoices.map((n) => ({ value: n, label: n })),
                            ]}
                            align="right"
                            size="xs"
                            buttonClassName={
                              !r.owner
                                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100/70"
                                : undefined
                            }
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            {r.owner ? (
                              <>
                                <Avatar name={r.owner} size="xs" /> {r.owner.split(" ")[0]}
                              </>
                            ) : (
                              <span className="font-medium text-amber-700">Unassigned</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500">
          Amber badges like <span className="font-semibold text-amber-900">0 / 1 due</span> show files held alongside items requested from the founder. Click any source badge (<span className="font-mono">DECK</span>, <span className="font-mono">CSV</span>, <span className="font-mono">FORM</span>) to preview or download.
        </div>
      </section>

      {/* Section 3: Partner Workload Breakdown / Analyst Checklist */}
      {partner ? <ByAnalyst rows={all} onFilterUnassigned={jumpToUnassignedDirectory} /> : <ToDo rows={rows} />}

      {panels.render(tiles)}
      {docPreview && <DocDrawer name={docPreview.name} docs={docPreview.docs} start={docPreview.start} onClose={closeDocPreview} />}
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">How files reach the fund</h2>
          <p className="text-xs text-slate-500">Founders never see the internal dashboard. Every upload and email lands in this room.</p>
        </div>
        <Link href="/method" className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
          How numbers work →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {routes.map(([title, desc]) => (
          <div key={title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
            <p className="font-semibold text-slate-900">{title}</p>
            <p className="mt-1 leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Partner: who is behind on founder files, one row per analyst. Each number opens the list behind it. */
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <h2 className="text-base font-semibold text-slate-900">Who is behind</h2>
      <p className="text-xs text-slate-500">Files waiting on each analyst, and what founders still owe them. Click any count to inspect.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-2.5">Analyst</th>
              <th className="px-4 py-2.5 text-right">Companies</th>
              <th className="px-4 py-2.5 text-right">New to check</th>
              <th className="px-4 py-2.5 text-right">To file</th>
              <th className="px-4 py-2.5 text-right">Waiting</th>
              <th className="px-4 py-2.5 text-right">Late</th>
              <th className="px-4 py-2.5 text-right">Not read by AI</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((d) => d.companies > 0)
              .map((d) => {
                const [fresh, toFile, waiting, ai] = d.t;
                return (
                  <tr key={d.name || "nobody"} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
                    <td className="px-4 py-3 align-middle">
                      {d.name ? (
                        <Link
                          href={
                            ANALYSTS.some((a) => a.name === d.name)
                              ? `/team?who=${d.name.split(" ")[0].toLowerCase()}`
                              : "/team"
                          }
                          className="flex items-center gap-2 font-medium text-slate-900 hover:text-indigo-700"
                        >
                          <Avatar name={d.name} size="xs" /> {d.name.split(" ")[0]}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onFilterUnassigned}
                          className="cursor-pointer font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                        >
                          Unassigned ({d.companies}) →
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-mono tabular-nums text-slate-600">{d.companies}</td>
                    <td className="px-4 py-3 text-right align-middle">
                      <NumButton n={fresh.count} tone={fresh.count ? "new" : "plain"} label={fresh.title} onClick={() => panels.open(fresh.key)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <NumButton n={toFile.count} tone={toFile.count ? "new" : "plain"} label={toFile.title} onClick={() => panels.open(toFile.key)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <NumButton n={waiting.count} label={waiting.title} onClick={() => panels.open(waiting.key)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <NumButton n={d.late.count} tone={d.late.count ? "bad" : "plain"} label={d.late.title} onClick={() => panels.open(d.late.key)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
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

/** Analyst: today's jobs on founder files, in the order to do them. */
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Your to-do on founder files</h2>
        <span className="text-xs text-slate-500">{total ? `${total} ${total === 1 ? "job" : "jobs"}, in priority order` : "All clear"}</span>
      </div>
      {total === 0 && <p className="mt-3 text-sm text-slate-500">Nothing to check, file or chase.</p>}
      <ol className="mt-2 divide-y divide-slate-100">
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
          <li key={m.key} className="flex flex-wrap items-start gap-3 py-3">
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">Chase</span>
            <span className="min-w-0 flex-1 text-sm">
              <Link href={`/dataroom/${r.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                {r.name}
              </Link>
              <span className="text-slate-700">: {m.label}</span>
              <span className="block text-xs text-red-700">{m.meta}</span>
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
              {copied === m.key ? "Copied" : "Copy a nudge"}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Job({ kind, r, f, detail, children }: { kind: string; r: RoomRow; f: RoomFile; detail: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset", kind === "File" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-100 text-indigo-700 ring-slate-200")}>
        {kind}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
          <Link href={`/dataroom/${r.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
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
