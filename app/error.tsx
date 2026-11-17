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
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="text-sm text-slate-400">
          The dashboard encountered an unexpected state while loading deal data.
        </p>
        <div className="flex gap-3 pt-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-sm"
          >
            Retry View
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
