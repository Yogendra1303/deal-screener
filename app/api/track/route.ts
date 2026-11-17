import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getState, listDeals, putState } from "@/lib/db/repository";
import { requireRole } from "@/lib/nextauth";

const STATE_KEY = "site_traffic_v1";
const MAX_EVENTS = 1500;
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests/i;

export interface TrafficEvent {
  ts: string;
  path: string;
  source: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
  country: string;
  city?: string;
  device: "mobile" | "tablet" | "desktop";
  visitor: string;
}

interface TrafficStore {
  totalViews: number;
  events: TrafficEvent[];
}

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;
const ipHits = new Map<string, number[]>();

function allowRate(ip: string): boolean {
  const now = Date.now();
  const prev = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    ipHits.set(ip, prev);
    return false;
  }
  prev.push(now);
  ipHits.set(ip, prev);
  return true;
}

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function extractSource(referrer: string, utmSource: string, ref: string): string {
  if (utmSource) return utmSource.toLowerCase();
  if (ref) return `ref:${ref.toLowerCase()}`;
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host.includes("aarkavc.xyz") || host.includes("localhost")) return "Direct";
    if (host.includes("reddit.com") || host === "redd.it" || host === "out.reddit.com") return "reddit.com";
    if (host.includes("google.")) return "google";
    if (host.includes("t.co") || host.includes("twitter.com") || host.includes("x.com")) return "x.com";
    if (host.includes("linkedin.com") || host === "lnkd.in") return "linkedin.com";
    return host;
  } catch {
    return "Direct";
  }
}

function dailyVisitorHash(ip: string, ua: string, day: string): string {
  const secret = process.env.AUTH_SECRET || "aarka-traffic-salt";
  return crypto.createHash("sha256").update(`${secret}:${ip}:${ua.slice(0, 80)}:${day}`).digest("hex").slice(0, 14);
}

/** Public anonymous pageview beacon (rate-limited, bot-filtered, zero raw IP stored). */
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, ignored: "bot" });
    }

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (!allowRate(ip)) {
      return NextResponse.json({ ok: true, ignored: "rate" });
    }

    const body = (await req.json().catch(() => ({}))) as {
      path?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      ref?: string;
    };

    const rawPath = String(body.path || "/").trim().slice(0, 120);
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

    // Only track public/inbound pages — skip internal VC tabs
    const isPublicTracked =
      path === "/" ||
      path.startsWith("/pitch") ||
      path.startsWith("/login") ||
      path.startsWith("/pending") ||
      path.startsWith("/unauthorized");
    if (!isPublicTracked) {
      return NextResponse.json({ ok: true, ignored: "internal" });
    }

    const referrer = String(body.referrer || "").trim().slice(0, 300);
    const utmSource = String(body.utmSource || "").trim().slice(0, 60);
    const utmMedium = String(body.utmMedium || "").trim().slice(0, 60);
    const utmCampaign = String(body.utmCampaign || "").trim().slice(0, 80);
    const ref = String(body.ref || "").trim().slice(0, 60);

    const country = (req.headers.get("x-vercel-ip-country") || "Unknown").slice(0, 8);
    const rawCity = req.headers.get("x-vercel-ip-city") || "";
    let city = "";
    try {
      city = rawCity ? decodeURIComponent(rawCity).slice(0, 60) : "";
    } catch {
      city = rawCity.slice(0, 60);
    }

    const now = new Date();
    const ts = now.toISOString();
    const day = ts.slice(0, 10);
    const visitor = dailyVisitorHash(ip, ua, day);

    const event: TrafficEvent = {
      ts,
      path,
      source: extractSource(referrer, utmSource, ref),
      ...(referrer ? { referrer } : {}),
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(ref ? { ref } : {}),
      country,
      ...(city ? { city } : {}),
      device: detectDevice(ua),
      visitor,
    };

    const existing = (await getState<TrafficStore>(STATE_KEY).catch(() => undefined)) ?? {
      totalViews: 0,
      events: [],
    };
    const prevEvents = Array.isArray(existing.events) ? existing.events : [];
    const nextStore: TrafficStore = {
      totalViews: (existing.totalViews || prevEvents.length) + 1,
      events: [event, ...prevEvents].slice(0, MAX_EVENTS),
    };

    await putState(STATE_KEY, nextStore);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/track][POST] warning:", err);
    return NextResponse.json({ ok: true });
  }
}

/** Partner-only aggregated live traffic & Reddit funnel endpoint (401 to unauthenticated callers). */
export async function GET() {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  try {
    const [store, deals] = await Promise.all([
      getState<TrafficStore>(STATE_KEY).catch(() => undefined),
      listDeals().catch(() => []),
    ]);

    const events = Array.isArray(store?.events) ? store.events : [];
    const nowMs = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * ms24h;

    const last24h = events.filter((e) => nowMs - Date.parse(e.ts) <= ms24h);
    const last7d = events.filter((e) => nowMs - Date.parse(e.ts) <= ms7d);

    const unique24h = new Set(last24h.map((e) => e.visitor)).size;
    const unique7d = new Set(last7d.map((e) => e.visitor)).size;

    const homeViews7d = last7d.filter((e) => e.path === "/").length;
    const pitchViews7d = last7d.filter((e) => e.path.startsWith("/pitch")).length;
    const redditViews7d = last7d.filter((e) => e.source.includes("reddit")).length;

    const liveSubmitted7d = deals.filter((d) => {
      if (d.is_historical) return false;
      const t = d.received_at ? Date.parse(d.received_at) : 0;
      return t > 0 && nowMs - t <= ms7d;
    }).length;

    const countMap = (items: string[]) => {
      const m = new Map<string, number>();
      for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
      return [...m.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    };

    const topSources = countMap(last7d.map((e) => e.source || "Direct"));
    const topCountries = countMap(last7d.map((e) => e.country || "Unknown"));
    const devices = {
      desktop: last7d.filter((e) => e.device === "desktop").length,
      mobile: last7d.filter((e) => e.device === "mobile").length,
      tablet: last7d.filter((e) => e.device === "tablet").length,
    };

    return NextResponse.json({
      ok: true,
      totalViews: store?.totalViews ?? events.length,
      views24h: last24h.length,
      unique24h,
      views7d: last7d.length,
      unique7d,
      redditViews7d,
      funnel7d: {
        landingViews: homeViews7d,
        pitchViews: pitchViews7d,
        submissions: liveSubmitted7d,
      },
      topSources,
      topCountries,
      devices,
      recent: events.slice(0, 15),
    });
  } catch (err) {
    console.error("[api/track][GET] error:", err);
    return NextResponse.json({ error: "Failed to load traffic metrics" }, { status: 500 });
  }
}
