"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function scrollPageToTop() {
  if (typeof window === "undefined") return;
  // Respect explicit in-page hash anchors (e.g. #workflow)
  if (window.location.hash && window.location.hash.length > 1) return;

  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }
}

export function ScrollManager() {
  const pathname = usePathname();
  const isFirstMount = useRef(true);

  // Disable browser scroll restoration so every hard refresh starts cleanly at the top
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    scrollPageToTop();
  }, []);

  // Reset scroll to top on route navigation
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    scrollPageToTop();
  }, [pathname]);

  return null;
}
