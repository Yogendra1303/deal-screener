"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Lightweight, privacy-safe, ad-blocker-proof pageview beacon for public pages (/, /pitch, /login, /pending).
 * Skips authenticated VC partners so your own dashboard usage never inflates visitor counts.
 */
export function TrafficTracker() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    // Wait until session status settles so we don't log partner visits
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
    const payload = {
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      ref: params.get("ref") || "",
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
