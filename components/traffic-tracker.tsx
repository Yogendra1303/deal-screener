"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight, privacy-safe, ad-blocker-proof pageview + active time-on-page beacon.
 * Tracks every public visit (Homepage, Pitch Form, Login, Pending), captures multi-channel
 * sources/UTMs, device/OS/screen/timezone, and reports exact active duration on page exit.
 * Skips authenticated VC partners automatically.
 */
export function TrafficTracker() {
  const pathname = usePathname() || "/";
  const activeVisitRef = useRef<{ visitId: string; key: string; startedAt: number; accumulatedMs: number; hidden: boolean; flushed: boolean } | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("ds.session.v1")) return;
    } catch {
      // ignore storage errors
    }

    const isPublic =
      pathname === "/" ||
      pathname.startsWith("/pitch") ||
      pathname === "/privacy" ||
      pathname === "/terms" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/pending") ||
      pathname.startsWith("/unauthorized");
    if (!isPublic) return;

    const search = typeof window !== "undefined" ? window.location.search : "";
    const key = `${pathname}${search}`;

    // Helper to flush duration for an active visit
    const flushDuration = (v: typeof activeVisitRef.current) => {
      if (!v || v.flushed) return;
      const elapsedMs = v.accumulatedMs + (v.hidden ? 0 : Date.now() - v.startedAt);
      const durationSec = Math.round(elapsedMs / 1000);
      if (durationSec < 1) return;
      v.flushed = true;

      const body = JSON.stringify({
        type: "duration",
        visitId: v.visitId,
        durationSec: Math.min(1800, durationSec),
      });

      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        } else {
          void fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
        }
      } catch {
        // non-blocking
      }
    };

    if (activeVisitRef.current && activeVisitRef.current.key === key) return;
    if (activeVisitRef.current) flushDuration(activeVisitRef.current);

    const visitId = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const visitState = {
      visitId,
      key,
      startedAt: Date.now(),
      accumulatedMs: 0,
      hidden: typeof document !== "undefined" ? document.hidden : false,
      flushed: false,
    };
    activeVisitRef.current = visitState;

    const params = new URLSearchParams(search);
    const screenSize =
      typeof window !== "undefined" && window.screen
        ? `${window.screen.width}×${window.screen.height}`
        : "";
    let timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      // ignore
    }
    const language = typeof navigator !== "undefined" ? navigator.language || "" : "";

    const payload = {
      type: "view",
      visitId,
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      ref: params.get("ref") || "",
      screen: screenSize,
      timezone,
      language,
    };

    const timer = window.setTimeout(() => {
      try {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch {
        // non-blocking
      }
    }, 2500);

    const onVisibility = () => {
      if (document.hidden) {
        if (!visitState.hidden) {
          visitState.accumulatedMs += Date.now() - visitState.startedAt;
          visitState.hidden = true;
        }
        // Send intermediate duration update when user switches tabs or leaves mobile browser
        const sec = Math.min(1800, Math.round(visitState.accumulatedMs / 1000));
        if (sec >= 2) {
          const body = JSON.stringify({ type: "duration", visitId: visitState.visitId, durationSec: sec });
          try {
            if (typeof navigator.sendBeacon === "function") {
              navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
            }
          } catch {
            // ignore
          }
        }
      } else {
        visitState.startedAt = Date.now();
        visitState.hidden = false;
      }
    };

    const onPageHide = () => flushDuration(visitState);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flushDuration(visitState);
    };
  }, [pathname]);

  return null;
}
