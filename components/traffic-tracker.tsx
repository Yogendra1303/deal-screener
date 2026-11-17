"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Lightweight, privacy-safe, ad-blocker-proof pageview beacon for ALL public pages.
 * Captures source/referrer (Reddit, LinkedIn, X/Twitter, Instagram, etc.), UTM params,
 * viewport/screen size, timezone, and browser language. Skips authenticated VC partners.
 */
export function TrafficTracker() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    if (status === "loading") return;
    if (session?.role === "VC") return;

    const isPublic =
      pathname === "/" ||
      pathname.startsWith("/pitch") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/pending") ||
      pathname.startsWith("/unauthorized");
    if (!isPublic) return;

    const search = typeof window !== "undefined" ? window.location.search : "";
    const key = `${pathname}${search}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;

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
  }, [pathname, session?.role, status]);

  return null;
}
