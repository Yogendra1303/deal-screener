"use client";

// Production Google sign-in screen. Partner vs. Analyst access is assigned automatically on the server by fund email.
import { signIn as nextAuthSignIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace";

const POINTS: [string, string][] = [
  ["One record per company", "Every deck becomes the same standard record, with a page and quote behind each fact."],
  ["Code checks the numbers", "Deck against sheet, form and the deck's own maths. A gap over 10% is flagged, never corrected."],
  ["People decide", "AI sorts and explains. A partner or analyst sets every status, with a reason."],
];

export function LoginScreen({ callbackUrl = "/deals" }: { callbackUrl?: string }) {
  const [activeTarget, setActiveTarget] = useState(callbackUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    const err = params.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cb && cb.startsWith("/")) setActiveTarget(cb);
    if (err === "AccessDenied") {
      setError("Your Google email isn't on the fund's permitted Partner or Analyst list. Contact a fund partner to be added.");
    } else if (err) {
      setError("Sign-in couldn't complete. Please try again with your authorized Google account.");
    }
  }, []);

  function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    void nextAuthSignIn("google", { callbackUrl: activeTarget });
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
        <p className="text-xs text-white/40">Fund Hub · Investment screening &amp; portfolio workspace</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-base font-bold text-white">F</span>
            <span className="leading-tight">
              <span className="block text-lg font-semibold text-slate-900">Fund Hub</span>
              <span className="block text-xs text-slate-500">Investment screening &amp; portfolio workspace</span>
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in to Fund Hub</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Use your authorized fund Google account. Partner and Analyst access is assigned automatically by your fund email.
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              {loading ? "Redirecting to Google…" : "Continue with Google"}
            </button>

            <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
              <p>
                <span className="font-semibold text-slate-700">Partner access:</span> Full pipeline, IC decisions, team workload, and &gt;10% math-gap audit views.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Analyst access:</span> Assigned screening queue, founder follow-ups, and portfolio reporting checks.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-snug text-slate-400">
            Role permissions are verified on the server against the fund&apos;s permitted workspace directory on every request.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  const w = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (w.ready && w.session) router.replace("/deals");
  }, [w.ready, w.session, router]);

  return <LoginScreen callbackUrl="/deals" />;
}
