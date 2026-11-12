"use client";

// A signed-in founder's one page: everything the fund asked for, across every request, with an upload
// box for each; their monthly report; a place to send anything else; and what they've already sent.
// Founders see only their own company, and never the fund's notes, scores or bands.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { founderSession, setFounderSession, useFounderAccess, type FounderCompany } from "@/components/founder-access";
import { ItemCard } from "@/components/founder-item";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { Card, cx } from "@/components/ui";
import { fmtDay } from "@/lib/dates";
import { fmtMonth } from "@/lib/format";
import { FUND_NAME, REPLY_PROMISE_DAYS, inboxAddress, itemStatus } from "@/lib/links";
import { missingItems } from "@/lib/portfolio/health";

export default function FounderHome() {
  const router = useRouter();
  const links = useLinks();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const companies = useFounderAccess(email);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(founderSession());
    setChecked(true);
  }, []);
  useEffect(() => {
    if (checked && !email) router.replace("/founder");
  }, [checked, email, router]);

  if (!links.ready || !checked || !email) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!companies.length)
    return (
      <Card className="mx-auto max-w-lg p-6 text-center text-sm text-slate-600">
        Nothing is shared with {email} yet.{" "}
        <button
          onClick={() => {
            setFounderSession(null);
            router.replace("/founder");
          }}
          className="font-medium text-indigo-700"
        >
          Sign out
        </button>
      </Card>
    );

  const first = companies[0].founder.split(" ")[0];
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {FUND_NAME} · founder portal · {email}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi {first}</h1>
        </div>
        <button
          onClick={() => {
            setFounderSession(null);
            router.replace("/founder");
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
      {companies.map((c) => (
        <CompanyBlock key={c.id} c={c} email={email} />
      ))}
      <p className="text-xs leading-relaxed text-slate-500">
        Your files are kept exactly as you sent them and only the people at {FUND_NAME} working on your company see them.
      </p>
    </div>
  );
}

function CompanyBlock({ c, email }: { c: FounderCompany; email: string }) {
  const links = useLinks();
  const p = usePortfolio();
  const today = links.today;
  const todo = c.requests.flatMap((r) => r.items.filter((i) => !r.answers[i.id] || r.answers[i.id].state === "Later").map((i) => ({ r, i })));
  const done = c.requests.flatMap((r) => r.items.filter((i) => r.answers[i.id] && r.answers[i.id].state !== "Later").map((i) => ({ r, i })));
  const pc = c.side === "portfolio" ? p.get(c.id) : undefined;
  const owed = pc ? missingItems(pc, today).filter((m) => !m.key.endsWith(":question")) : [];
  const mails = links.emailsFor(c.id).filter((m) => m.from.toLowerCase() === email);
  const total = todo.length + owed.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
        <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
        <span className={cx("text-sm font-medium", total ? "text-amber-700" : "text-emerald-700")}>{total ? `${total} ${total === 1 ? "thing" : "things"} we still need` : "Nothing owed. Thank you."}</span>
      </div>

      {pc && owed.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-slate-900">Monthly reports and documents</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {owed.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="text-slate-900">{m.what}</span>
                  <span className={cx("block text-xs", m.overdueDays > 0 ? "text-red-700" : "text-slate-500")}>{m.overdueDays > 0 ? `${m.overdueDays} days past due` : "Due now"}</span>
                </span>
                {/report/i.test(m.what) && !/board/i.test(m.what) ? (
                  <Link href={`/founder/${c.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                    Send the report
                  </Link>
                ) : (
                  <SendFile c={c} email={email} subject={m.what} label="Upload" />
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Monthly reports are due on the 15th of the next month. {pc.reports.filter((r) => r.receivedAt).length} sent so far; last one{" "}
            {(() => {
              const last = pc.reports.filter((r) => r.receivedAt).at(-1);
              return last ? `${fmtMonth(last.month)}, sent ${fmtDay(last.receivedAt!.slice(0, 10))}` : "not yet";
            })()}
            .
          </p>
        </Card>
      )}

      {c.side === "pitch" && !c.requests.length && (
        <Card className="p-4 text-sm text-slate-700">
          We have your deck. Someone at the fund reads every pitch and replies within {REPLY_PROMISE_DAYS} days. If we need anything, it will
          show here.
        </Card>
      )}

      {todo.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-slate-900">What we asked for</h3>
          {c.requests
            .filter((r) => todo.some((t) => t.r.id === r.id))
            .map((r) => (
              <div key={r.id} className="space-y-2">
                <p className="text-xs text-slate-500">
                  From {r.from} · {fmtDay(r.sentAt)} · please reply by {fmtDay(r.due)}
                  {today > r.due && <span className="font-medium text-red-700"> · past the date</span>}
                </p>
                <ol className="space-y-3">
                  {r.items
                    .filter((i) => todo.some((t) => t.r.id === r.id && t.i.id === i.id))
                    .map((i) => (
                      <ItemCard key={i.id} r={r} item={i} n={r.items.indexOf(i) + 1} />
                    ))}
                </ol>
              </div>
            ))}
        </div>
      )}

      <Card className="p-4">
        <h3 className="font-medium text-slate-900">Send something else</h3>
        <p className="mt-0.5 text-sm text-slate-500">Anything the fund should see: an update, a contract, a new deck. Add a line so we know what it is.</p>
        <SendFile c={c} email={email} withNote label="Choose files" />
        <p className="mt-3 text-xs text-slate-500">
          Prefer email? Send files to <span className="font-mono text-slate-700">{inboxAddress(c.name)}</span> and they land in the same place.
        </p>
      </Card>

      {(done.length > 0 || mails.length > 0) && (
        <Card className="p-4">
          <h3 className="font-medium text-slate-900">Already sent</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {done.map(({ r, i }) => {
              const a = r.answers[i.id];
              const st = itemStatus(r, i.id, today);
              return (
                <li key={`${r.id}:${i.id}`} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-slate-900">{i.label}</span>
                    <span className="block truncate text-xs text-slate-500">{st === "Sent" ? a.files.map((f) => f.name).join(", ") : `You said you don't have this${a.note ? `: “${a.note}”` : ""}`}</span>
                  </span>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.checked[i.id] ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {st === "Sent" ? (r.checked[i.id] ? "Seen by the fund" : "Sent") : "Answered"}
                  </span>
                </li>
              );
            })}
            {mails.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="text-slate-900">{m.subject}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {m.files.map((f) => f.name).join(", ")} · {m.via === "Email" ? "by email" : "here"} · {fmtDay(m.at)}
                  </span>
                </span>
                <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", Object.keys(m.filed).length ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                  {Object.keys(m.filed).length ? "Seen by the fund" : "Sent"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function SendFile({ c, email, subject, label, withNote }: { c: FounderCompany; email: string; subject?: string; label: string; withNote?: boolean }) {
  const links = useLinks();
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    await links.addEmail({ companyId: c.id, companyName: c.name, side: c.side, from: email, subject: subject ?? (note.trim() || "Sent from the founder portal"), via: "Founder portal" }, Array.from(files));
    setBusy(false);
    setDone(true);
    setNote("");
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className={cx(withNote && "mt-3 flex flex-wrap items-center gap-2")}>
      {withNote && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is it? e.g. Signed MoU with a new customer" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />}
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => send(e.target.files)} />
      <button onClick={() => ref.current?.click()} disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:text-sm">
        {busy ? "Sending…" : done ? "Sent. Add more" : label}
      </button>
    </div>
  );
}
