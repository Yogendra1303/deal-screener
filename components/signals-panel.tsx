"use client";

// What an analyst logs against a company after the pitch: a raise, a launch, a senior hire, press.
// Each entry keeps its publisher and link, so "look again" can show why it moved. The points come from
// the same rule the sample signals use, worked out by code.
import { useState } from "react";
import { SIGNAL_HELP, SIGNAL_TYPES, type SignalType } from "@/lib/signals";
import { LOOK_POINTS } from "@/lib/flow";
import { fmtDate } from "@/lib/format";
import { useStore } from "./store";
import { useWorkspace } from "./workspace";
import { useLinks } from "./links-store";
import { Button, DropdownSelect, cx } from "./ui";

const input = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none";

const POINTS: Partial<Record<SignalType, number>> = {
  Raised: LOOK_POINTS.raised,
  "Trigger met": LOOK_POINTS.trigger,
  "Pitched again": LOOK_POINTS.again,
};

export function SignalsPanel({ id, name, className }: { id: string; name: string; className?: string }) {
  const store = useStore();
  const w = useWorkspace();
  const links = useLinks();
  const logged = store.signalsOf(id);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SignalType>("Raised");
  const [at, setAt] = useState(links.today);
  const [text, setText] = useState("");
  const [publisher, setPublisher] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  function save() {
    if (!text.trim()) return;
    store.addSignal(id, { kind, at, text: text.trim(), publisher: publisher.trim() || undefined, url: url.trim() || undefined, note: note.trim() || undefined, by: w.me || "Analyst" });
    setText("");
    setPublisher("");
    setUrl("");
    setNote("");
    setOpen(false);
  }

  return (
    <section className={cx("rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Signals logged on {name}</h2>
          <p className="text-xs text-slate-500">Anything you find in the open web after the pitch. A raise, a met trigger or a new pitch changes the look-again score.</p>
        </div>
        <Button variant={open ? "ghost" : "secondary"} onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "Log a signal"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          <div className="space-y-1 text-xs">
            <span className="font-medium text-slate-600">What happened</span>
            <DropdownSelect
              value={kind}
              onChange={(v) => setKind(v as SignalType)}
              ariaLabel="What happened"
              options={SIGNAL_TYPES.map((t) => ({ value: t, label: t }))}
              className="w-full"
              buttonClassName="w-full"
            />
            <span className="block text-[11px] text-slate-500">{SIGNAL_HELP[kind]}</span>
          </div>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-600">When it happened</span>
            <input type="date" className={input} value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="font-medium text-slate-600">In one line</span>
            <input className={input} placeholder="Raised a $6M Series A led by …" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-600">Where you saw it</span>
            <input className={input} placeholder="Publisher, e.g. Entrackr" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-600">Link</span>
            <input className={input} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="font-medium text-slate-600">Why it matters to us (optional)</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={!text.trim()}>
              Save signal
            </Button>
          </div>
        </div>
      )}

      {logged.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {logged.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {s.kind}
                  {POINTS[s.kind] ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">+{POINTS[s.kind]} look again</span> : null}
                </p>
                <p className="text-slate-700">{s.text}</p>
                {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
                <p className="text-[11px] text-slate-400">
                  {fmtDate(s.at)} · {s.publisher || "No publisher given"} · logged by {s.by}
                  {s.url && (
                    <>
                      {" · "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 underline">
                        source
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button onClick={() => store.removeSignal(id, s.id)} className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !open && <p className="mt-3 text-sm text-slate-500">Nothing logged yet.</p>
      )}
    </section>
  );
}

/** A free note the team can leave on any company, kept beside whatever the code decided. */
export function OverruleNote({ id, className }: { id: string; className?: string }) {
  const store = useStore();
  const w = useWorkspace();
  const current = store.overrules[id];
  const [text, setText] = useState("");
  return (
    <section className={cx("rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-5", className)}>
      <h2 className="text-sm font-semibold text-slate-900">Analyst note</h2>
      {current ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="rounded-md bg-slate-50 p-2.5 text-slate-700">“{current.note}”</p>
          <p className="text-xs text-slate-500">
            {current.by} · {fmtDate(current.at)}
            {current.band ? ` · band changed to ${current.band}` : ""}
          </p>
          <Button variant="secondary" onClick={() => store.setOverrule(id, null)}>
            Remove note
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-500">Why the record is read differently from what the code worked out. Both are kept, and everyone sees it.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={cx(input, "font-normal")} placeholder="What the file misses, or why this one is worth another look." />
          <Button disabled={!text.trim()} onClick={() => (store.setOverrule(id, { note: text.trim(), by: w.me || "Analyst", at: new Date().toISOString() }), setText(""))}>
            Save note
          </Button>
        </div>
      )}
    </section>
  );
}
