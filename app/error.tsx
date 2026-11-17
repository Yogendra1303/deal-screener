"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught client error:", error);
    try {
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "react_boundary",
          message: error.message || "Unhandled React render error",
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          metadata: { digest: error.digest },
        }),
      });
    } catch {
      // non-blocking
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-zinc-400">
          This error has been automatically logged and reported to the Aarka engineering team.
        </p>
        <div className="flex gap-3 pt-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm cursor-pointer"
          >
            Retry View
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
