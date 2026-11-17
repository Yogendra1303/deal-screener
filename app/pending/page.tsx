"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function PendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Aarka" className="h-7 w-auto object-contain" />
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Invite Only
        </span>

        <h1 className="mt-3 text-lg font-semibold tracking-tight text-white">
          Aarka is invite-only. Your access request is pending.
        </h1>

        <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
          {email ? (
            <>
              The account <strong className="font-medium text-zinc-200">{email}</strong> is not yet on our approved partner list. Internal workspace access is granted only after manual partner review.
            </>
          ) : (
            <>
              Internal workspace access is restricted to explicitly invited Aarka partners and approved funds. Once your account is whitelisted, you will be able to sign in with Google.
            </>
          )}
        </p>

        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-left text-xs text-zinc-400">
          <p className="font-medium text-zinc-200">Are you a founder raising capital?</p>
          <p className="mt-1 leading-relaxed">
            You don&apos;t need an account to pitch Aarka. Submit your deck directly and receive a private tracking link for your submission.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/pitch"
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
          >
            Submit Your Pitch Deck →
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-4 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PendingAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-xs text-zinc-400">
          Loading…
        </div>
      }
    >
      <PendingContent />
    </Suspense>
  );
}
