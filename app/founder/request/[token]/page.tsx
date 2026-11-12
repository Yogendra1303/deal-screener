"use client";

// What a founder sees when they open a request link from the fund. No login, one page,
// one upload box per item. "I don't have this" and "I'll send it later" are real answers.
import Link from "next/link";
import { use } from "react";
import { ItemCard } from "@/components/founder-item";
import { useLinks } from "@/components/links-store";
import { Card } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { fmtDay } from "@/lib/dates";
import { FUND_NAME, inboxAddress, requestSummary } from "@/lib/links";

export default function FounderRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const links = useLinks();
  const w = useWorkspace();
  if (!links.ready) return <p className="text-sm text-slate-500">Loading…</p>;
  const r = links.getRequest(token);
  if (!r)
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">
        This link isn&apos;t valid, or it has expired. Ask your contact at the fund for a new one.
      </Card>
    );
  const s = requestSummary(r, links.today);
  const first = r.founder.split(" ")[0];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {w.session && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-indigo-900 ring-1 ring-inset ring-slate-200">
          <span>This is what {r.founder} sees at this link. They don&apos;t sign in.</span>
          <Link href={`/dataroom/${r.companyId}`} className="font-medium text-indigo-700 hover:text-indigo-900">
            ← Back to {r.companyName}&apos;s data room
          </Link>
        </div>
      )}

      <div>
        <p className="text-sm text-slate-500">
          {FUND_NAME} · request for {r.companyName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi {first}</h1>
        <p className="mt-2 text-slate-700">{r.note}</p>
        <p className="mt-2 text-sm text-slate-500">
          From {r.from} · sent {fmtDay(r.sentAt)} · please reply by {fmtDay(r.due)}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-900">
            {s.answered} of {s.asked} answered
          </span>
          <span className="text-slate-500">Upload what you already have. No need to retype anything.</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(s.answered / s.asked) * 100}%` }} />
        </div>
      </Card>

      <ol className="space-y-3">
        {r.items.map((i, n) => (
          <ItemCard key={i.id} r={r} item={i} n={n + 1} />
        ))}
      </ol>

      {s.answered === s.asked && (
        <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
          <p className="font-semibold">Thank you, that&apos;s everything.</p>
          <p className="mt-1">{r.from} can see it now and will come back to you. You can still add files to any line above.</p>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Your files are kept exactly as you sent them and are only seen by the people at {FUND_NAME} working on {r.companyName}. You can also
        see everything the fund has asked you for in one place on the <Link href="/founder" className="underline">founder portal</Link>, or
        email files to {inboxAddress(r.companyName)}.
      </p>
    </div>
  );
}
