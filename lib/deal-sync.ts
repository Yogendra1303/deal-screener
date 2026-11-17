"use client";

/**
 * Shared, deduplicated, visibility-aware Deal Sync Bus.
 *  - ONE shared in-flight request across StoreProvider and LinksProvider
 *  - ETag / 304 Not Modified conditional requests (0-byte payloads when nothing changed)
 *  - Fast 12s background sync when tab is active + instant force-sync on tab focus/visibility
 *  - Cross-instance live pitch detection: detects newly submitted deals even across stateless Vercel Lambdas
 */

export interface SyncedDealRow {
  id: string;
  company_name?: string;
  sector?: string | null;
  stage?: string | null;
  country?: string | null;
  ask_amount?: number | null;
  founder_name?: string | null;
  founder_email?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  one_line_pitch?: string | null;
  owner?: string | null;
  status?: string | null;
  received_at?: string | null;
  is_historical?: boolean;
  intake_json?: unknown;
  record_json?: unknown;
}

type Listener = (deals: SyncedDealRow[]) => void;

const listeners = new Set<Listener>();
let cachedDeals: SyncedDealRow[] | null = null;
let seenIds: Set<string> | null = null;
let lastEtag: string | null = null;
let inFlight: Promise<SyncedDealRow[] | null> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let hooksBound = false;

async function fetchSharedDeals(force = false): Promise<SyncedDealRow[] | null> {
  if (typeof window === "undefined") return null;
  if (!force && document.hidden) return cachedDeals;
  if (inFlight && !force) return inFlight;

  let run: Promise<SyncedDealRow[] | null> | null = null;
  run = (async () => {
    try {
      const headers: Record<string, string> = {};
      if (lastEtag && !force) headers["If-None-Match"] = lastEtag;

      const res = await fetch("/api/deals", { cache: "no-store", headers });
      if (res.status === 304) {
        return cachedDeals;
      }
      if (!res.ok) return null;

      const nextEtag = res.headers.get("etag");
      if (nextEtag) lastEtag = nextEtag;

      const data = (await res.json().catch(() => null)) as { deals?: SyncedDealRow[] } | null;
      if (!data?.deals) return null;

      // Detect brand-new live pitches submitted from another tab/device (stateless serverless friendly)
      if (seenIds) {
        for (const d of data.deals) {
          if (!d.is_historical && d.id && !seenIds.has(d.id)) {
            window.dispatchEvent(new CustomEvent("aarka:new_live_deal", { detail: d }));
          }
        }
      }
      seenIds = new Set(data.deals.map((d) => d.id));

      cachedDeals = data.deals;
      for (const l of listeners) l(cachedDeals);
      return cachedDeals;
    } catch {
      return null;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  })();

  inFlight = run;
  return run;
}

function startBus() {
  if (typeof window === "undefined") return;
  if (!hooksBound) {
    hooksBound = true;
    const onLiveEvent = () => void fetchSharedDeals(true);
    const onVisible = () => {
      if (!document.hidden && listeners.size > 0) void fetchSharedDeals(true);
    };
    window.addEventListener("aarka:deal_created", onLiveEvent);
    window.addEventListener("aarka:deal_updated", onLiveEvent);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
  }
  if (!pollTimer) {
    // 12s conditional ETag poll while tab is visible (0 bytes on 304, near-real-time across Vercel Lambdas)
    pollTimer = setInterval(() => {
      if (!document.hidden && listeners.size > 0) {
        void fetchSharedDeals(false);
      }
    }, 12_000);
  }
}

function stopBusIfIdle() {
  if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Subscribe to shared deals sync. Delivers cached deals immediately and triggers a fresh check. */
export function subscribeDealSync(listener: Listener): () => void {
  listeners.add(listener);
  startBus();
  if (cachedDeals) {
    listener(cachedDeals);
  }
  void fetchSharedDeals(false);
  return () => {
    listeners.delete(listener);
    stopBusIfIdle();
  };
}

/** Force an immediate shared refresh (bypasses ETag cache). */
export function triggerDealSync(): Promise<SyncedDealRow[] | null> {
  return fetchSharedDeals(true);
}
