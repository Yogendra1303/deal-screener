"use client";

import { useEffect } from "react";

const IGNORED_PATTERNS = [
  /ResizeObserver loop/i,
  /Script error\./i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
];

function shouldIgnore(message: string): boolean {
  return IGNORED_PATTERNS.some((re) => re.test(message));
}

function sendErrorReport(payload: {
  source: "client_runtime" | "client_promise";
  message: string;
  stack?: string;
}) {
  if (!payload.message || shouldIgnore(payload.message)) return;
  try {
    let userEmail: string | undefined;
    try {
      const match = document.cookie.match(/(?:^|; )aarka_session=([^;]+)/);
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed?.email) userEmail = parsed.email;
      }
    } catch {
      // ignore cookie parsing errors
    }

    const body = JSON.stringify({
      ...payload,
      url: window.location.href,
      userEmail,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/errors", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // never throw from error reporter
  }
}

export function ErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      sendErrorReport({
        source: "client_runtime",
        message: event.message || String(event.error || "Uncaught error"),
        stack: event.error?.stack || `${event.filename || ""}:${event.lineno || 0}:${event.colno || 0}`,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason || "Unhandled rejection");
      const stack = reason instanceof Error ? reason.stack : undefined;
      sendErrorReport({
        source: "client_promise",
        message,
        stack,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
