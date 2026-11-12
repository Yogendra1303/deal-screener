"use client";

// Everything founders have sent the fund. Partners see the whole fund and who is behind; analysts see
// their own companies as a to-do list. Every count opens what is behind it. Files are kept as received.
import { PitchFiles } from "@/components/pitch-files";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NumButton, TileGrid, usePanels, type TileSpec } from "@/components/cards";
import { FileName, useDataRoom, type RoomFile, type RoomRow } from "@/components/founder-links";
import { useLinks } from "@/components/links-store";
import { ChannelChip, FileIt, InboxList, inboxOf, roomTiles, useCanAct } from "@/components/room";
import { Avatar } from "@/components/shell";
import { Button, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FOLDERS, TO_FILE } from "@/lib/dataroom";
import { fmtDay } from "@/lib/dates";
import { PITCH_INBOX, linkPath } from "@/lib/links";
import { ANALYSTS } from "@/lib/team";

export default function DataRoomPage() {
  const w = useWorkspace();
  const links = useLinks();
  const all = useDataRoom();
  const canAct = useCanAct();
  const partner = w.role === "Partner";
  const rows = useMemo(() => (partner ? all : all.filter((r) => r.owner === w.me)), [all, partner, w.me]);
  const tiles = roomTiles(rows, canAct, w.me, links.markChecked);

  if (!links.ready) return <p className="text-sm text-slate-500">Loading…</p>;

  // Analysts also see new pitches nobody has picked up, so a deck never sits unseen.
  const unpicked = partner ? [] : all.filter((r) => r.side === "pitch" && !r.owner);
  const inbox = inboxOf([...rows, ...unpicked], links.today);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{partner ? "Data room" : "Your data room"}</h1>
        <p className="mt-1 text-slate-600">
          {partner
            ? "Everything founders have sent the fund, how it arrived, and who at the fund is behind. Click any number to see what is behind it."
            : "Files founders sent you, what to check or file today, and what is still owed. Only your own companies and pitches are here."}
        </p>
      </div>

      <TileGrid tiles={tiles} />

      {partner ? <ByAnalyst rows={rows} /> : <ToDo rows={rows} />}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Arrived in the last 7 days</h2>
          <p className="text-xs text-slate-500">New pitch decks and files land here first, newest at the top, with the route each one took.</p>
          <div className="mt-2">
            <InboxList items={inbox} showOwner={partner || unpicked.length > 0} />
          </div>
        </div>
        <HowFilesArrive />
      </section>

      <Coverage rows={rows} showOwner={partner} />

      <PitchFiles />

      <p className="text-xs leading-relaxed text-slate-500">
        Files sent through founder request links, the founder portal, or company intake addresses are indexed automatically in the room above.
      </p>
    </div>
  );
}

function HowFilesArrive() {
  const routes: [string, string][] = [
    ["Pitch link", "Public form on the website, or an analyst's own link. A new pitch appears here, on Pitches and on Home."],
    ["Pitch email", `Decks emailed to ${PITCH_INBOX} become a new pitch the same way.`],
    ["Request link", "An analyst asks for documents; the founder uploads each one on a single page."],
    ["Email", "Each company has its own address. Files land here under To file until someone files them."],
    ["Founder portal", "The founder signs in with their email and sees everything the fund asked for."],
  ];
  return (
    <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">How files reach the fund</h2>
      <p className="text-xs text-slate-500">Founders never see the dashboard. Every route ends in this room.</p>
      <ol className="mt-3 space-y-2.5">
        {routes.map(([k, v], i) => (
          <li key={k} className="flex gap-3 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
            <span>
              <span className="font-medium text-slate-900">{k}.</span> <span className="text-slate-600">{v}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href="/method" className="mt-3 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900">
        See how every number is worked out →
      </Link>
    </div>
  );
}

/** Partner: who is behind on founder files, one row per analyst. Each number opens the list behind it. */
function ByAnalyst({ rows }: { rows: RoomRow[] }) {
  const links = useLinks();
  const canAct = useCanAct();
  const w = useWorkspace();
  const panels = usePanels();
  const specs: TileSpec[] = [];
  const data = [...ANALYSTS.map((a) => a.name), ""].map((name) => {
    const mine = rows.filter((r) => (r.owner ?? "") === name);
    const t = roomTiles(mine, canAct, w.me, links.markChecked).map((x) => ({
      ...x,
      key: `${name || "nobody"}:${x.key}`,
      title: `${x.title.split(" · ")[0]}: ${name ? name.split(" ")[0] : "nobody yet"}`,
    }));
    // Late is its own list: only the waiting lines past their reply-by date, never the ones still in time.
    const waitingSpec = t[2];
    const lateEntries = (waitingSpec.entries ?? []).filter((e) => e.tone !== "info");
    const lateSpec: TileSpec = {
      ...waitingSpec,
      key: `${name || "nobody"}:late`,
      title: `Late from founders: ${name ? name.split(" ")[0] : "nobody yet"}`,
      count: lateEntries.length,
      tone: lateEntries.length ? "urgent" : "info",
      explain: "Things the fund asked for that are past the reply-by date and still haven't arrived.",
      clear: "Nothing is late.",
      how: "Only request lines past the reply-by date the analyst set (7 days by default), and monthly reports past day 15 of the next month. Lines still within their date are under Waiting.",
      entries: lateEntries,
    };
    specs.push(...t, lateSpec);
    return { name, companies: mine.length, t, late: lateSpec };
  });
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">Who is behind</h2>
      <p className="text-xs text-slate-500">Files waiting on each analyst, and what founders still owe them. Click a number to open the list.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-sm">
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
                        <span className="flex items-center gap-2 font-medium text-slate-900">
                          <Avatar name={d.name} size="xs" /> {d.name.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">Not picked up</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums text-slate-600">{d.companies}</td>
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
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Your to-do on founder files</h2>
        <span className="text-xs text-slate-500">{total ? `${total} ${total === 1 ? "job" : "jobs"}, in the order to do them` : "All clear"}</span>
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
          <Job key={f.key} kind="File" r={r} f={f} detail={`Email: “${f.email?.subject}” from ${f.sender}`}>
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

/** What the fund holds for each company, folder by folder. */
function Coverage({ rows, showOwner }: { rows: RoomRow[]; showOwner: boolean }) {
  const [side, setSide] = useState<"all" | "pitch" | "portfolio">("all");
  const shown = rows.filter((r) => side === "all" || r.side === side).sort((a, b) => (a.side === b.side ? a.name.localeCompare(b.name) : a.side === "pitch" ? -1 : 1));
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="font-semibold text-slate-900">What we hold, company by company</h2>
          <p className="text-xs text-slate-500">Files in each folder. Amber means something in that folder was asked for and hasn&apos;t arrived. Click a company to open its room.</p>
        </div>
        <div className="flex gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
          {(
            [
              ["all", "All"],
              ["pitch", "Pitches"],
              ["portfolio", "Portfolio"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setSide(k)} className={cx("rounded px-2.5 py-1 font-medium transition-colors", side === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-2.5">Company</th>
              {FOLDERS.map((f) => (
                <th key={f.id} title={f.holds} className="px-4 py-2.5 text-center">
                  {f.n}. {f.name.split(" ")[0]}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center">To file</th>
              {showOwner && <th className="px-4 py-2.5 text-right">Analyst</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={cx("border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80", r.newCount > 0 && "bg-slate-100/30")}>
                <td className="px-4 py-3 align-middle">
                  <Link href={`/dataroom/${r.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                    {r.name}
                  </Link>
                  <span className="ml-2 inline-flex items-center rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    {r.side === "pitch" ? "Pitch" : "Portfolio"}
                  </span>
                  {r.newCount > 0 && <span className="ml-1.5 text-xs font-semibold text-blue-700">{r.newCount} new</span>}
                </td>
                {FOLDERS.map((f) => {
                  if (f.id === "reports" && r.side === "pitch")
                    return (
                      <td key={f.id} className="px-4 py-3 text-center align-middle text-slate-300">
                        –
                      </td>
                    );
                  const n = r.shared.filter((x) => x.folder === f.id).length;
                  const owed = r.missing.filter((m) => m.folder === f.id && m.answer !== "Don't have").length;
                  return (
                    <td key={f.id} className="px-4 py-3 text-center align-middle">
                      <Link
                        href={`/dataroom/${r.id}#${f.id}`}
                        title={`${n} ${n === 1 ? "file" : "files"}${owed ? `, ${owed} still owed` : ""}`}
                        className={cx(
                          "inline-flex min-w-[2.25rem] justify-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide tabular-nums",
                          owed ? "bg-amber-100 text-amber-800" : n ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {n}
                        {owed ? ` · ${owed}?` : ""}
                      </Link>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center align-middle">
                  {r.toFile ? <span className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">{r.toFile}</span> : <span className="text-slate-300">0</span>}
                </td>
                {showOwner && (
                  <td className="px-4 py-3 text-right align-middle text-xs text-slate-500">{r.owner ? r.owner.split(" ")[0] : <span className="font-medium text-amber-700">Nobody</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-slate-500">
        A number like <span className="font-semibold text-amber-800">2 · 1?</span> means two files held and one more asked for. Folders follow a
        standard diligence data room: {FOLDERS.map((f) => `${f.n}. ${f.name}`).join(", ")}.
      </p>
    </section>
  );
}
