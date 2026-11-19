import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getState, listAuditLogs, listDeals, putState } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const STATE_KEY = "site_traffic_v1";
const MAX_EVENTS = 2500;
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|telegrambot|slackbot|discordbot|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests/i;

export interface TrafficEvent {
  visitId?: string;
  ts: string;
  path: string;
  source: string;
  channel: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
  country: string;
  region?: string;
  city?: string;
  device: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
  screen?: string;
  timezone?: string;
  language?: string;
  durationSec?: number;
  visitor: string;
  ipHash?: string;
  isOwner?: boolean;
  ownerLabel?: string;
}

interface OwnerNetwork {
  ipHash: string;
  label: string;
  city?: string;
  country?: string;
  registeredAt: string;
}

interface TrafficStore {
  totalViews: number;
  events: TrafficEvent[];
  ownerNetworks?: OwnerNetwork[];
}

function hashNetworkIp(ip: string): string {
  const secret = process.env.AUTH_SECRET || "aarka-traffic-salt";
  return crypto.createHash("sha256").update(`net:${secret}:${ip}`).digest("hex").slice(0, 20);
}

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|instagram|fban|fbav|linkedinapp/i.test(ua)) return "mobile";
  return "desktop";
}

function detectOS(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function detectBrowser(ua: string): string {
  if (/instagram/i.test(ua)) return "Instagram In-App";
  if (/linkedinapp/i.test(ua)) return "LinkedIn In-App";
  if (/fban|fbav/i.test(ua)) return "Facebook In-App";
  if (/reddit/i.test(ua)) return "Reddit In-App";
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

function classifySource(referrer: string, utmSource: string, ref: string, ua: string): { source: string; channel: string } {
  const raw = (utmSource || ref || "").trim().toLowerCase();
  if (raw) {
    if (raw.includes("reddit")) return { source: "Reddit", channel: "Social" };
    if (raw.includes("linkedin") || raw === "li") return { source: "LinkedIn", channel: "Social" };
    if (raw.includes("twitter") || raw === "x" || raw.includes("x.com")) return { source: "X / Twitter", channel: "Social" };
    if (raw.includes("instagram") || raw === "ig") return { source: "Instagram", channel: "Social" };
    if (raw.includes("whatsapp") || raw === "wa") return { source: "WhatsApp", channel: "Messaging" };
    if (raw.includes("producthunt") || raw === "ph") return { source: "Product Hunt", channel: "Community" };
    if (raw.includes("hackernews") || raw === "hn") return { source: "Hacker News", channel: "Community" };
    if (raw.includes("youtube") || raw === "yt") return { source: "YouTube", channel: "Social" };
    if (raw.includes("email") || raw.includes("newsletter")) return { source: "Email / Newsletter", channel: "Email" };
    return { source: utmSource ? utmSource : `ref:${ref}`, channel: "Campaign" };
  }

  if (/instagram/i.test(ua)) return { source: "Instagram", channel: "Social" };
  if (/linkedinapp/i.test(ua)) return { source: "LinkedIn", channel: "Social" };
  if (/fban|fbav/i.test(ua)) return { source: "Facebook", channel: "Social" };

  if (!referrer) return { source: "Direct", channel: "Direct" };

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host.includes("aarkavc.xyz") || host.includes("localhost")) {
      return { source: "Direct", channel: "Direct" };
    }
    if (host.includes("reddit.com") || host === "redd.it" || host === "out.reddit.com") return { source: "Reddit", channel: "Social" };
    if (host.includes("linkedin.com") || host === "lnkd.in") return { source: "LinkedIn", channel: "Social" };
    if (host === "t.co" || host.includes("twitter.com") || host.includes("x.com")) return { source: "X / Twitter", channel: "Social" };
    if (host.includes("instagram.com") || host === "l.instagram.com") return { source: "Instagram", channel: "Social" };
    if (host.includes("facebook.com") || host === "lm.facebook.com" || host === "m.facebook.com") return { source: "Facebook", channel: "Social" };
    if (host.includes("youtube.com") || host === "youtu.be") return { source: "YouTube", channel: "Social" };
    if (host.includes("whatsapp.com") || host === "wa.me") return { source: "WhatsApp", channel: "Messaging" };
    if (host.includes("news.ycombinator.com")) return { source: "Hacker News", channel: "Community" };
    if (host.includes("producthunt.com")) return { source: "Product Hunt", channel: "Community" };
    if (
      host.includes("google.") ||
      host.includes("bing.com") ||
      host.includes("duckduckgo.com") ||
      host.includes("perplexity.ai") ||
      host.includes("chatgpt.com")
    ) {
      return { source: host, channel: "Search / AI" };
    }
    return { source: host, channel: "Referral" };
  } catch {
    return { source: "Direct", channel: "Direct" };
  }
}

function pageDisplayName(path: string): string {
  if (path === "/") return "Homepage (/)";
  if (path.startsWith("/pitch")) return "Pitch Form (/pitch)";
  if (path.startsWith("/login")) return "Sign In (/login)";
  if (path.startsWith("/pending") || path.startsWith("/unauthorized")) return "Invite Pending (/pending)";
  return path;
}

function dailyVisitorHash(ip: string, ua: string, day: string): string {
  const secret = process.env.AUTH_SECRET || "aarka-traffic-salt";
  return crypto.createHash("sha256").update(`${secret}:${ip}:${ua.slice(0, 80)}:${day}`).digest("hex").slice(0, 14);
}

function initialsOf(nameOrEmail: string): string {
  const clean = nameOrEmail.split("@")[0].trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "YK";
}

function avgSec(events: TrafficEvent[]): number | null {
  const withDur = events.filter((e) => typeof e.durationSec === "number" && e.durationSec > 0);
  if (!withDur.length) return null;
  const total = withDur.reduce((sum, e) => sum + (e.durationSec || 0), 0);
  return Math.round(total / withDur.length);
}

/** Public anonymous pageview & active time-on-page beacon. */
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, ignored: "bot" });
    }

    const ip = getRequestIp(req);
    const rate = checkRateLimit("track_beacon", ip, 60, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ ok: true, ignored: "rate" });
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: "view" | "duration";
      visitId?: string;
      durationSec?: number;
      path?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      ref?: string;
      screen?: string;
      timezone?: string;
      language?: string;
    };

    const existing = (await getState<TrafficStore>(STATE_KEY).catch(() => undefined)) ?? {
      totalViews: 0,
      events: [],
      ownerNetworks: [],
    };
    const prevEvents = Array.isArray(existing.events) ? existing.events : [];
    const ownerNetworks = Array.isArray(existing.ownerNetworks) ? existing.ownerNetworks : [];

    // 1. Duration heartbeat update for an existing pageview
    if (body.type === "duration" && body.visitId && typeof body.durationSec === "number") {
      const dur = Math.min(1800, Math.max(1, Math.round(body.durationSec)));
      const idx = prevEvents.findIndex((e) => e.visitId === body.visitId);
      if (idx >= 0) {
        const updated = [...prevEvents];
        updated[idx] = { ...updated[idx], durationSec: Math.max(updated[idx].durationSec ?? 0, dur) };
        await putState(STATE_KEY, { ...existing, events: updated, ownerNetworks });
      }
      return NextResponse.json({ ok: true });
    }

    // 2. New pageview event
    const rawPath = String(body.path || "/").trim().slice(0, 120);
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

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
    const screen = String(body.screen || "").trim().slice(0, 32);
    const timezone = String(body.timezone || "").trim().slice(0, 64);
    const language = String(body.language || "").trim().slice(0, 24);
    const visitId = String(body.visitId || "").trim().slice(0, 40) || undefined;

    const country = (req.headers.get("x-vercel-ip-country") || "Unknown").slice(0, 8);
    const region = (req.headers.get("x-vercel-ip-country-region") || "").slice(0, 16);
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
    const ipHash = ip !== "unknown" ? hashNetworkIp(ip) : undefined;
    const { source, channel } = classifySource(referrer, utmSource, ref, ua);
    const matchedOwner = ipHash ? ownerNetworks.find((n) => n.ipHash === ipHash) : undefined;

    const event: TrafficEvent = {
      ...(visitId ? { visitId } : {}),
      ts,
      path,
      source,
      channel,
      ...(referrer ? { referrer } : {}),
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(ref ? { ref } : {}),
      country,
      ...(region ? { region } : {}),
      ...(city ? { city } : {}),
      device: detectDevice(ua),
      os: detectOS(ua),
      browser: detectBrowser(ua),
      ...(screen ? { screen } : {}),
      ...(timezone ? { timezone } : {}),
      ...(language ? { language } : {}),
      visitor,
      ...(ipHash ? { ipHash } : {}),
      ...(matchedOwner ? { isOwner: true, ownerLabel: matchedOwner.label } : {}),
    };

    const nextStore: TrafficStore = {
      totalViews: (existing.totalViews || prevEvents.length) + 1,
      events: [event, ...prevEvents].slice(0, MAX_EVENTS),
      ownerNetworks,
    };

    await putState(STATE_KEY, nextStore);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/track][POST] warning:", err);
    return NextResponse.json({ ok: true });
  }
}

/** Partner-only analytics endpoint - strictly isolates Partner IP as 1 entity (0 external views) + computes avg time on site/page/source. */
export async function GET(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  try {
    const session = await auth().catch(() => null);
    const partnerEmail = session?.user?.email?.trim().toLowerCase() || "";
    const partnerName = session?.user?.name?.trim() || partnerEmail || "Partner";
    const partnerLabel = `${initialsOf(partnerName)} · Partner Wi-Fi`;

    const currentIp = getRequestIp(req);
    const currentIpHash = currentIp !== "unknown" ? hashNetworkIp(currentIp) : "";
    const currentCountry = (req.headers.get("x-vercel-ip-country") || "").slice(0, 8);
    const rawCity = req.headers.get("x-vercel-ip-city") || "";
    let currentCity = "";
    try {
      currentCity = rawCity ? decodeURIComponent(rawCity).slice(0, 60) : "";
    } catch {
      currentCity = rawCity.slice(0, 60);
    }

    const [storeRaw, deals, auditLogs, accessRequests] = await Promise.all([
      getState<TrafficStore>(STATE_KEY).catch(() => undefined),
      listDeals().catch(() => []),
      listAuditLogs(80).catch(() => []),
      getState<
        Array<{
          id: string;
          name: string;
          email: string;
          background: string;
          firm?: string;
          intent: string;
          additionalContext?: string;
          createdAt: string;
          status: string;
        }>
      >("access_requests").catch(() => []),
    ]);

    const store: TrafficStore = storeRaw ?? { totalViews: 0, events: [], ownerNetworks: [] };
    let ownerNetworks = Array.isArray(store.ownerNetworks) ? [...store.ownerNetworks] : [];
    let dirtyStore = false;

    // Auto-register partner's current IP hash
    if (currentIpHash && !ownerNetworks.some((n) => n.ipHash === currentIpHash)) {
      ownerNetworks = [
        {
          ipHash: currentIpHash,
          label: partnerLabel,
          ...(currentCity ? { city: currentCity } : {}),
          ...(currentCountry ? { country: currentCountry } : {}),
          registeredAt: new Date().toISOString(),
        },
        ...ownerNetworks,
      ].slice(0, 20);
      dirtyStore = true;
    }

    const ownerHashSet = new Set(ownerNetworks.map((n) => n.ipHash));
    const ownerLabelByHash = new Map(ownerNetworks.map((n) => [n.ipHash, n.label]));

    // Auto-reclassify any hit from registered Partner IP hashes OR legacy pre-hash test hits from partner's exact city
    const allEvents = (Array.isArray(store.events) ? store.events : []).map((ev) => {
      const legacySameCity =
        !ev.ipHash &&
        Boolean(currentCity) &&
        (ev.city || "").toLowerCase() === currentCity.toLowerCase();
      const matched = Boolean(ev.isOwner || (ev.ipHash && ownerHashSet.has(ev.ipHash)) || legacySameCity);
      if (matched && !ev.isOwner) dirtyStore = true;
      return {
        ...ev,
        isOwner: matched,
        ownerLabel: ev.ownerLabel || (ev.ipHash ? ownerLabelByHash.get(ev.ipHash) : undefined) || (matched ? partnerLabel : undefined),
      };
    });

    if (dirtyStore) {
      void putState(STATE_KEY, {
        ...store,
        events: allEvents,
        ownerNetworks,
      }).catch(() => undefined);
    }

    // STRICT SEPARATION: External Visitors (0 from your IP) vs. Your / Partner Wi-Fi (counted as 1 single entity)
    const externalEvents = allEvents.filter((e) => !e.isOwner);
    const ownerEvents = allEvents.filter((e) => e.isOwner);

    const nowMs = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * ms24h;
    const ms30d = 30 * ms24h;

    const ext24h = externalEvents.filter((e) => nowMs - Date.parse(e.ts) <= ms24h);
    const ext7d = externalEvents.filter((e) => nowMs - Date.parse(e.ts) <= ms7d);
    const ext30d = externalEvents.filter((e) => nowMs - Date.parse(e.ts) <= ms30d);

    const owner24h = ownerEvents.filter((e) => nowMs - Date.parse(e.ts) <= ms24h);
    const owner30d = ownerEvents.filter((e) => nowMs - Date.parse(e.ts) <= ms30d);

    const unique24h = new Set(ext24h.map((e) => e.visitor)).size;
    const unique7d = new Set(ext7d.map((e) => e.visitor)).size;
    const unique30d = new Set(ext30d.map((e) => e.visitor)).size;

    const homeEvents30d = ext30d.filter((e) => e.path === "/");
    const pitchEvents30d = ext30d.filter((e) => e.path.startsWith("/pitch"));

    const socialViews30d = ext30d.filter((e) => {
      const s = (e.source || "").toLowerCase();
      return (
        e.channel === "Social" ||
        s.includes("reddit") ||
        s.includes("linkedin") ||
        s.includes("twitter") ||
        s.includes("x /") ||
        s.includes("instagram")
      );
    }).length;

    const liveSubmitted30d = deals.filter((d) => {
      if (d.is_historical) return false;
      const t = d.received_at ? Date.parse(d.received_at) : 0;
      return t > 0 && nowMs - t <= ms30d;
    }).length;

    const countWithAvg = (eventsList: TrafficEvent[], keyFn: (e: TrafficEvent) => string, max = 10) => {
      const groups = new Map<string, TrafficEvent[]>();
      for (const e of eventsList) {
        const k = keyFn(e);
        const arr = groups.get(k) ?? [];
        arr.push(e);
        groups.set(k, arr);
      }
      return [...groups.entries()]
        .map(([label, arr]) => ({
          label,
          count: arr.length,
          unique: new Set(arr.map((x) => x.visitor)).size,
          avgDurationSec: avgSec(arr),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, max);
    };

    const dailySeries: { date: string; label: string; views: number; unique: number; ownerViews: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(nowMs - i * ms24h);
      const isoDay = d.toISOString().slice(0, 10);
      const dayExt = externalEvents.filter((e) => e.ts.slice(0, 10) === isoDay);
      const dayOwner = ownerEvents.filter((e) => e.ts.slice(0, 10) === isoDay);
      dailySeries.push({
        date: isoDay,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views: dayExt.length,
        unique: new Set(dayExt.map((e) => e.visitor)).size,
        ownerViews: dayOwner.length,
      });
    }

    const topSources = countWithAvg(ext30d, (e) => e.source || "Direct", 12);
    const topPages = countWithAvg(ext30d, (e) => pageDisplayName(e.path || "/"), 8);
    const topCountries = countWithAvg(ext30d, (e) => e.country || "Unknown", 10);
    const topCities = countWithAvg(
      ext30d,
      (e) => (e.city ? `${e.city}${e.region ? `, ${e.region}` : ""}, ${e.country}` : e.country || "Unknown"),
      10,
    );
    const topOS = countWithAvg(ext30d, (e) => e.os || "Unknown", 8);
    const topBrowsers = countWithAvg(ext30d, (e) => e.browser || "Unknown", 8);

    const devices = {
      desktop: ext30d.filter((e) => e.device === "desktop").length,
      mobile: ext30d.filter((e) => e.device === "mobile").length,
      tablet: ext30d.filter((e) => e.device === "tablet").length,
    };

    return NextResponse.json({
      ok: true,
      totalViews: externalEvents.length,
      views24h: ext24h.length,
      unique24h,
      views7d: ext7d.length,
      unique7d,
      views30d: ext30d.length,
      unique30d,
      socialViews30d,
      avgDurationSec: avgSec(ext30d),
      funnel30d: {
        landingViews: homeEvents30d.length,
        landingUnique: new Set(homeEvents30d.map((e) => e.visitor)).size,
        landingAvgSec: avgSec(homeEvents30d),
        pitchViews: pitchEvents30d.length,
        pitchUnique: new Set(pitchEvents30d.map((e) => e.visitor)).size,
        pitchAvgSec: avgSec(pitchEvents30d),
        submissions: liveSubmitted30d,
      },
      ownerStats: {
        uniqueEntity: ownerEvents.length > 0 ? 1 : 0,
        totalHits: ownerEvents.length,
        hits24h: owner24h.length,
        hits30d: owner30d.length,
        avgDurationSec: avgSec(owner30d),
        registeredNetworks: ownerNetworks.map((n) => ({
          label: n.label,
          location: [n.city, n.country].filter(Boolean).join(", ") || "Active Wi-Fi",
          registeredAt: n.registeredAt,
        })),
        currentWifiProtected: Boolean(currentIpHash),
        currentWifiLocation: [currentCity, currentCountry].filter(Boolean).join(", ") || "Detected",
      },
      dailySeries,
      topSources,
      topPages,
      topCountries,
      topCities,
      topOS,
      topBrowsers,
      devices,
      recent: externalEvents.slice(0, 100),
      ownerRecent: ownerEvents.slice(0, 100),
      auditLogs: auditLogs ?? [],
      accessRequests: Array.isArray(accessRequests) ? accessRequests : [],
    });
  } catch (err) {
    console.error("[api/track][GET] error:", err);
    return NextResponse.json({ error: "Failed to load traffic metrics" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; ts?: string };
    const store = (await getState<TrafficStore>(STATE_KEY).catch(() => undefined)) ?? {
      totalViews: 0,
      events: [],
      ownerNetworks: [],
    };
    const events = Array.isArray(store.events) ? [...store.events] : [];

    if (body.action === "mark_event_owner" && body.ts) {
      const updated = events.map((e) => (e.ts === body.ts ? { ...e, isOwner: true, ownerLabel: "YK · Partner Wi-Fi" } : e));
      await putState(STATE_KEY, { ...store, events: updated });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/track][PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update traffic record" }, { status: 500 });
  }
}
