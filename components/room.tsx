"use client";

// Pieces of the data room shared by the fund-wide page, each company's room and the home page:
// the four counts (each opens what is behind it), file rows with where each file came from,
// filing an emailed file, and the email-in simulator.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Group, TileSpec } from "./cards";
import { AI_HELP, type AiState, type RoomFile, type RoomMissing, type RoomRow } from "./founder-links";
import { useLinks } from "./links-store";
import { usePortfolio } from "./portfolio-store";
import { Button, DropdownSelect, cx } from "./ui";
import { useWorkspace } from "./workspace";
import { addDays, fmtDay } from "@/lib/dates";
import { CHANNEL_HELP, FOLDERS, TO_FILE, folderName, type Channel } from "@/lib/dataroom";

export function roomGroup(r: RoomRow): Group {
  return { id: r.id, name: r.name, kind: r.side === "pitch" ? "Pitch" : "Portfolio", href: `/dataroom/${r.id}`, owner: r.owner, status: r.side === "pitch" ? r.status : undefined };
}

/** Can this person act on this company's files? Only the analyst who looks after it. Partners see, they don't enter. */
export function useCanAct() {
  const w = useWorkspace();
  return (r: { owner?: string }) => w.role === "Analyst" && r.owner === w.me;
}

const CHANNEL_TONE: Partial<Record<Channel, string>> = {
  Email: "bg-slate-100 text-slate-600",
  "Founder portal": "bg-slate-100 text-slate-600",
  "Request link": "bg-slate-100 text-slate-600",
  "Pitch email": "bg-slate-100 text-slate-600",
  "Partner email": "bg-slate-100 text-slate-600",
};

export function ChannelChip({ c }: { c: Channel }) {
  return (
    <span title={CHANNEL_HELP[c]} className={cx("inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", CHANNEL_TONE[c] ?? "bg-slate-100 text-slate-600")}>
      {c}
    </span>
  );
}

const AI_TONE: Record<AiState, string> = {
  "Read by AI": "text-emerald-700",
  "Read in Claude chat": "text-emerald-700",
  "Waiting for AI": "text-amber-700",
  "Founder typed numbers": "text-slate-500",
};

export function AiText({ s }: { s: AiState }) {
  return (
    <span title={AI_HELP[s]} className={AI_TONE[s]}>
      {s}
    </span>
  );
}

/** The four counts at the top of the data room. Each one opens the files or lines behind it. */
export function roomTiles(rows: RoomRow[], canAct: (r: RoomRow) => boolean, me: string, markChecked: (reqId: string, itemId: string, by: string) => void): TileSpec[] {
  const fresh = rows.flatMap((r) => r.shared.filter((f) => f.isNew && f.folder !== TO_FILE).map((f) => ({ r, f })));
  const toFile = rows.flatMap((r) => r.shared.filter((f) => f.folder === TO_FILE).map((f) => ({ r, f })));
  const waiting = rows.flatMap((r) => r.missing.filter((m) => m.answer !== "Don't have").map((m) => ({ r, m })));
  const late = waiting.filter((x) => x.m.overdue);
  const ai = rows.flatMap((r) => r.shared.filter((f) => f.ai === "Waiting for AI").map((f) => ({ r, f })));
  const fileMeta = (f: RoomFile) => `${f.channel} · ${f.sender} · ${fmtDay(f.at)}`;
  return [
    {
      key: "new",
      title: "New from founders",
      count: fresh.length,
      tone: "info",
      icon: "files",
      explain: "Files founders uploaded on a request link that nobody at the fund has checked yet.",
      clear: "Every file founders sent has been checked.",
      next: "Open the file, compare it with what the deck says, then mark it checked. Checked files count as done on the diligence list.",
      how: "Counts every file sent through a request link whose line nobody has marked checked. Marking it checked clears it. Files that came by email are counted under To file instead.",
      entries: fresh.map(({ r, f }) => ({
        key: f.key,
        group: roomGroup(r),
        title: f.name,
        detail: `Answers: ${f.what}`,
        meta: fileMeta(f),
        tone: "info",
        action:
          f.check && canAct(r) ? (
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => markChecked(f.check!.reqId, f.check!.itemId, me)}>
              Mark as checked
            </Button>
          ) : undefined,
        href: f.check && canAct(r) ? undefined : `/dataroom/${r.id}`,
        cta: f.check && canAct(r) ? undefined : "Open room",
      })),
    },
    {
      key: "to-file",
      title: "To file",
      count: toFile.length,
      tone: toFile.length ? "watch" : "info",
      icon: "report",
      explain: "Files that came in by email or the founder portal and haven't been put in a folder.",
      clear: "Nothing waiting to be filed.",
      next: "Open the company's room, pick a folder, and say which request it answers if it answers one. That line then turns to sent.",
      how: "Counts files that arrived by email or on the founder portal with no folder yet. A folder is suggested from the file name only; a person files it.",
      entries: toFile.map(({ r, f }) => ({
        key: f.key,
        group: roomGroup(r),
        title: f.name,
        detail: `Email: ${f.email?.subject ?? ""}`,
        meta: `${fileMeta(f)}${f.suggested ? ` · looks like ${folderName(f.suggested)} (from the file name)` : ""}`,
        tone: "watch",
        href: `/dataroom/${r.id}#to-file`,
        cta: canAct(r) ? "File it" : "Open room",
      })),
    },
    {
      key: "waiting",
      title: late.length ? `Waiting on founders · ${late.length} late` : "Waiting on founders",
      count: waiting.length,
      tone: late.length ? "urgent" : "watch",
      icon: "ask",
      explain: "Things the fund asked for that haven't arrived, including ones the founder said will come later.",
      clear: "Nothing owed by founders.",
      next: "For late items, send the same link again with a one-line nudge. Over 30 days late on a portfolio company, the partner should call.",
      how: `Counts every request line with no file yet (except ones the founder said they don't have), plus monthly reports and documents past their due date. Monthly reports are due on day 15 of the next month. Late means past the reply-by date the analyst set (7 days by default).`,
      entries: waiting
        .sort((a, b) => b.m.days - a.m.days)
        .map(({ r, m }) => ({
          key: `${r.id}:${m.key}`,
          group: roomGroup(r),
          title: m.label,
          detail: m.meta,
          tone: m.overdue ? (m.days > 30 ? "urgent" : "watch") : "info",
          href: m.linkId ? `/founder/request/${m.linkId}` : `/dataroom/${r.id}`,
          cta: m.linkId ? "Founder's page" : "Open room",
        })),
    },
    {
      key: "ai",
      title: "Waiting for AI",
      count: ai.length,
      tone: "info",
      icon: "read",
      explain: "Files stored as received that no AI has read yet. Nothing in them is used in a number until it is read.",
      clear: "Every file has been read.",
      next: "Add an API key to read them in the app, or read a deck in a Claude chat (docs/screen-a-deck.md). Until then, open the file yourself.",
      how: "Counts stored files with no AI reading. Monthly numbers the founder typed into the report form don't count: the founder typed them and the file is kept as the source.",
      entries: ai.map(({ r, f }) => ({ key: f.key, group: roomGroup(r), title: f.name, detail: f.what, meta: fileMeta(f), tone: "info", href: `/dataroom/${r.id}`, cta: "Open room" })),
    },
  ];
}

/** Everything that arrived in the last week, newest first: new pitch decks, request uploads, emails. */
export function inboxOf(rows: RoomRow[], today: string, days = 7) {
  const since = addDays(today, -days);
  return rows
    .flatMap((r) => r.shared.filter((f) => f.at > since).map((f) => ({ r, f })))
    .sort((a, b) => b.f.at.localeCompare(a.f.at) || a.r.name.localeCompare(b.r.name));
}

export function InboxList({ items, showOwner, limit = 12 }: { items: { r: RoomRow; f: RoomFile }[]; showOwner: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">Nothing new in the last 7 days.</p>;
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {shown.map(({ r, f }) => {
          const deck = f.what === "Pitch deck" && r.side === "pitch";
          return (
            <li key={`${r.id}:${f.key}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="w-14 shrink-0 text-xs tabular-nums text-slate-500">{fmtDay(f.at)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <Link href={`/dataroom/${r.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                    {r.name}
                  </Link>
                  {deck ? (
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New pitch</span>
                  ) : f.isNew ? (
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{f.folder === TO_FILE ? "To file" : "New"}</span>
                  ) : null}
                  <span className="min-w-0 truncate text-slate-600">{f.name}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{f.what}</span>
              </span>
              <ChannelChip c={f.channel} />
              {showOwner && <span className="w-16 shrink-0 text-right text-xs text-slate-500">{r.owner ? r.owner.split(" ")[0] : <span className="font-medium text-amber-700">Nobody</span>}</span>}
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button onClick={() => setAll((x) => !x)} className="mt-1 text-xs font-medium text-indigo-700 hover:text-indigo-900">
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}

/** File an emailed file: pick a folder, and optionally the open line it answers. */
export function FileIt({ r, f }: { r: RoomRow; f: RoomFile }) {
  const links = useLinks();
  const p = usePortfolio();
  const w = useWorkspace();
  const [folder, setFolder] = useState(f.suggested ?? "");
  const [answers, setAnswers] = useState("");
  const slots = [...r.open].sort((a, b) => Number(b.folder === folder) - Number(a.folder === folder));
  const go = () => {
    const slot = r.open.find((o) => o.key === answers);
    const fold = folder || slot?.folder;
    if (!fold || !f.email) return;
    links.fileEmail(f.email.id, f.name, fold, w.me, slot ? { key: slot.key, label: slot.label } : undefined);
    if (slot?.key.startsWith("req:")) {
      const [, reqId, itemId] = slot.key.split(":");
      links.attach(reqId, itemId, { ...f.file!, viaEmail: f.email.id }, w.me);
    } else if (slot?.key.startsWith("doc:")) p.receiveDoc(r.id, slot.key.slice(4), f.name);
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <DropdownSelect
        value={folder}
        onChange={setFolder}
        ariaLabel="Folder"
        options={[
          { value: "", label: "Pick a folder…" },
          ...FOLDERS.filter((x) => r.side === "portfolio" || x.id !== "reports").map((x) => ({
            value: x.id,
            label: `${x.n}. ${x.name}${x.id === f.suggested ? " (suggested)" : ""}`,
          })),
        ]}
      />
      {r.open.length > 0 && (
        <DropdownSelect
          value={answers}
          onChange={setAnswers}
          ariaLabel="Answers"
          options={[
            { value: "", label: "Doesn't answer an open request" },
            ...slots.map((o) => ({ value: o.key, label: `Answers: ${o.label}` })),
          ]}
        />
      )}
      <Button onClick={go} disabled={!folder && !answers} className="px-3 py-1.5 text-sm">
        File it
      </Button>
    </div>
  );
}

export function unfile(r: RoomRow, f: RoomFile, links: ReturnType<typeof useLinks>, p: ReturnType<typeof usePortfolio>, me: string) {
  if (!f.email) return;
  links.fileEmail(f.email.id, f.name, null, me);
  const a = f.email.answers;
  if (a?.startsWith("req:")) {
    const [, reqId, itemId] = a.split(":");
    links.detach(reqId, itemId, f.email.id, f.name);
  } else if (a?.startsWith("doc:")) p.receiveDoc(r.id, a.slice(4), null);
}

/** Stands in for a founder emailing the company's fund address. Real email-in needs an inbound mail service. */
export function EmailSimulator({ r, onClose }: { r: RoomRow; onClose: () => void }) {
  const links = useLinks();
  const [from, setFrom] = useState(r.email);
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Simulate an email">
      <button className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!files.length) return;
          setBusy(true);
          await links.addEmail({ companyId: r.id, companyName: r.name, side: r.side, from, subject: subject || files.map((f) => f.name).join(", "), via: "Email" }, files);
          setBusy(false);
          onClose();
        }}
        className="relative w-full max-w-lg space-y-4 rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div>
          <p className="text-xs font-medium text-slate-500">Simulated email to {r.inbox}</p>
          <h2 className="text-lg font-semibold text-slate-900">A founder emails files to the fund</h2>
          <p className="mt-1 text-sm text-slate-600">
            In the real product the founder sends this from their own email and the files land in {r.name}&apos;s room on their own. Here you
            play the founder.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">From</span>
          <input value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. September numbers and bank statement" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Attachments</span>
          <input type="file" multiple required onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button disabled={!files.length || busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
            {busy ? "Sending…" : "Send email"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MissingLine({ m }: { m: RoomMissing }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
      <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.answer === "Don't have" ? "bg-slate-300" : m.overdue ? "bg-red-500" : "bg-amber-400")} />
      <span className="min-w-0 flex-1">
        <span className={cx("block", m.answer === "Don't have" ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800")}>{m.label}</span>
        <span className={cx("block text-xs", m.overdue ? "text-red-700" : "text-slate-500")}>{m.meta}</span>
      </span>
      {m.linkId && (
        <a href={`/founder/request/${m.linkId}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-indigo-700 hover:underline">
          Founder&apos;s page ↗
        </a>
      )}
    </li>
  );
}

