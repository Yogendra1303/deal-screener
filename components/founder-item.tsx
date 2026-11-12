"use client";

// One thing the fund asked a founder for: upload a file, or say "I don't have this" or "I'll send it
// later". Used on a request link and on the founder portal.
import { useRef, useState } from "react";
import { useLinks } from "./links-store";
import { cx } from "./ui";
import { fmtDay } from "@/lib/dates";
import { itemStatus, type FounderRequest, type RequestItem } from "@/lib/links";

export function ItemCard({ r, item, n }: { r: FounderRequest; item: RequestItem; n: number }) {
  const links = useLinks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"none" | "dont" | "later">("none");
  const [note, setNote] = useState("");
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState(false);
  const a = r.answers[item.id];
  const status = itemStatus(r, item.id, links.today);
  const done = status === "Sent" || status === "Don't have" || status === "Later";

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    await links.addFiles(r.id, item.id, Array.from(files));
    setBusy(false);
    setMode("none");
  }

  return (
    <li className={cx("rounded-2xl bg-white p-4 ring-1 sm:p-5", done ? "ring-emerald-200" : "ring-slate-200")}>
      <div className="flex items-start gap-3">
        <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600")}>
          {done ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{item.label}</p>
          {item.why && <p className="mt-0.5 text-sm text-slate-500">{item.why}</p>}

          {a?.state === "Sent" && (
            <ul className="mt-2 space-y-1">
              {a.files.map((f) => (
                <li key={f.name + f.at} className="flex items-center gap-2 text-sm text-slate-700">
                  <span aria-hidden className="text-emerald-600">●</span>
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">sent {fmtDay(f.at)}</span>
                </li>
              ))}
            </ul>
          )}
          {a?.state === "Don't have" && (
            <p className="mt-2 text-sm text-slate-700">
              You said you don&apos;t have this{a.note ? `: “${a.note}”` : "."}
            </p>
          )}
          {a?.state === "Later" && (
            <p className="mt-2 text-sm text-slate-700">
              You&apos;ll send this by {a.by ? fmtDay(a.by) : "a later date"}
              {a.note ? `: “${a.note}”` : "."}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Uploading…" : a?.state === "Sent" ? "Add another file" : a ? "Upload instead" : "Upload"}
            </button>
            {!a && (
              <>
                <button onClick={() => setMode(mode === "dont" ? "none" : "dont")} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                  I don&apos;t have this
                </button>
                <button onClick={() => setMode(mode === "later" ? "none" : "later")} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                  I&apos;ll send it later
                </button>
              </>
            )}
            {a && a.state !== "Sent" && (
              <button onClick={() => links.answer(r.id, item.id, null)} className="text-xs text-slate-500 underline hover:text-slate-800">
                Change answer
              </button>
            )}
          </div>

          {mode !== "none" && (
            <form
              className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                links.answer(r.id, item.id, mode === "dont" ? "Don't have" : "Later", { note: note.trim() || undefined, by: mode === "later" ? by || undefined : undefined });
                setMode("none");
              }}
            >
              {mode === "later" && (
                <label className="block text-sm text-slate-700">
                  By when?
                  <input type="date" value={by} onChange={(e) => setBy(e.target.value)} className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm" />
                </label>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={mode === "dont" ? "Optional: a line on why, or what you have instead" : "Optional: anything the fund should know"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Save answer</button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
