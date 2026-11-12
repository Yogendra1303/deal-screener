"use client";

import Link from "next/link";
import { useState } from "react";
import { setMode, useMode } from "@/components/mode";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { useWorkspace } from "@/components/workspace";
import { useStore } from "@/components/store";
import { resetEverything } from "@/components/shell";
import { DB_TEXT, useDbInfo } from "@/lib/db/client";
import { cx } from "@/components/ui";
import { SAMPLES } from "@/lib/data";
import { FLOW } from "@/lib/flow";
import { MODE_TEXT, isUploaded, type WorkspaceMode } from "@/lib/mode";

const OPTIONS: { mode: WorkspaceMode; action: string; count: (up: number) => string; danger?: boolean }[] = [
  { mode: "ZERO", action: "Hide sample data, start empty", count: (up) => `${up} ${up === 1 ? "pitch" : "pitches"} (your uploads only)`, danger: false },
  { mode: "TEST_10", action: "Keep only the 10 test decks", count: (up) => `${SAMPLES.length + up} pitches`, danger: false },
  { mode: "FULL_90", action: "Show the full demo data", count: (up) => `${SAMPLES.length + FLOW.length + 1 + up} pitches`, danger: false },
];

export default function WorkspacePage() {
  const mode = useMode();
  const store = useStore();
  const links = useLinks();
  const db = useDbInfo();
  const uploads = [...links.inbound.filter((i) => isUploaded(i.id)), ...store.deals.filter((d) => isUploaded(d.id) && !links.inbound.some((i) => i.id === d.id))];
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">More</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Workspace &amp; Reset</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Choose what data the app shows. Switching modes hides or shows sample data and deletes nothing; your uploads show in every mode. The only delete is the reset at the bottom.
          </p>
        </div>
        <Link href="/upload" className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          + Upload Pitch
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((o) => {
          const on = mode === o.mode;
          return (
            <section key={o.mode} className={cx("flex flex-col rounded-xl border bg-white p-4", on ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200")}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-600">{o.mode}</span>
                {on && <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Active</span>}
              </div>
              <h2 className="mt-3 font-semibold text-slate-900">{MODE_TEXT[o.mode].name}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-600">{MODE_TEXT[o.mode].help}</p>
              <p className="mt-3 text-xs text-slate-500">
                Shows <span className="font-semibold tabular-nums text-slate-800">{o.count(uploads.length)}</span>
              </p>
              <button
                onClick={() => setMode(o.mode)}
                disabled={on}
                className={cx(
                  "mt-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-default",
                  on ? "bg-slate-100 text-slate-400" : o.danger ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-slate-900 text-white hover:bg-slate-800",
                )}
              >
                {on ? "Current mode" : o.action}
              </button>
            </section>
          );
        })}
      </div>

      <section className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Your uploads</h2>
          <span className="text-xs text-slate-500">{db ? DB_TEXT[db.driver].short : "Checking where saves go"}</span>
        </div>
        {uploads.length ? (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {uploads.map((u) => {
              const form = u.form;
              return (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/deals/${u.id}`} className="min-w-0 truncate font-medium text-slate-900 hover:underline">
                    {form.companyName}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">
                    {form.sector} · {form.stage}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            None yet. Use <span className="font-semibold">+ Upload Pitch</span> to add a deck PDF and a monthly CSV. The checks run as soon as you save, and the pitch shows on Pitches, Market and Home.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Where changes are saved</h2>
        <p className="mt-1 text-sm text-slate-600">{db ? DB_TEXT[db.driver].help : "Asking the server."}</p>
        {db?.driver === "none" && (
          <p className="mt-2 text-xs text-slate-500">
            To share across browsers, set <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> on the server, then run supabase/schema.sql once in the Supabase SQL editor.
          </p>
        )}
      </section>

      <ResetBox />
    </div>
  );
}

/** The one destructive control, kept apart from the mode switch above: it wipes statuses, notes, requests and uploads in this browser. */
function ResetBox() {
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();
  const store = useStore();
  const db = useDbInfo();
  const [armed, setArmed] = useState(false);
  const changed = p.changed || w.questionsChanged || links.changed || store.changed;
  const where = db?.driver === "none" ? "in this browser" : "for everyone who uses this app";
  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Reset all user modifications to factory defaults</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Deletes everything changed {where}: statuses, decisions, overrules, logged signals, fund rules, notes, questions, founder requests and uploads. Sample data comes back as it shipped. This cannot be undone.
          </p>
        </div>
      {armed ? (
          <span className="flex gap-2">
            <button
              onClick={async () => {
                setArmed(false);
                await resetEverything({ store, p, w, links });
              }}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Yes, delete my changes
            </button>
            <button onClick={() => setArmed(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Keep them
            </button>
          </span>
        ) : (
          <button
            onClick={() => setArmed(true)}
            disabled={!changed}
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-400"
          >
            {changed ? "Reset to factory defaults" : "Nothing to reset"}
          </button>
        )}
      </div>
    </section>
  );
}
