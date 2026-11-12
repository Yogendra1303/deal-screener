"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLinks } from "@/components/links-store";
import { useStore } from "@/components/store";
import { useWorkspace } from "@/components/workspace";
import { Button, Card, Notice, Spinner } from "@/components/ui";
import { HOSTED_UPLOAD_LIMIT, isLocalhost, processOnServer } from "@/lib/client-api";
import { saveDeck } from "@/lib/deckstore";
import { putServerFile } from "@/lib/db/client";
import { COUNTRIES, SECTORS, STAGES, type FormInput } from "@/lib/types";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

export default function NewDealPage() {
  const router = useRouter();
  const store = useStore();
  const links = useLinks();
  const w = useWorkspace();
  const noKey = store.server?.hasKey === false;
  const [form, setForm] = useState<FormInput>({
    companyName: "",
    website: "",
    country: "India",
    sector: "B2B software",
    stage: "Seed",
    amountUsd: null,
    founders: [
      { name: "", profileUrl: "" },
      { name: "", profileUrl: "" },
    ],
    email: "",
  });
  const [deck, setDeck] = useState<File | null>(null);
  const [sheet, setSheet] = useState<File | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormInput>(k: K, v: FormInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!deck) return setError("Attach the pitch deck as a PDF.");
    if (noKey) {
      // No API key: keep the deck as a new pitch for this analyst. It gets read later.
      setRunning(true);
      const entry = await links.addInbound(
        { via: "Analyst", owner: w.me, receivedAt: `${links.today}T${new Date().toISOString().slice(11, 19)}Z`, form: { ...form, founders: form.founders.filter((f) => f.name.trim()) } },
        [deck, ...(sheet ? [sheet] : [])],
      );
      router.push(`/deals/${entry.id}`);
      return;
    }
    if (!isLocalhost() && deck.size > HOSTED_UPLOAD_LIMIT)
      return setError("On the hosted demo, decks must be under 4.4 MB (a Vercel limit). Run it locally for larger files.");
    const fd = new FormData();
    fd.set("deck", deck);
    if (sheet) fd.set("sheet", sheet);
    fd.set(
      "form",
      JSON.stringify({ ...form, founders: form.founders.filter((f) => f.name.trim()) } satisfies FormInput),
    );
    setRunning(true);
    setSteps([]);
    try {
      const deal = await processOnServer(fd, (m) => setSteps((s) => [...s, m]));
      await saveDeck(deal.id, deck);
      const url = await putServerFile(deal.id, "deck_pdf", deck, deck.name);
      if (sheet) await putServerFile(deal.id, "monthly_csv", sheet, sheet.name);
      store.saveDeal(url ? { ...deal, deck: { ...deal.deck, url } } : deal);
      router.push(`/deals/${deal.id}`);
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
    }
  }

  if (w.ready && w.role === "Partner")
    return (
      <Card className="mx-auto max-w-lg space-y-2 p-8 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-900">Analysts add pitches.</p>
        <p>Pitches reach you from founders&apos; links and from the team. You see all of them under Pitches.</p>
        <Link href="/deals" className="inline-block pt-1 font-medium text-indigo-700 hover:text-indigo-900">
          ← Pitches
        </Link>
      </Card>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a pitch</h1>
        <p className="mt-1 text-sm text-slate-600">
          For a deck that reached you by email or at a meeting. Founders can also send their own through your pitch link on the Pitches page.
          Any deck layout works; the AI turns it into the standard record.
        </p>
      </div>

      {noKey && (
        <Notice tone="warn">
          No API key is set, so the deck is saved as a new pitch for you and read later (or in a Claude chat). Nothing is made up meanwhile.
        </Notice>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Company</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Company name *</span>
              <input required className={input} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Website</span>
              <input className={input} value={form.website} onChange={(e) => set("website", e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Country</span>
              <select className={input} value={form.country} onChange={(e) => set("country", e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Sector</span>
              <select className={input} value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                {SECTORS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Stage</span>
              <select className={input} value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                {STAGES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-700">Amount raising (USD)</span>
              <input
                type="number"
                min={0}
                step={10000}
                className={input}
                value={form.amountUsd ?? ""}
                onChange={(e) => set("amountUsd", e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-slate-700">Contact email</span>
              <input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Founders</h2>
          {form.founders.map((f, i) => (
            <div key={i} className="grid gap-4 sm:grid-cols-2">
              <input
                className={input}
                placeholder={`Founder ${i + 1} name`}
                value={f.name}
                onChange={(e) =>
                  set(
                    "founders",
                    form.founders.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <input
                className={input}
                placeholder="Profile link (LinkedIn or similar)"
                value={f.profileUrl}
                onChange={(e) =>
                  set(
                    "founders",
                    form.founders.map((x, j) => (j === i ? { ...x, profileUrl: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
          {form.founders.length < 4 && (
            <button
              type="button"
              onClick={() => set("founders", [...form.founders, { name: "", profileUrl: "" }])}
              className="text-sm font-medium text-indigo-700"
            >
              + Add a founder
            </button>
          )}
          <p className="text-xs text-slate-500">
            Founder profile and company registry checks run automatically during screening.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Documents</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Pitch deck (PDF) *</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setDeck(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Monthly numbers sheet (CSV, optional)</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setSheet(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <span className="block text-xs text-slate-500">
              Columns: month, currency, revenue, customers, headcount, net_burn, cash.{" "}
              <a href="/samples/template.csv" className="text-indigo-700 underline">
                Download a template
              </a>
            </span>
          </label>
        </Card>

        {error && <Notice tone="error">{error}</Notice>}

        {running && (
          <Card className="p-5">
            <ul className="space-y-1.5 text-sm">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700">
                  {i === steps.length - 1 && s !== "Done" ? <Spinner /> : <span className="text-emerald-600">✓</span>}
                  {s}
                </li>
              ))}
              {steps.length === 0 && (
                <li className="flex items-center gap-2 text-slate-700">
                  <Spinner /> Uploading
                </li>
              )}
            </ul>
          </Card>
        )}

        <Button type="submit" disabled={running}>
          {running ? "Processing…" : noKey ? "Save the pitch" : "Screen this deck"}
        </Button>
      </form>
    </div>
  );
}
