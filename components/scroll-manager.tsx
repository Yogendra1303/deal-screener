"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function scrollPageToTop() {
  if (typeof window === "undefined") return;
  // Respect explicit in-page hash anchors (e.g. #workflow)
  if (window.location.hash && window.location.hash.length > 1) return;

  window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const main = document.querySelector("main");
  if (main && main.scrollTop > 0) {
    main.scrollTop = 0;
  }
}

function ScrollManagerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? "";

  // Disable browser scroll restoration so every hard refresh starts cleanly at the top
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    scrollPageToTop();

    const onBeforeUnload = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Reset scroll to top on every route or query navigation
  useEffect(() => {
    scrollPageToTop();
    // Run once more on next animation frame in case layout height shifts after hydration
    const raf = window.requestAnimationFrame(scrollPageToTop);
    return () => window.cancelAnimationFrame(raf);
  }, [pathname, searchKey]);

  return null;
}

export function ScrollManager() {
  return (
    <Suspense fallback={null}>
      <ScrollManagerInner />
    </Suspense>
  );
}
