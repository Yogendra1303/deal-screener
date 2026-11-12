"use client";

// Sign in. Pick a demo person and the form fills itself; one click signs in. A plain email form sits underneath for typing.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/shell";
import { cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { DEMO_ACCOUNTS } from "@/lib/auth";

const POINTS: [string, string][] = [
  ["One record per company", "Every deck becomes the same standard record, with a page and quote behind each fact."],
  ["Code checks the numbers", "Deck against sheet, form and the deck's own maths. A gap over 10% is flagged, never corrected."],
  ["People decide", "AI sorts and explains. A partner or analyst sets every status, with a reason."],
];

export default function LoginPage() {
  const w = useWorkspace();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const picked = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password) ?? null;

  useEffect(() => {
    if (w.ready && w.session) router.replace("/");
  }, [w.ready, w.session, router]);

  function signIn(mail = email, pass = password) {
    const err = w.signIn(mail, pass);
    setError(err);
    if (!err) router.replace("/");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-slate-900 px-10 py-10 text-white lg:flex xl:px-14">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-base font-bold text-slate-900">F</span>
          <span className="text-lg font-semibold tracking-tight">Fund Hub</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Every deck, checked before anyone reads it.</h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(([t, d]) => (
              <li key={t} className="grid grid-cols-[20px_1fr] gap-3">
                <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="block text-sm text-white/60">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">Prototype. Every company, person and number is fictional sample data.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-base font-bold text-white">F</span>
            <span className="leading-tight">
              <span className="block text-lg font-semibold text-slate-900">Fund Hub</span>
              <span className="block text-xs text-slate-500">Prototype · fictional sample data</span>
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">Choose who you are. Partners see the whole fund; analysts see their own companies in depth.</p>

          <div role="radiogroup" aria-label="Demo accounts" className="mt-5 space-y-2">
            {DEMO_ACCOUNTS.map((a) => {
              const on = picked?.email === a.email;
              return (
                <button
                  key={a.email}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                    setError(null);
                  }}
                  onDoubleClick={() => signIn(a.email, a.password)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition",
                    on ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-400",
                  )}
                >
                  <Avatar name={a.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{a.name}</span>
                      <span className={cx("rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider", a.role === "Partner" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                        {a.role}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">{a.sees}</span>
                  </span>
                  <span aria-hidden className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300")}>
                    {on && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6.5l2.5 2.5L10 3.5" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => signIn()}
            disabled={!picked}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400"
          >
            {picked ? `Continue as ${picked.name.split(" ")[0]} · ${picked.role}` : "Pick a person to continue"}
          </button>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
              {error}
            </p>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setManual((v) => !v)} className="text-sm font-medium text-slate-600 hover:text-slate-900" aria-expanded={manual}>
              {manual ? "Hide" : "Use"} email and password instead
            </button>
            {manual && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn();
                }}
                className="mt-3 space-y-3"
              >
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Work email</span>
                  <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Password</span>
                  <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
                </label>
                <button type="submit" className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  Sign in
                </button>
                <p className="text-[11px] text-slate-500">
                  Demo credentials: {DEMO_ACCOUNTS.map((a) => `${a.email} / ${a.password}`).join(" · ")}
                </p>
              </form>
            )}
          </div>

          <p className="mt-6 text-[11px] leading-snug text-slate-500">
            Demo sign-in only: it runs in this browser and is not security. A real version would use the fund&apos;s Google or Microsoft sign-in, with roles checked on the server.
          </p>
        </div>
      </main>
    </div>
  );
}
