"use client";

// Production Google sign-in screen with an institutional "Workspace View on Entry" lens selector.
import { signIn as nextAuthSignIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { ROLE_STORAGE_KEY, useWorkspace } from "@/components/workspace";

const POINTS: [string, string][] = [
  ["One record per company", "Every deck becomes the same standard record, with a page and quote behind each fact."],
  ["Code checks the numbers", "Deck against sheet, form and the deck's own maths. A gap over 10% is flagged, never corrected."],
  ["People decide", "AI sorts and explains. A partner or analyst sets every status, with a reason."],
];

const LENSES: {
  id: "partner" | "analyst";
  label: string;
  badge: string;
  summary: string;
}[] = [
  {
    id: "partner",
    label: "Partner View",
    badge: "Partner",
    summary: "Full fund pipeline, IC decisions & >10% math-gap audit",
  },
  {
    id: "analyst",
    label: "Analyst View",
    badge: "Analyst",
    summary: "Assigned screening queue, deck verification & founder follow-ups",
  },
];

export function LoginScreen({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [selectedRole, setSelectedRole] = useState<"partner" | "analyst">("partner");
  const [customCallback, setCustomCallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    const err = params.get("error");
    const roleParam = params.get("role")?.toLowerCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cb && cb.startsWith("/") && cb !== "/") setCustomCallback(cb);
    try {
      const saved = (roleParam || window.sessionStorage.getItem(ROLE_STORAGE_KEY) || window.localStorage.getItem(ROLE_STORAGE_KEY) || "").toLowerCase();
      if (saved === "partner" || saved === "analyst") {
        setSelectedRole(saved);
      }
    } catch {
      // Ignore storage errors.
    }
    if (err === "AccessDenied") {
      setError("Your Google email isn't on the fund's permitted Partner or Analyst list. Contact a fund partner to be added.");
    } else if (err) {
      setError("Sign-in couldn't complete. Please try again with your authorized Google account.");
    }
  }, []);

  function selectLens(role: "partner" | "analyst") {
    setSelectedRole(role);
    try {
      window.sessionStorage.setItem(ROLE_STORAGE_KEY, role);
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      // Ignore storage errors.
    }
  }

  function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      window.sessionStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
      window.localStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
    } catch {
      // Ignore storage errors.
    }
    const base = customCallback ?? callbackUrl;
    const sep = base.includes("?") ? "&" : "?";
    const target = `${base}${sep}role=${selectedRole}`;
    void nextAuthSignIn("google", { callbackUrl: target });
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
              Authenticate with your fund Google account and choose your initial workspace lens below. You can switch between Partner and Analyst views anytime inside the workspace.
            </p>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
                {error}
              </p>
            )}

            <div className="mt-6">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace View on Entry</span>
              <div role="radiogroup" aria-label="Workspace View on Entry" className="mt-2.5 space-y-2.5">
                {LENSES.map((lens) => {
                  const active = selectedRole === lens.id;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => selectLens(lens.id)}
                      className={cx(
                        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition",
                        active ? "border-slate-900 bg-slate-50/70 ring-1 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                          active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white",
                        )}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{lens.label}</span>
                          <span
                            className={cx(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              lens.id === "partner" ? "bg-indigo-50 text-indigo-700" : "bg-teal-50 text-teal-700",
                            )}
                          >
                            {lens.badge}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{lens.summary}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

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
              {loading ? "Redirecting to Google…" : `Continue with Google as ${selectedRole === "partner" ? "Partner" : "Analyst"}`}
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] leading-snug text-slate-400">
            Access is verified on the server against the fund&apos;s permitted workspace directory on every request.
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
    if (w.ready && w.session) router.replace("/");
  }, [w.ready, w.session, router]);

  return <LoginScreen callbackUrl="/" />;
}
