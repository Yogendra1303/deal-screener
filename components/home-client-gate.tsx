"use client";

import dynamic from "next/dynamic";
import { useHasWorkspaceSession } from "@/components/app-providers";

const DashboardHome = dynamic(() => import("@/components/dashboard-home"), {
  loading: () => <p className="text-sm text-slate-500">Loading workspace…</p>,
});

export function HomeClientGate({ landing }: { landing: React.ReactNode }) {
  const hasSession = useHasWorkspaceSession();
  if (!hasSession) return <>{landing}</>;
  return <DashboardHome />;
}
