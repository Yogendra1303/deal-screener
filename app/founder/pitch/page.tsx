"use client";

// The one public link: "Send us your pitch". A founder gives a name, an email and the deck, and can
// add a numbers sheet. The AI fills in the rest from the deck later. About two minutes.
// With ?ref=riya it is an analyst's personal link, and the pitch goes straight to that analyst.
import Link from "next/link";
import { use, useState } from "react";
import { Disclosure } from "@/components/disclosure";
import { useLinks } from "@/components/links-store";
import { Card } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FUND_NAME, REPLY_PROMISE_DAYS, slugOf } from "@/lib/links";
import { ANALYSTS } from "@/lib/team";
import { COUNTRIES, SECTORS, STAGES } from "@/lib/types";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

export default function PitchLinkPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = use(searchParams);
  const links = useLinks();
  const w = useWorkspace();
  const referrer = ANALYSTS.find((a) => slugOf(a.name) === ref)?.name;
  const [f, setF] = useState({ company: "", founder: "", email: "", website: "", stage: "Seed", sector: "B2B software", country: "India", raising: "", line: "" });
  const [deck, setDeck] = useState<File | null>(null);
  const [sheet, setSheet] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.company.trim() || !f.founder.trim() || !f.email.trim()) return setError("Add the company name, your name and your email.");
    if (!deck) return setError("Attach your pitch deck as a PDF.");
    setBusy(true);
    const amount = Number(f.raising.replace(/[^0-9.]/g, ""));
    await links.addInbound(
      {
        via: referrer ? "Referral" : "Website",
        referrer,
        owner: referrer,
        receivedAt: `${links.today}T${new Date().toISOString().slice(11, 19)}Z`,
        oneLiner: f.line.trim() || undefined,
        form: {
          companyName: f.company.trim(),
          website: f.website.trim(),
          country: f.country,
          sector: f.sector,
          stage: f.stage,
          amountUsd: amount > 0 ? amount : null,
          founders: [{ name: f.founder.trim(), profileUrl: "" }],
          email: f.email.trim(),
        },
      },
      [deck, ...(sheet ? [sheet] : [])],
    );
    setBusy(false);
    setDone(f.founder.trim().split(" ")[0]);
  }

  if (done)
    return (
      <Card className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <p className="text-2xl">✓</p>
        <h1 className="text-xl font-semibold">Thanks, {done}. We have your deck.</h1>
        <p className="text-sm text-slate-600">
          Someone at {FUND_NAME} will read it and reply within {REPLY_PROMISE_DAYS} days, yes or no. If we&apos;d like to know more, we&apos;ll
          send you a link with exactly what we need.
        </p>
        {w.session && (
          <Link href="/deals" className="inline-block pt-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
            ← See it in Pitches
          </Link>
        )}
      </Card>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {w.session && (
        <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-indigo-900 ring-1 ring-inset ring-slate-200">
          This is the public pitch link founders see{referrer ? `, as ${referrer}'s personal link` : ""}. It lands in Pitches as a new pitch.
        </div>
      )}
      <div>
        <p className="text-sm text-slate-500">{FUND_NAME}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Send us your pitch</h1>
        <p className="mt-2 text-slate-600">
          Three things and your deck. It takes about two minutes. We read every deck and reply within {REPLY_PROMISE_DAYS} days
          {referrer ? `. ${referrer} will look at yours.` : "."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required>
              <input className={input} value={f.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="Your name" required>
              <input className={input} value={f.founder} onChange={(e) => set("founder", e.target.value)} />
            </Field>
            <Field label="Email" required>
              <input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Website">
              <input className={input} value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Pitch deck (PDF)" required>
            <input type="file" accept="application/pdf" onChange={(e) => setDeck(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
          </Field>
        </Card>

        <Disclosure className="rounded-2xl bg-white ring-1 ring-slate-200" buttonClassName="px-5 py-4 text-sm font-medium text-slate-800" summary="Optional: a few more details">
          <div className="space-y-4 px-5 pb-5">
            <p className="text-xs text-slate-500">Skip these if they&apos;re in your deck. We read them from there.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Stage">
                <select className={input} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sector">
                <select className={input} value={f.sector} onChange={(e) => set("sector", e.target.value)}>
                  {SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Country">
                <select className={input} value={f.country} onChange={(e) => set("country", e.target.value)}>
                  {COUNTRIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Raising (USD)">
                <input className={input} value={f.raising} onChange={(e) => set("raising", e.target.value)} placeholder="e.g. 1500000" inputMode="numeric" />
              </Field>
              <Field label="What you do, in one line">
                <input className={input} value={f.line} onChange={(e) => set("line", e.target.value)} />
              </Field>
            </div>
            <Field label="Monthly numbers or MIS (CSV, Excel or PDF)">
              <input type="file" onChange={(e) => setSheet(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
            </Field>
          </div>
        </Disclosure>

        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto">
          {busy ? "Sending…" : "Send pitch"}
        </button>
        <p className="text-xs text-slate-500">
          Your deck is only seen by the {FUND_NAME} team and indexed directly into the screening workspace.
        </p>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-slate-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
