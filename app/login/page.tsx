"use client";

import { Suspense, useState } from "react";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [signingIn, setSigningIn] = useState(false);

  function handleGoogleSignIn() {
    setSigningIn(true);
    void nextAuthSignIn("google", { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Aarka" className="h-7 w-auto object-contain" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-white">
            Aarka Partner Sign In
          </h1>
          <p className="mt-1 text-center text-xs text-zinc-400">
            Invite-only institutional workspace
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl sm:p-8">
          <p className="text-center text-xs leading-relaxed text-zinc-400">
            Sign in with your pre-authorised Google account to access the fund dashboard. Founders submitting decks should use the public pitch form.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-all duration-200 hover:scale-[1.01] hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
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
            <span>{signingIn ? "Redirecting to Google…" : "Continue with Google"}</span>
          </button>

          <div className="mt-5 border-t border-zinc-800 pt-4 text-center">
            <Link
              href="/pitch"
              className="text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Submitting a startup pitch? Go to the Founder Pitch Form →
            </Link>
          </div>
        </div>

        <div className="mt-5 text-center">
          <Link href="/" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            ← Return to public website
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-xs text-zinc-400">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
