"use client";

// One company's data room: a numbered index of every file, where each came from, who checked it,
// what is still owed and what is still to ask. Analysts act on their own companies; partners read.
import Link from "next/link";
import { use, useState } from "react";
import { BackLink } from "@/components/company";
import { FileName, RequestBuilder, useDataRoom, type RoomFile, type RoomRow } from "@/components/founder-links";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { AiText, ChannelChip, EmailSimulator, FileIt, MissingLine, unfile, useCanAct } from "@/components/room";
import { Avatar } from "@/components/shell";
import { Card, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FOLDERS, TO_FILE, folderName } from "@/lib/dataroom";
import { fmtDay } from "@/lib/dates";

export default function CompanyRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const w = useWorkspace();
  const links = useLinks();
  const rows = useDataRoom();
  const canAct = useCanAct();
  const r = rows.find((x) => x.id === id);
  const [asking, setAsking] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!links.ready) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!r)
    return (
      <Card className="mx-auto max-w-lg p-6 text-center text-sm text-slate-600">
        No data room for this company. <Link href="/dataroom" className="font-medium text-indigo-700">Back to the data room</Link>
      </Card>
    );
  // Analysts see their own companies, plus new pitches nobody has picked up yet.
  if (w.role === "Analyst" && r.owner && r.owner !== w.me)
    return (
      <Card className="mx-auto max-w-lg p-6 text-center text-sm text-slate-600">
        {r.name} is looked after by {r.owner}. Analysts see only their own companies; partners see the whole fund.{" "}
        <Link href="/dataroom" className="font-medium text-indigo-700">Back to your data room</Link>
      </Card>
    );

  const act = canAct(r);
  const toFile = r.shared.filter((f) => f.folder === TO_FILE);
  const waiting = r.missing.filter((m) => m.answer !== "Don't have");
  const folders = FOLDERS.filter((f) => r.side === "portfolio" || f.id !== "reports");

  return (
    <div className="space-y-6">
      <BackLink href="/dataroom" label="Data room" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{r.name}</h1>
            <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", r.side === "pitch" ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700")}>
              {r.side === "pitch" ? `Pitch · ${r.status}` : "Portfolio"}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>
              Founder: <span className="font-medium text-slate-900">{r.founder}</span> · {r.email}
            </span>
            <span className="flex items-center gap-1.5">
              {r.owner ? (
                <>
                  <Avatar name={r.owner} size="xs" /> {r.owner}
                </>
              ) : (
                <span className="font-medium text-amber-700">Nobody has picked it up</span>
              )}
            </span>
            <Link href={r.href} className="font-medium text-indigo-700 hover:text-indigo-900">
              Open {r.side === "pitch" ? "pitch" : "company"} →
            </Link>
          </p>
        </div>
        {act && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAsking(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Ask the founder
            </button>
            <button onClick={() => setMailing(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Simulate an email
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center rounded-2xl bg-slate-900 px-5 py-4 text-white">
        <div className="min-w-0">
          <p className="text-xs text-white/60">Founders can email files straight into this room</p>
          <p className="truncate font-mono text-sm">{r.inbox}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() =>
              navigator.clipboard?.writeText(r.inbox).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
            className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <Link href={`/founder?email=${encodeURIComponent(r.email)}`} target="_blank" className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
            Founder portal as {r.founder.split(" ")[0]} ↗
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Files held", r.shared.filter((f) => f.folder !== TO_FILE).length, "slate"],
            ["New, not checked", r.newCount, r.newCount ? "indigo" : "slate"],
            ["Waiting on founder", waiting.length, r.overdue ? "rose" : "slate"],
            ["Not read by AI", r.waitingAi, "slate"],
          ] as const
        ).map(([label, n, tone]) => (
          <div key={label} className={cx("rounded-2xl p-4 ring-1", tone === "indigo" ? "bg-slate-100 ring-slate-200" : tone === "rose" ? "bg-red-50 ring-red-200" : "bg-white ring-slate-200")}>
            <dd className={cx("text-2xl font-semibold tabular-nums", tone === "indigo" ? "text-slate-800" : tone === "rose" ? "text-red-700" : "text-slate-900")}>{n}</dd>
            <dt className="text-xs text-slate-500">
              {label}
              {label === "Waiting on founder" && r.overdue ? ` · ${r.overdue} late` : ""}
            </dt>
          </div>
        ))}
      </dl>

      {toFile.length > 0 && (
        <section id="to-file" className="scroll-mt-6 rounded-2xl bg-amber-50/60 p-5 ring-1 ring-amber-200">
          <h2 className="font-semibold text-slate-900">To file ({toFile.length})</h2>
          <p className="text-xs text-slate-600">
            Came in by email or the founder portal. The folder shown is a guess from the file name only, not from reading it.{" "}
            {act ? "Pick a folder and, if it answers something we asked for, say which." : `${r.owner?.split(" ")[0] ?? "The analyst"} files these.`}
          </p>
          <ul className="mt-3 space-y-3">
            {toFile.map((f) => (
              <li key={f.key} className="rounded-xl bg-white p-3 ring-1 ring-amber-200">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <FileName f={f.file} name={f.name} className="min-w-0 font-medium" />
                  <ChannelChip c={f.channel} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  “{f.email?.subject}” · from {f.sender} · {fmtDay(f.at)}
                  {f.suggested ? ` · looks like ${folderName(f.suggested)}` : " · no folder suggested"}
                </p>
                {act && <FileIt r={r} f={f} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="px-5 pt-5">
          <h2 className="font-semibold text-slate-900">Document index</h2>
          <p className="text-xs text-slate-500">Every file, numbered by folder, with where it came from and who checked it. Files are kept exactly as received.</p>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {folders.map((fo) => {
            const files = r.shared.filter((x) => x.folder === fo.id);
            const owed = r.missing.filter((m) => m.folder === fo.id);
            return (
              <div key={fo.id} id={fo.id} className="scroll-mt-6 px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {fo.n}. {fo.name} <span className="font-normal text-slate-500">({files.length})</span>
                  </h3>
                  <span className="text-xs text-slate-400">{fo.holds}</span>
                </div>
                {files.length === 0 && owed.length === 0 && <p className="mt-1 text-sm text-slate-400">Nothing yet.</p>}
                <ul className="mt-1 divide-y divide-slate-50">
                  {files.map((f, i) => (
                    <IndexRow key={f.key} n={`${fo.n}.${i + 1}`} f={f} r={r} act={act} />
                  ))}
                </ul>
                {owed.length > 0 && (
                  <ul className="mt-1 rounded-xl bg-slate-50 px-3">
                    {owed.map((m) => (
                      <MissingLine key={m.key} m={m} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Still to ask ({r.need.length})</h2>
        <p className="text-xs text-slate-500">
          {r.side === "pitch" ? "Open lines on the diligence list that haven't been asked yet." : "What the fund collects each year that hasn't been asked yet."} Nothing
          already sent or already asked is listed.
        </p>
        {r.need.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {r.need.map((n) => (
              <li key={n.id} className="flex gap-2">
                <span aria-hidden className="text-slate-300">○</span>
                {n.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Nothing else to ask for now.</p>
        )}
        {act ? (
          r.need.length > 0 && (
            <button onClick={() => setAsking(true)} className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              Ask the founder
            </button>
          )
        ) : (
          <p className="mt-3 text-xs text-slate-500">{r.owner ? `${r.owner.split(" ")[0]} sends requests for this company.` : "An analyst sends requests once someone picks it up."}</p>
        )}
      </section>

      {asking && <RequestBuilder target={{ companyId: r.id, companyName: r.name, side: r.side, founder: r.founder, candidates: r.need }} onClose={() => setAsking(false)} />}
      {mailing && <EmailSimulator r={r} onClose={() => setMailing(false)} />}
    </div>
  );
}

function IndexRow({ n, f, r, act }: { n: string; f: RoomFile; r: RoomRow; act: boolean }) {
  const links = useLinks();
  const p = usePortfolio();
  const w = useWorkspace();
  return (
    <li className={cx("grid gap-1 py-2.5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3", f.isNew && "rounded-lg bg-slate-50 px-2 -mx-2")}>
      <span className="text-xs font-semibold tabular-nums text-slate-400">{n}</span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
          {f.isNew && <span className="rounded bg-slate-900 px-1 text-[10px] font-bold uppercase text-white">New</span>}
          <FileName f={f.file} href={f.href} name={f.name} className="min-w-0 font-medium" />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {f.what} · {f.sender} · {fmtDay(f.at)} · <AiText s={f.ai} />
          {f.checkedBy && ` · ${f.email ? "filed" : "checked"} by ${f.checkedBy.by.split(" ")[0]} ${fmtDay(f.checkedBy.at)}`}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 sm:justify-end">
        <ChannelChip c={f.channel} />
        {act && f.isNew && f.check && (
          <button onClick={() => links.markChecked(f.check!.reqId, f.check!.itemId, w.me)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700">
            Mark as checked
          </button>
        )}
        {act && f.email && (
          <button onClick={() => unfile(r, f, links, p, w.me)} className="text-xs text-slate-500 underline hover:text-slate-800">
            Move back to To file
          </button>
        )}
      </span>
    </li>
  );
}
