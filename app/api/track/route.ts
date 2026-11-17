import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getState, listAuditLogs, listDeals, putState } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";

const STATE_KEY = "site_traffic_v1";
const MAX_EVENTS = 2500;
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|telegrambot|slackbot|discordbot|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests/i;

export interface TrafficEvent {
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
  visitor: string;
  /** Salted one-way hash of the visitor's network IP (never raw IP) used to separate partner Wi-Fi from external visitors. */
  ipHash?: string;
  /** True when the visit came from a registered Partner / Team Wi-Fi or device. */
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

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 40;
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

function getClientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
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
    if (host.includes("reddit.com") || host === "redd.it" || host === "out.reddit.com") {
      return { source: "Reddit", channel: "Social" };
    }
    if (host.includes("linkedin.com") || host === "lnkd.in") {
      return { source: "LinkedIn", channel: "Social" };
    }
    if (host === "t.co" || host.includes("twitter.com") || host.includes("x.com")) {
      return { source: "X / Twitter", channel: "Social" };
    }
    if (host.includes("instagram.com") || host === "l.instagram.com") {
      return { source: "Instagram", channel: "Social" };
    }
    if (host.includes("facebook.com") || host === "lm.facebook.com" || host === "m.facebook.com") {
      return { source: "Facebook", channel: "Social" };
    }
    if (host.includes("youtube.com") || host === "youtu.be") {
      return { source: "YouTube", channel: "Social" };
    }
    if (host.includes("whatsapp.com") || host === "wa.me") {
      return { source: "WhatsApp", channel: "Messaging" };
    }
    if (host.includes("news.ycombinator.com")) {
      return { source: "Hacker News", channel: "Community" };
    }
    if (host.includes("producthunt.com")) {
      return { source: "Product Hunt", channel: "Community" };
    }
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

/** Public anonymous pageview beacon — automatically tags Partner Wi-Fi separately from external visitors. */
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT_RE.test(ua)) {
      return NextResponse.json({ ok: true, ignored: "bot" });
    }

    const ip = getClientIp(req);
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
      screen?: string;
      timezone?: string;
      language?: string;
    };

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

    const existing = (await getState<TrafficStore>(STATE_KEY).catch(() => undefined)) ?? {
      totalViews: 0,
      events: [],
      ownerNetworks: [],
    };
    const ownerNetworks = Array.isArray(existing.ownerNetworks) ? existing.ownerNetworks : [];
    const matchedOwner = ipHash ? ownerNetworks.find((n) => n.ipHash === ipHash) : undefined;

    const event: TrafficEvent = {
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

    const prevEvents = Array.isArray(existing.events) ? existing.events : [];
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

/** Partner-only analytics endpoint — automatically registers Partner Wi-Fi & strictly separates External vs. Your/Team visits. */
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

    const currentIp = getClientIp(req);
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

    // Automatically register this authenticated partner's current Wi-Fi IP hash so
    // even their Incognito / mobile tests on the same Wi-Fi are cleanly separated from External Visitors!
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

      void putState(STATE_KEY, {
        ...store,
        ownerNetworks,
      }).catch(() => undefined);
    }

    const ownerHashSet = new Set(ownerNetworks.map((n) => n.ipHash));
    const ownerLabelByHash = new Map(ownerNetworks.map((n) => [n.ipHash, n.label]));

    const allEvents = (Array.isArray(store.events) ? store.events : []).map((ev) => {
      const matched = Boolean(ev.isOwner || (ev.ipHash && ownerHashSet.has(ev.ipHash)));
      return {
        ...ev,
        isOwner: matched,
        ownerLabel: ev.ownerLabel || (ev.ipHash ? ownerLabelByHash.get(ev.ipHash) : undefined) || (matched ? partnerLabel : undefined),
      };
    });

    // STRICT SEPARATION: External Visitors vs. Your / Partner Wi-Fi Visits
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

    const homeViews30d = ext30d.filter((e) => e.path === "/").length;
    const pitchViews30d = ext30d.filter((e) => e.path.startsWith("/pitch")).length;
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

    const countMap = (items: string[], max = 10) => {
      const m = new Map<string, number>();
      for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
      return [...m.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, max);
    };

    // 14-day daily chart series (strictly External Visitors, plus ownerViews kept separately)
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

    const topSources = countMap(ext30d.map((e) => e.source || "Direct"), 12);
    const topChannels = countMap(ext30d.map((e) => e.channel || "Direct"), 8);
    const topPages = countMap(ext30d.map((e) => e.path || "/"), 8);
    const topCountries = countMap(ext30d.map((e) => e.country || "Unknown"), 10);
    const topCities = countMap(
      ext30d.map((e) => (e.city ? `${e.city}${e.region ? `, ${e.region}` : ""}, ${e.country}` : e.country || "Unknown")),
      10,
    );
    const topOS = countMap(ext30d.map((e) => e.os || "Unknown"), 8);
    const topBrowsers = countMap(ext30d.map((e) => e.browser || "Unknown"), 8);
    const devices = {
      desktop: ext30d.filter((e) => e.device === "desktop").length,
      mobile: ext30d.filter((e) => e.device === "mobile").length,
      tablet: ext30d.filter((e) => e.device === "tablet").length,
    };

    return NextResponse.json({
      ok: true,
      // Strictly External Visitor metrics (never mixed with YK / Partner Wi-Fi)
      totalViews: externalEvents.length,
      views24h: ext24h.length,
      unique24h,
      views7d: ext7d.length,
      unique7d,
      views30d: ext30d.length,
      unique30d,
      socialViews30d,
      funnel30d: {
        landingViews: homeViews30d,
        pitchViews: pitchViews30d,
        submissions: liveSubmitted30d,
      },
      // Strictly Separate Partner / Team Wi-Fi metrics
      ownerStats: {
        totalViews: ownerEvents.length,
        views24h: owner24h.length,
        views30d: owner30d.length,
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
      topChannels,
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

/** Partner-only action: mark legacy pre-fingerprint visits from current city/Direct as Owner visits, or clear owner test hits. */
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

    if (body.action === "mark_legacy_city_owner") {
      const rawCity = req.headers.get("x-vercel-ip-city") || "";
      let city = "";
      try {
        city = rawCity ? decodeURIComponent(rawCity) : "";
      } catch {
        city = rawCity;
      }
      const updated = events.map((e) =>
        !e.ipHash && city && (e.city || "").toLowerCase() === city.toLowerCase()
          ? { ...e, isOwner: true, ownerLabel: "YK · Partner Wi-Fi" }
          : e,
      );
      await putState(STATE_KEY, { ...store, events: updated });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/track][PATCH] error:", err);
    return NextResponse.json({ error: "Failed to update traffic record" }, { status: 500 });
  }
}
