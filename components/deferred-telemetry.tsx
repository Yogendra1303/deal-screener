"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorMonitor } from "@/components/error-monitor";
import { TrafficTracker } from "@/components/traffic-tracker";

export default function DeferredTelemetry() {
  return (
    <>
      <TrafficTracker />
      <ErrorMonitor />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
