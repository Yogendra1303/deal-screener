"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

const AuthenticatedProviders = dynamic(() => import("@/components/authenticated-providers"));
const DeferredTelemetry = dynamic(() => import("@/components/deferred-telemetry"), {
  ssr: false,
});

const HasSessionContext = createContext(false);

export function useHasWorkspaceSession(): boolean {
  return useContext(HasSessionContext);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let localActive = false;
    try {
      const raw = window.localStorage.getItem("ds.session.v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string; role?: string } | null;
        if (parsed && parsed.name && parsed.role) {
          localActive = true;
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setHasSession(true);
        }
      }
    } catch {
      // ignore storage errors
    }

    if (pathname === "/" && !localActive) {
      const timer = window.setTimeout(() => {
        fetch("/api/auth/me", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { enabled?: boolean; user?: { email?: string | null } | null; role?: string | null } | null) => {
            if (
              data?.enabled &&
              data.user?.email &&
              (data.role === "VC" || data.role === "partner" || data.role === "analyst")
            ) {
              setHasSession(true);
            }
          })
          .catch(() => undefined);
      }, 2000);
      return () => window.clearTimeout(timer);
    }
  }, [pathname]);

  const isStandalonePublic =
    pathname === "/pitch" ||
    pathname.startsWith("/pitch/") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/pending") ||
    pathname.startsWith("/unauthorized") ||
    (pathname === "/" && !hasSession);

  return (
    <HasSessionContext.Provider value={hasSession}>
      {isStandalonePublic ? (
        <main className="min-h-full">{children}</main>
      ) : (
        <AuthenticatedProviders>{children}</AuthenticatedProviders>
      )}
      <DeferredTelemetry />
    </HasSessionContext.Provider>
  );
}
