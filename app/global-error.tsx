"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
    try {
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "react_boundary",
          component: "GlobalError",
          message: error?.message || "Unhandled root layout error",
          stack: error?.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          metadata: { digest: error?.digest },
        }),
      });
    } catch {
      // non-blocking
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl space-y-4">
          <h2 className="text-lg font-semibold text-white">We caught a display error</h2>
          <p className="text-sm text-slate-400">
            This failure has been automatically logged to Aarka&apos;s error telemetry. Click below to recover cleanly.
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => reset()}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Reload View
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
