"use client";

/**
 * Shared, deduplicated, visibility-aware Deal Sync Bus.
 * Replaces duplicate 15s polling loops across StoreProvider and LinksProvider with:
 *  - ONE shared in-flight request (zero duplicate fetches)
 *  - ETag / 304 Not Modified conditional requests (0-byte payloads when nothing changed)
 *  - Automatic pause when browser tab is backgrounded (document.hidden)
 *  - Instant refresh when SSE broadcasts aarka:deal_created / aarka:deal_updated
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
let lastEtag: string | null = null;
let inFlight: Promise<SyncedDealRow[] | null> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let hooksBound = false;

async function fetchSharedDeals(force = false): Promise<SyncedDealRow[] | null> {
  if (typeof window === "undefined") return null;
  if (!force && document.hidden) return cachedDeals;
  if (inFlight) return inFlight;

  inFlight = (async () => {
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

      cachedDeals = data.deals;
      for (const l of listeners) l(cachedDeals);
      return cachedDeals;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function startBus() {
  if (typeof window === "undefined") return;
  if (!hooksBound) {
    hooksBound = true;
    const onLiveEvent = () => void fetchSharedDeals(true);
    const onVisible = () => {
      if (!document.hidden && listeners.size > 0) void fetchSharedDeals(false);
    };
    window.addEventListener("aarka:deal_created", onLiveEvent);
    window.addEventListener("aarka:deal_updated", onLiveEvent);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
  }
  if (!pollTimer) {
    // Calm 60s background check with 304 ETag — SSE handles instant updates in between
    pollTimer = setInterval(() => {
      if (!document.hidden && listeners.size > 0) {
        void fetchSharedDeals(false);
      }
    }, 60_000);
  }
}

function stopBusIfIdle() {
  if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Subscribe to shared deals sync. Immediately delivers cached deals if available. */
export function subscribeDealSync(listener: Listener): () => void {
  listeners.add(listener);
  startBus();
  if (cachedDeals) {
    listener(cachedDeals);
  } else {
    void fetchSharedDeals(false);
  }
  return () => {
    listeners.delete(listener);
    stopBusIfIdle();
  };
}

/** Force an immediate shared refresh (e.g. after uploading a pitch or recording a vote). */
export function triggerDealSync(): void {
  if (listeners.size > 0) void fetchSharedDeals(true);
}
