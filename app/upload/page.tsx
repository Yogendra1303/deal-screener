"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLinks } from "@/components/links-store";
import { useWorkspace } from "@/components/workspace";
import { Card, Notice, cx } from "@/components/ui";
import type { Relation } from "@/lib/funnel";
import type { Gold } from "@/lib/gold";
import { parseSheet } from "@/lib/sheet";
import { summariseSheet, type SheetSummary } from "@/lib/csv-parser";
import { fmtMoney, fmtNum } from "@/lib/format";
import { COUNTRIES, SECTORS, STAGES, type SheetRow } from "@/lib/types";
import { checkUpload, founderFromInput, type ManualReading } from "@/lib/upload";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";
const label = "space-y-1 text-sm";
const cap = "text-xs font-medium text-slate-600";

type Founder = { name: string; past: string; years: string; relation: Relation; builtBefore: boolean };
const NEW_FOUNDER: Founder = { name: "", past: "", years: "", relation: "direct", builtBefore: false };

const NUMBERS: { key: keyof Gold; label: string; hint: string; money?: boolean }[] = [
  { key: "mrr", label: "Monthly revenue (MRR)", hint: "USD a month", money: true },
  { key: "arr", label: "Annual revenue (ARR)", hint: "USD a year", money: true },
  { key: "growth", label: "Monthly growth", hint: "% a month" },
  { key: "customers", label: "Customers", hint: "count" },
  { key: "team", label: "Team size", hint: "people" },
  { key: "burn", label: "Monthly burn", hint: "USD a month", money: true },
  { key: "cash", label: "Cash in bank", hint: "USD", money: true },
  { key: "runway", label: "Runway", hint: "months" },
  { key: "round", label: "Round ask in the deck", hint: "USD" },
  { key: "founded", label: "Year founded", hint: "e.g. 2023" },
];

const num = (s: string) => {
  const v = Number(s.replace(/[, ]/g, ""));
  return s.trim() && Number.isFinite(v) ? v : null;
};

/** What code worked out from the CSV the moment it was picked. Every figure is a sum, not a guess. */
function SheetCard({ s }: { s: SheetSummary }) {
  const money = (v: number | null) => (v == null ? "—" : fmtMoney(v, s.currency || "USD"));
  const rows: [string, string, string][] = [
    ["Latest MRR", money(s.mrr), `${s.to} row`],
    ["Implied ARR", money(s.impliedArr), "MRR × 12"],
    ["Month on month", s.momGrowthPct == null ? "—" : `${s.momGrowthPct}%`, "last two months"],
    ["Average growth", s.avgGrowthPct == null ? "—" : `${s.avgGrowthPct}%`, "compounded, 6 months"],
    ["Customers", s.customers == null ? "—" : fmtNum(s.customers), "latest month"],
    ["Monthly burn", money(s.burn), "latest month"],
    ["Cash", money(s.cash), "latest month"],
    ["Runway", s.runwayMonths == null ? "—" : `${s.runwayMonths} months`, "cash ÷ burn"],
    ["Headcount", s.headcount == null ? "—" : fmtNum(s.headcount), "latest month"],
  ];
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
      <p className="text-xs font-semibold text-emerald-900">
        Read {s.months} months, {s.from} to {s.to}. Worked out by code from the sheet:
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {rows.map(([k, v, how]) => (
          <div key={k}>
            <dt className="text-[11px] text-slate-500">{k}</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-slate-900">{v}</dd>
            <dd className="text-[10px] text-slate-400">{how}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-slate-500">A blank column stays blank. These figures are compared with the deck&apos;s own numbers below.</p>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const links = useLinks();
  const w = useWorkspace();
  const [deck, setDeck] = useState<File | null>(null);
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<SheetRow[] | null>(null);
  const [summary, setSummary] = useState<SheetSummary | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [co, setCo] = useState({ name: "", website: "", country: "India", city: "", sector: SECTORS[0], sub: "", stage: "Seed", ask: "", email: "" });
  const [founders, setFounders] = useState<Founder[]>([{ ...NEW_FOUNDER }]);
  const [nums, setNums] = useState<Record<string, string>>({});
  const [asOf, setAsOf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickSheet(f: File | null) {
    setSheetFile(f);
    setSheet(null);
    setSummary(null);
    setSheetError(null);
    if (!f) return;
    try {
      const rows = parseSheet(await f.text());
      setSheet(rows);
      setSummary(summariseSheet(rows));
      if (!asOf) setAsOf(rows[rows.length - 1].month);
    } catch (e) {
      setSheetError((e as Error).message);
    }
  }

  const form = {
    companyName: co.name.trim(),
    website: co.website.trim(),
    country: co.country,
    sector: co.sector,
    stage: co.stage,
    amountUsd: num(co.ask),
    founders: founders.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), profileUrl: "" })),
    email: co.email.trim(),
  };
  const money = (k: string) => (num(nums[k] ?? "") != null ? { amount: num(nums[k])!, currency: "USD" } : null);
  const gold: Gold = {
    mrr: money("mrr"),
    arr: money("arr"),
    growth: num(nums.growth ?? ""),
    customers: num(nums.customers ?? ""),
    team: num(nums.team ?? ""),
    burn: money("burn"),
    cash: money("cash"),
    runway: num(nums.runway ?? ""),
    round: num(nums.round ?? ""),
    founded: num(nums.founded ?? ""),
  };
  const year = Number((links.today || "2026").slice(0, 4));
  const manual: ManualReading = {
    gold,
    asOf: asOf || null,
    sub: co.sub.trim() || co.sector,
    city: co.city.trim(),
    founders: founders.filter((f) => f.name.trim()).map((f) => founderFromInput({ ...f, name: f.name.trim(), years: num(f.years) ?? 0 }, year)),
    sheet,
    sheetFile: sheetFile?.name ?? null,
    deckFile: deck?.name ?? null,
    by: w.me,
  };
  const preview = form.companyName ? checkUpload(form, manual) : null;
  const gaps = preview?.flags.filter((f) => f.kind === "conflict") ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.companyName) return setError("Enter the company name.");
    if (!deck) return setError("Attach the pitch deck as a PDF.");
    if (sheetFile && !sheet) return setError("The monthly sheet could not be read. Fix it or remove it.");
    setSaving(true);
    const entry = await links.addInbound(
      { via: "Analyst", owner: w.me, receivedAt: `${links.today}T${new Date().toISOString().slice(11, 19)}Z`, form, oneLiner: `${manual.sub} in ${manual.city || form.country}`, manual },
      [deck, ...(sheetFile ? [sheetFile] : [])],
    );
    router.push(`/deals/${entry.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/deals" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Pitches
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Upload a pitch</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add the deck PDF and the monthly CSV, then type the numbers the deck states. Code parses the sheet, runs the same 10% checks and works out founder fit. Nothing is
          guessed: a blank stays blank and shows as missing.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Files</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className={cap}>Pitch deck (.pdf)</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => setDeck(e.target.files?.[0] ?? null)} className={cx(input, "file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs")} />
            </label>
            <label className={label}>
              <span className={cap}>Monthly metrics sheet (.csv, optional)</span>
              <input type="file" accept=".csv,text/csv" onChange={(e) => pickSheet(e.target.files?.[0] ?? null)} className={cx(input, "file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs")} />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Sheet columns: month, currency, revenue, customers, headcount, net_burn, cash.{" "}
            <a href="/samples/template.csv" download className="font-medium text-slate-900 underline">
              Download the template
            </a>
            .
          </p>
          {sheetError && <Notice tone="error">Sheet not read: {sheetError}</Notice>}
          {summary && <SheetCard s={summary} />}
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Company</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className={cap}>Company name</span>
              <input className={input} value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} required />
            </label>
            <label className={label}>
              <span className={cap}>Website (optional)</span>
              <input className={input} value={co.website} onChange={(e) => setCo({ ...co, website: e.target.value })} />
            </label>
            <label className={label}>
              <span className={cap}>Sector</span>
              <select className={input} value={co.sector} onChange={(e) => setCo({ ...co, sector: e.target.value })}>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className={cap}>Sub-category</span>
              <input className={input} placeholder="e.g. Freight software" value={co.sub} onChange={(e) => setCo({ ...co, sub: e.target.value })} />
            </label>
            <label className={label}>
              <span className={cap}>Stage</span>
              <select className={input} value={co.stage} onChange={(e) => setCo({ ...co, stage: e.target.value })}>
                {STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className={cap}>Round ask on the form (USD)</span>
              <input className={input} inputMode="numeric" placeholder="2000000" value={co.ask} onChange={(e) => setCo({ ...co, ask: e.target.value })} />
            </label>
            <label className={label}>
              <span className={cap}>Country</span>
              <select className={input} value={co.country} onChange={(e) => setCo({ ...co, country: e.target.value })}>
                {COUNTRIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className={cap}>City</span>
              <input className={input} value={co.city} onChange={(e) => setCo({ ...co, city: e.target.value })} />
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Founders</h2>
            {founders.length < 3 && (
              <button type="button" onClick={() => setFounders([...founders, { ...NEW_FOUNDER }])} className="text-sm font-medium text-slate-700 hover:text-slate-900">
                + Add founder
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">Experience only, as the deck&apos;s team page states it. No school, age or home town.</p>
          {founders.map((f, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_90px]">
              <input className={input} placeholder="Name" value={f.name} onChange={(e) => setFounders(founders.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <input className={input} placeholder="Main past role, e.g. Ops head at a 3PL" value={f.past} onChange={(e) => setFounders(founders.map((x, k) => (k === i ? { ...x, past: e.target.value } : x)))} />
              <input className={input} inputMode="numeric" placeholder="Years" value={f.years} onChange={(e) => setFounders(founders.map((x, k) => (k === i ? { ...x, years: e.target.value } : x)))} />
              <select className={input} value={f.relation} onChange={(e) => setFounders(founders.map((x, k) => (k === i ? { ...x, relation: e.target.value as Relation } : x)))}>
                <option value="direct">Worked on this exact problem</option>
                <option value="adjacent">Worked next to it</option>
                <option value="none">Unrelated work</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={f.builtBefore} onChange={(e) => setFounders(founders.map((x, k) => (k === i ? { ...x, builtBefore: e.target.checked } : x)))} />
                Built a company before
              </label>
            </div>
          ))}
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">Numbers the deck states</h2>
            <p className="mt-1 text-xs text-slate-500">Type them exactly as the deck shows them. Leave blank anything the deck leaves out.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {NUMBERS.map((n) => (
              <label key={n.key} className={label}>
                <span className={cap}>
                  {n.label} <span className="font-normal text-slate-400">({n.hint})</span>
                </span>
                <input className={cx(input, "text-right tabular-nums")} inputMode="decimal" value={nums[n.key] ?? ""} onChange={(e) => setNums({ ...nums, [n.key]: e.target.value })} />
              </label>
            ))}
            <label className={label}>
              <span className={cap}>
                Numbers as of <span className="font-normal text-slate-400">(month)</span>
              </span>
              <input className={input} type="month" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </label>
          </div>
        </Card>

        {preview && (
          <Card className="space-y-1.5 p-5 text-sm">
            <h2 className="font-semibold text-slate-900">What the checks find so far</h2>
            <p className="text-slate-700">
              {preview.cover.ran ? `${preview.cover.passed} of ${preview.cover.ran} checks matched.` : "No check can run yet."} {gaps.length ? `${gaps.length} gap${gaps.length > 1 ? "s" : ""} over 10%: ${gaps.map((g) => g.title).join("; ")}.` : "No gaps over 10%."}{" "}
              {preview.cover.missing.length ? `Missing: ${preview.cover.missing.join(", ")}.` : ""}
            </p>
            {preview.fit && <p className="text-slate-700">Founder fit: {preview.fit.level}.</p>}
          </Card>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex items-center justify-end gap-3">
          <Link href="/deals" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {saving ? "Saving…" : "Save and run checks"}
          </button>
        </div>
      </form>
    </div>
  );
}
