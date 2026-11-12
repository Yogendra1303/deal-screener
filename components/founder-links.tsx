"use client";

// The fund's side of founder links: building a request, the data room rows (what each company has
// sent, what is missing, what we still need), and what analysts have asked founders.
import { useEffect, useMemo, useState } from "react";
import { useLinks } from "./links-store";
import { usePortfolio } from "./portfolio-store";
import { useStore } from "./store";
import { cx } from "./ui";
import { useWorkspace } from "./workspace";
import { addDays, fmtDay } from "@/lib/dates";
import { diligence } from "@/lib/diligence";
import { sampleById } from "@/lib/data";
import { fmtMonth } from "@/lib/format";
import { TO_FILE, folderFor, guessFolder, type Channel } from "@/lib/dataroom";
import { sampleChannel } from "@/lib/funnel";
import {
  FIRST_LOOK,
  FUND_NAME,
  TEMPLATES,
  PORTFOLIO_YEARLY,
  founderEmail,
  inboxAddress,
  itemStatus,
  linkPath,
  type EmailIn,
  type FounderRequest,
  type LinkFile,
  type RequestItem,
} from "@/lib/links";
import { daysBetween, missingItems } from "@/lib/portfolio/health";
import type { DealResult } from "@/lib/types";

// ---------- Ask once: what this company already sent, or was already asked ----------

export function alreadyAsked(requests: FounderRequest[], companyId: string) {
  const have = new Set<string>();
  const waiting = new Set<string>();
  for (const r of requests.filter((x) => x.companyId === companyId))
    for (const i of r.items) {
      const k = i.dd ?? i.id;
      const a = r.answers[i.id];
      if (a?.state === "Sent" || a?.state === "Don't have") have.add(k);
      else waiting.add(k);
    }
  return { have, waiting };
}

/** Open diligence lines for a read pitch, as things to ask the founder for. */
export function openLines(deal: DealResult): RequestItem[] {
  return diligence(deal)
    .flatMap((s) => s.items)
    .filter((i) => (i.status === "Ask founder" || i.status === "Claimed" || i.status === "Conflict") && !/^(Ask on|Done by the fund)/.test(i.request))
    .map((i) => ({ id: i.id, dd: i.id, label: i.request, why: i.why }));
}

// ---------- Request builder ----------

export interface BuilderTarget {
  companyId: string;
  companyName: string;
  side: "pitch" | "portfolio";
  founder: string;
  candidates: RequestItem[];
}

export function RequestBuilder({ target, onClose }: { target: BuilderTarget; onClose: () => void }) {
  const links = useLinks();
  const w = useWorkspace();
  const { have, waiting } = alreadyAsked(links.requests, target.companyId);
  const notYet = (list: RequestItem[]) => list.filter((c) => !have.has(c.dd ?? c.id) && !waiting.has(c.dd ?? c.id));
  const templates = TEMPLATES.filter((t) => t.side === target.side);
  const [source, setSource] = useState<string>(target.candidates.length ? "suggested" : templates[0]?.key ?? "suggested");
  const candidates = source === "suggested" ? target.candidates : (templates.find((t) => t.key === source)?.items ?? []);
  const fresh = notYet(candidates);
  const skipped = candidates.length - fresh.length;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(notYet(source === "suggested" ? target.candidates : (templates.find((t) => t.key === source)?.items ?? [])).map((c) => c.id)));
  const [custom, setCustom] = useState<RequestItem[]>([]);
  const [line, setLine] = useState("");
  const pick = (key: string) => {
    setSource(key);
    const list = key === "suggested" ? target.candidates : (templates.find((t) => t.key === key)?.items ?? []);
    setPicked(new Set([...notYet(list).map((c) => c.id), ...custom.map((c) => c.id)]));
  };
  const chosen = [...fresh.filter((c) => picked.has(c.id)), ...custom.filter((c) => picked.has(c.id))];
  const first = target.founder.split(" ")[0] || "there";
  const [note, setNote] = useState(
    target.side === "pitch"
      ? `Thanks for sending ${target.companyName}'s deck. To take this further, could you share the items below? Upload whatever you already have; no need to make anything new.`
      : `Could you share the items below for our records? Upload whatever you already have.`,
  );
  const [due, setDue] = useState(addDays(links.today, 7));
  const [made, setMade] = useState<FounderRequest | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const url = made ? `${window.location.origin}${linkPath(made)}` : "";
  const email = made
    ? `Hi ${first},\n\n${note}\n\nEverything is on one page, no sign-up needed:\n${url}\n\nIf you don't have something, just say so on the page. Please reply by ${fmtDay(due)}. If it's easier, you can also email files to ${inboxAddress(target.companyName)}.\n\nThanks,\n${w.me}\n${FUND_NAME}`
    : "";
  const copy = (what: string, text: string) =>
    navigator.clipboard?.writeText(text).then(
      () => setCopied(what),
      () => setCopied(null),
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Ask the founder">
      <button className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">{target.companyName}</p>
            <h2 className="text-lg font-semibold text-slate-900">{made ? "Link ready to send" : `Ask ${first} for documents`}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </header>

        {!made ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-sm text-slate-600">
              The founder gets one page with an upload box for each item. They can also answer &quot;I don&apos;t have this&quot;. Nothing is sent
              from here: you copy the link into your own email.
            </p>
            <div>
              <p className="text-xs font-medium text-slate-500">Start from</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[...(target.candidates.length ? [{ key: "suggested", name: target.side === "pitch" ? "Open diligence lines" : "Not asked this year", when: "Worked out from this company's record" }] : []), ...templates].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    title={t.when}
                    onClick={() => pick(t.key)}
                    className={cx("rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset", source === t.key ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">{source === "suggested" ? "Worked out from this company's record." : templates.find((t) => t.key === source)?.when}</p>
            </div>
            {fresh.length === 0 && custom.length === 0 ? (
              <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
                Nothing new to ask from this list. Everything on it has already been asked or sent. Try another list, or add your own line below.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {[...fresh, ...custom].map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset", on ? "bg-slate-50 ring-slate-200" : "ring-slate-200 hover:bg-slate-50")}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setPicked((s) => {
                              const n = new Set(s);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                          className="mt-0.5 h-4 w-4 accent-indigo-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">{c.label}</span>
                          {c.why && <span className="block text-xs text-slate-500">{c.why}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const label = line.trim();
                if (!label) return;
                const item: RequestItem = { id: `own-${Date.now().toString(36)}`, label };
                setCustom((c) => [...c, item]);
                setPicked((p) => new Set([...p, item.id]));
                setLine("");
              }}
            >
              <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Add your own line, e.g. Signed contract with the largest customer" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              <button className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Add</button>
            </form>
            {skipped > 0 && (
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">Ask once:</span> {skipped} {skipped === 1 ? "item is" : "items are"} left out because{" "}
                {target.companyName} already sent {skipped === 1 ? "it" : "them"}, said they don&apos;t have {skipped === 1 ? "it" : "them"}, or
                was already asked.
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Note to the founder</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Reply by
              <input type="date" value={due} min={links.today} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            </label>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-xs font-medium text-slate-500">Private link for {target.founder}</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900">{url}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy("link", url)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                {copied === "link" ? "Copied" : "Copy link"}
              </button>
              <button onClick={() => copy("email", email)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                {copied === "email" ? "Copied" : "Copy email text"}
              </button>
              <a href={linkPath(made)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                Open as the founder ↗
              </a>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-sm text-slate-700 ring-1 ring-slate-200">{email}</pre>
            <p className="text-xs text-slate-500">
              What comes back shows in the Data room and on this company, marked new until someone checks it. Prototype: the founder page has to be
              opened in this browser.
            </p>
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {!made ? (
            <>
              <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={!chosen.length}
                onClick={() =>
                  setMade(
                    links.createRequest({
                      companyId: target.companyId,
                      companyName: target.companyName,
                      side: target.side,
                      founder: target.founder,
                      from: w.me,
                      due,
                      note,
                      items: chosen,
                    }),
                  )
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Create link ({chosen.length} {chosen.length === 1 ? "item" : "items"})
              </button>
            </>
          ) : (
            <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Done
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---------- Files ----------

export function FileName({ f, href, name: label, className }: { f?: LinkFile; href?: string; name?: string; className?: string }) {
  const links = useLinks();
  const [none, setNone] = useState(false);
  const name = f?.name ?? label ?? href?.split("/").pop() ?? "";
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cx("truncate text-indigo-700 hover:underline", className)}>
        {name}
      </a>
    );
  if (!f?.key) return <span className={cx("truncate text-slate-700", className)} title="Sample file name. The file itself isn't included in the prototype.">{name}</span>;
  return (
    <button
      onClick={async () => setNone(!(await links.openFile(f)))}
      className={cx("truncate text-left text-indigo-700 hover:underline", className)}
      title={none ? "Not in this browser" : "Open the file"}
    >
      {name}
      {none && <span className="ml-1 text-xs text-slate-400">(not in this browser)</span>}
    </button>
  );
}

// ---------- Data room ----------

export type AiState = "Read by AI" | "Read in Claude chat" | "Waiting for AI" | "Founder typed numbers";

export const AI_HELP: Record<AiState, string> = {
  "Read by AI": "The AI turned this file into the standard record. Every number it took keeps its page.",
  "Read in Claude chat": "Read in a Claude chat (no API key) and saved as the standard record.",
  "Waiting for AI": "Stored as received. No AI has read it yet: that needs an API key, or a run in a Claude chat.",
  "Founder typed numbers": "The founder typed the numbers into the monthly form; the file is kept as the source.",
};

export interface RoomFile {
  key: string;
  name: string;
  at: string;
  /** What this file is, in words: the request line it answers, or the report month. */
  what: string;
  channel: Channel;
  sender: string;
  ai: AiState;
  folder: string;
  /** For a file nobody has filed yet: a folder suggested from its name only. */
  suggested?: string;
  file?: LinkFile;
  href?: string;
  /** Sent by the founder and not yet checked (or filed) by anyone at the fund. */
  isNew?: boolean;
  check?: { reqId: string; itemId: string };
  checkedBy?: { by: string; at: string };
  email?: { id: string; subject: string; answers?: string; answersLabel?: string };
}

export interface RoomMissing {
  key: string;
  label: string;
  meta: string;
  overdue: boolean;
  days: number;
  askedBy?: string;
  answer?: string;
  linkId?: string;
  folder: string;
}

/** Something still open that a file could answer: a request line, or a portfolio document the fund asked for. */
export interface OpenSlot {
  key: string; // "req:<reqId>:<itemId>" or "doc:<requestId>"
  label: string;
  folder: string;
}

export interface RoomRow {
  id: string;
  name: string;
  side: "pitch" | "portfolio";
  owner?: string;
  href: string;
  founder: string;
  email: string;
  inbox: string;
  status: string;
  shared: RoomFile[];
  missing: RoomMissing[];
  need: RequestItem[];
  open: OpenSlot[];
  newCount: number;
  toFile: number;
  overdue: number;
  waitingAi: number;
}

function requestBits(reqs: FounderRequest[], today: string, founder: string) {
  const shared: RoomFile[] = [];
  const missing: RoomMissing[] = [];
  const open: OpenSlot[] = [];
  for (const r of reqs)
    for (const i of r.items) {
      const a = r.answers[i.id];
      const st = itemStatus(r, i.id, today);
      const folder = folderFor(i.dd ?? i.id, i.label);
      if (a?.state === "Sent") {
        for (const f of a.files)
          if (!f.viaEmail)
            shared.push({
              key: `${r.id}:${i.id}:${f.name}`,
              name: f.name,
              at: f.at,
              what: i.label,
              channel: "Request link",
              sender: founder,
              ai: "Waiting for AI",
              folder,
              file: f,
              isNew: !r.checked[i.id],
              check: { reqId: r.id, itemId: i.id },
              checkedBy: r.checked[i.id],
            });
      } else {
        open.push({ key: `req:${r.id}:${i.id}`, label: i.label, folder });
        missing.push({
          key: `${r.id}:${i.id}`,
          label: i.label,
          meta:
            st === "Don't have"
              ? `Founder doesn't have it${a?.note ? `: “${a.note}”` : ""}`
              : st === "Later"
                ? `Founder will send it by ${a?.by ? fmtDay(a.by) : "a later date"}${a?.note ? `: “${a.note}”` : ""}`
                : `Asked ${fmtDay(r.sentAt)} by ${r.from.split(" ")[0]} · ${st === "Overdue" ? `${daysBetween(r.due, today)} days late` : `due ${fmtDay(r.due)}`}`,
          overdue: st === "Overdue",
          days: st === "Overdue" ? daysBetween(r.due, today) : 0,
          askedBy: r.from,
          answer: st === "Don't have" || st === "Later" ? st : undefined,
          linkId: r.id,
          folder,
        });
      }
    }
  return { shared, missing, open };
}

function emailBits(mails: EmailIn[], sender: string): RoomFile[] {
  const out: RoomFile[] = [];
  for (const m of mails)
    for (const f of m.files) {
      const filed = m.filed[f.name];
      out.push({
        key: `${m.id}:${f.name}`,
        name: f.name,
        at: f.at,
        what: filed?.answersLabel ?? `“${m.subject}”`,
        channel: m.via === "Email" ? "Email" : "Founder portal",
        sender: m.from || sender,
        ai: "Waiting for AI",
        folder: filed?.folder ?? TO_FILE,
        suggested: filed ? undefined : guessFolder(`${f.name} ${m.subject}`),
        file: f,
        isNew: !filed,
        checkedBy: filed ? { by: filed.by, at: filed.at } : undefined,
        email: { id: m.id, subject: m.subject, answers: filed?.answers, answersLabel: filed?.answersLabel },
      });
    }
  return out;
}

const PITCH_CHANNEL: Record<string, Channel> = { Website: "Website pitch link", Referral: "Analyst's pitch link", Analyst: "Added by analyst", Email: "Pitch email" };

export function useDataRoom(): RoomRow[] {
  const store = useStore();
  const p = usePortfolio();
  const links = useLinks();
  return useMemo(() => {
    const today = p.today;
    const rows: RoomRow[] = [];
    const notAsked = (companyId: string, items: RequestItem[]) => {
      const { have, waiting } = alreadyAsked(links.requests, companyId);
      return items.filter((i) => !have.has(i.dd ?? i.id) && !waiting.has(i.dd ?? i.id));
    };
    const finish = (r: Omit<RoomRow, "newCount" | "toFile" | "overdue" | "waitingAi">): RoomRow => ({
      ...r,
      shared: r.shared.sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name)),
      newCount: r.shared.filter((f) => f.isNew).length,
      toFile: r.shared.filter((f) => f.folder === TO_FILE).length,
      overdue: r.missing.filter((m) => m.overdue).length,
      waitingAi: r.shared.filter((f) => f.ai === "Waiting for AI").length,
    });

    const pitchIds = new Set<string>([...store.deals.map((d) => d.id), ...store.unprocessed.map((s) => s.id), ...links.inbound.map((i) => i.id)]);
    for (const id of pitchIds) {
      if (store.statusOf(id) === "Passed") continue;
      const d = store.deals.find((x) => x.id === id);
      const s = sampleById(id);
      const inb = links.getInbound(id);
      const form = d?.form ?? s?.form ?? inb?.form;
      if (!form) continue;
      const founder = form.founders[0]?.name ?? "the founder";
      const email = form.email || founderEmail(founder, form.companyName);
      const shared: RoomFile[] = [];
      const read: AiState = d ? (d.processedBy === "chat" ? "Read in Claude chat" : "Read by AI") : "Waiting for AI";
      const at = (d?.receivedAt ?? s?.receivedAt ?? inb?.receivedAt ?? today).slice(0, 10);
      const deckBase = { at, sender: founder, ai: read, folder: "company" };
      if (inb) for (const f of inb.files) shared.push({ ...deckBase, key: f.key ?? f.name, name: f.name, at: f.at, what: "Pitch deck", channel: PITCH_CHANNEL[inb.via], file: f });
      else if (s) {
        shared.push({ ...deckBase, key: "deck", name: s.deckFile, what: "Pitch deck", channel: sampleChannel(id), href: `/samples/${s.deckFile}` });
        if (s.sheetFile) shared.push({ ...deckBase, key: "sheet", name: s.sheetFile, what: "Monthly numbers sheet", channel: sampleChannel(id), ai: d ? "Read by AI" : "Waiting for AI", folder: "financials", href: `/samples/${s.sheetFile}` });
      } else if (d) shared.push({ ...deckBase, key: "deck", name: d.deck.fileName, what: "Pitch deck", channel: "Added by analyst", href: d.deck.url ?? undefined });
      const bits = requestBits(links.requestsFor(id), today, founder);
      shared.push(...bits.shared, ...emailBits(links.emailsFor(id), email));
      rows.push(
        finish({
          id,
          name: form.companyName,
          side: "pitch",
          owner: links.ownerOf(id),
          href: `/deals/${id}`,
          founder,
          email,
          inbox: inboxAddress(form.companyName),
          status: d ? store.bandOf(d) : "Not read yet",
          shared,
          missing: bits.missing,
          need: notAsked(id, d ? openLines(d) : FIRST_LOOK),
          open: bits.open,
        }),
      );
    }

    for (const c of p.companies) {
      const founder = c.founders[0]?.name ?? "the founder";
      const email = founderEmail(founder, c.name);
      const mails = links.emailsFor(c.id);
      const fromMail = new Set(mails.flatMap((m) => m.files.map((f) => f.name)));
      const shared: RoomFile[] = [
        { key: "deck", name: c.pitch.deckFile, at: c.pitch.receivedAt.slice(0, 10), what: "Pitch deck before investing", channel: "Pitch form", sender: founder, ai: "Read by AI", folder: "company" },
      ];
      for (const r of c.reports)
        if (r.receivedAt && r.fileName)
          shared.push({ key: `mis-${r.month}`, name: r.fileName, at: r.receivedAt.slice(0, 10), what: `${fmtMonth(r.month)} monthly report`, channel: "Monthly report link", sender: founder, ai: "Founder typed numbers", folder: "reports" });
      for (const q of c.requests)
        if (q.receivedAt && q.fileName && !fromMail.has(q.fileName))
          shared.push({ key: `doc-${q.id}`, name: q.fileName, at: q.receivedAt.slice(0, 10), what: q.title, channel: "Asked by the fund", sender: founder, ai: "Waiting for AI", folder: folderFor(q.id, `${q.title} ${q.kind}`) });
      const bits = requestBits(links.requestsFor(c.id), today, founder);
      shared.push(...bits.shared, ...emailBits(mails, email));
      const missing: RoomMissing[] = missingItems(c, today)
        .filter((m) => !m.key.endsWith(":question"))
        .map((m) => ({
          key: m.key,
          label: m.what,
          meta: `${m.overdueDays > 0 ? `${m.overdueDays} days late` : "Due now"} · ${m.detail}`,
          overdue: m.overdueDays > 0,
          days: Math.max(0, m.overdueDays),
          askedBy: c.owner,
          folder: /report/i.test(m.what) && !/board/i.test(m.what) ? "reports" : guessFolder(m.what) ?? "company",
        }));
      missing.push(...bits.missing);
      const asked = new Set(c.requests.flatMap((q) => [q.id, q.title.toLowerCase()]));
      const docSlots: OpenSlot[] = c.requests.filter((q) => !q.receivedAt).map((q) => ({ key: `doc:${q.id}`, label: q.title, folder: folderFor(q.id, `${q.title} ${q.kind}`) }));
      rows.push(
        finish({
          id: c.id,
          name: c.name,
          side: "portfolio",
          owner: c.owner,
          href: `/portfolio/${c.id}`,
          founder,
          email,
          inbox: inboxAddress(c.name),
          status: "Portfolio",
          shared,
          missing,
          need: notAsked(c.id, PORTFOLIO_YEARLY.filter((i) => !asked.has(i.id) && !asked.has(i.label.toLowerCase()))),
          open: [...docSlots, ...bits.open],
        }),
      );
    }
    return rows.sort((a, b) => b.newCount - a.newCount || b.overdue - a.overdue || a.name.localeCompare(b.name));
  }, [store, p.companies, p.today, links]);
}

/** The data room rows this person may see: everything for a partner; for an analyst, their own companies and pitches. */
export function useMyDataRoom(): RoomRow[] {
  const all = useDataRoom();
  const w = useWorkspace();
  return useMemo(() => (w.role === "Partner" ? all : all.filter((r) => r.owner === w.me)), [all, w.role, w.me]);
}

// ---------- What analysts asked founders ----------

export interface AskLine {
  key: string;
  who: string;
  company: string;
  companyId: string;
  href: string;
  text: string;
  at: string;
  state: string;
  tone: "good" | "watch" | "urgent" | "info" | "new";
}

export function useFounderAsks(who?: string): AskLine[] {
  const links = useLinks();
  const p = usePortfolio();
  return useMemo(() => {
    const out: AskLine[] = [];
    for (const r of links.requests) {
      if (who && r.from !== who) continue;
      for (const i of r.items) {
        const st = itemStatus(r, i.id, links.today);
        out.push({
          key: `${r.id}:${i.id}`,
          who: r.from,
          company: r.companyName,
          companyId: r.companyId,
          href: r.side === "pitch" ? `/deals/${r.companyId}?tab=diligence` : `/portfolio/${r.companyId}`,
          text: i.label,
          at: r.sentAt,
          state: st === "Sent" ? (r.checked[i.id] ? "Sent, checked" : "Sent, not checked") : st === "Don't have" ? "Doesn't have it" : st === "Later" ? "Coming later" : st,
          tone: st === "Sent" ? (r.checked[i.id] ? "good" : "new") : st === "Overdue" ? "urgent" : st === "Waiting" ? "info" : "watch",
        });
      }
    }
    for (const c of p.companies) {
      if (who && c.owner !== who) continue;
      for (const r of c.reports)
        if (r.question)
          out.push({
            key: `${c.id}:${r.month}:q`,
            who: c.owner,
            company: c.name,
            companyId: c.id,
            href: `/portfolio/${c.id}?tab=reporting`,
            text: r.question.text,
            at: r.question.askedAt,
            state: r.question.answeredAt ? "Answered" : "Waiting",
            tone: r.question.answeredAt ? "good" : daysBetween(r.question.askedAt, p.today) > 7 ? "urgent" : "info",
          });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [links, p.companies, p.today, who]);
}

const ASK_TONE: Record<AskLine["tone"], string> = {
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  watch: "bg-amber-50 text-amber-800 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-slate-100 text-slate-600 ring-slate-200",
  new: "bg-slate-100 text-indigo-700 ring-slate-200",
};

export function AskList({ lines, showWho = true, limit = 8 }: { lines: AskLine[]; showWho?: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!lines.length) return <p className="text-sm text-slate-500">Nothing asked of founders yet.</p>;
  const shown = all ? lines : lines.slice(0, limit);
  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {shown.map((l) => (
          <li key={l.key} className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900">{l.text}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <a href={l.href} className="font-medium text-slate-700 hover:text-indigo-700">
                  {l.company}
                </a>
                {showWho && ` · ${l.who.split(" ")[0]}`} · asked {fmtDay(l.at)}
              </p>
            </div>
            <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", ASK_TONE[l.tone])}>{l.state}</span>
          </li>
        ))}
      </ul>
      {lines.length > limit && (
        <button onClick={() => setAll((x) => !x)} className="mt-1 text-xs font-medium text-indigo-700 hover:text-indigo-900">
          {all ? "Show fewer" : `Show all ${lines.length}`}
        </button>
      )}
    </div>
  );
}
