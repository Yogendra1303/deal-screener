"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace";

export function LoginScreen({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [customCallback, setCustomCallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    const err = params.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cb && cb.startsWith("/")) setCustomCallback(cb);
    if (err) {
      setError("Sign-in couldn't complete. Please try again with your Google account.");
    }
  }, []);

  function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    void nextAuthSignIn("google", { callbackUrl: customCallback ?? callbackUrl });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-base font-bold text-white shadow-sm">F</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Sign in to Fund Hub</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Investment workspace for fund partners and live pitch portal for founders.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {error && (
            <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
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
            <span>{loading ? "Redirecting to Google…" : "Continue with Google"}</span>
          </button>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Founders are routed to the Founder Portal; fund partners enter the Investment Workspace automatically.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Fund Hub · Secured with Google OAuth &amp; server-side role verification
        </p>
      </div>
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
