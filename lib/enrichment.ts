/**
 * Live Company Website, Public Mentions & Registry Enrichment Engine.
 * Performs fast, bounded live probes (domain SSL/title check + Hacker News public mentions)
 * and generates direct verifiable links to MCA/ZaubaCorp, OpenCorporates, Crunchbase, LinkedIn, and SEC.
 */

export interface WebsiteProbe {
  url: string;
  reachable: boolean;
  status?: number;
  https: boolean;
  title?: string;
  description?: string;
  latencyMs?: number;
}

export interface PublicMention {
  title: string;
  url: string;
  points: number;
  date: string;
  source: "Hacker News";
}

export interface VerificationLink {
  label: string;
  category: "Registry" | "Funding" | "Founder";
  url: string;
}

export interface EnrichmentReport {
  dealId: string;
  companyName: string;
  checkedAt: string;
  website: WebsiteProbe | null;
  mentions: PublicMention[];
  links: VerificationLink[];
}

function normalizeHttpUrl(raw?: string | null): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function isSafePublicHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    // Block SSRF against loopback, link-local, or private RFC1918 hosts
    if (
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.0\.0\.0|^\[::1\]/.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) {
      return false;
    }
    return h.includes(".");
  } catch {
    return false;
  }
}

async function probeWebsite(rawUrl?: string | null): Promise<WebsiteProbe | null> {
  const url = normalizeHttpUrl(rawUrl);
  if (!url || !isSafePublicHost(url)) return null;

  const started = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "AarkaDiligenceBot/1.0 (+https://www.aarkavc.xyz)" },
    });
    const latencyMs = Date.now() - started;
    const html = (await res.text().catch(() => "")).slice(0, 32_000);
    const titleMatch = html.match(/<title[^>]*>([^<]{1,180})<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,260})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{1,260})["'][^>]+name=["']description["']/i);

    return {
      url: res.url || url,
      reachable: res.status >= 200 && res.status < 400,
      status: res.status,
      https: (res.url || url).startsWith("https://"),
      title: titleMatch?.[1]?.replace(/\s+/g, " ").trim(),
      description: descMatch?.[1]?.replace(/\s+/g, " ").trim(),
      latencyMs,
    };
  } catch {
    return {
      url,
      reachable: false,
      https: url.startsWith("https://"),
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHnMentions(companyName: string): Promise<PublicMention[]> {
  const q = companyName.trim();
  if (q.length < 3) return [];
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${q}"`)}&tags=story&hitsPerPage=4`,
      { signal: ctrl.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: Array<{ title?: string; url?: string; objectID?: string; points?: number; created_at?: string }>;
    };
    return (data.hits ?? [])
      .filter((h) => h.title)
      .map((h) => ({
        title: String(h.title),
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: Number(h.points || 0),
        date: (h.created_at || "").slice(0, 10),
        source: "Hacker News" as const,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function runLiveEnrichment(input: {
  dealId: string;
  companyName: string;
  website?: string | null;
  country?: string | null;
  founderNames?: string[];
}): Promise<EnrichmentReport> {
  const [website, mentions] = await Promise.all([
    probeWebsite(input.website),
    fetchHnMentions(input.companyName),
  ]);

  const qCompany = encodeURIComponent(input.companyName.trim());
  const links: VerificationLink[] = [
    {
      label: "OpenCorporates Global Registry",
      category: "Registry",
      url: `https://opencorporates.com/companies?q=${qCompany}`,
    },
    ...(input.country?.toLowerCase().includes("india")
      ? [
          {
            label: "MCA India / ZaubaCorp Lookup",
            category: "Registry" as const,
            url: `https://www.zaubacorp.com/companysearchresults/${qCompany}`,
          },
        ]
      : [
          {
            label: "SEC EDGAR Form D Lookup",
            category: "Registry" as const,
            url: `https://www.sec.gov/edgar/search/#/q=${qCompany}&forms=D`,
          },
        ]),
    {
      label: "Crunchbase Company & Rounds",
      category: "Funding",
      url: `https://www.crunchbase.com/textsearch?q=${qCompany}`,
    },
    {
      label: "LinkedIn Company Profile",
      category: "Funding",
      url: `https://www.linkedin.com/search/results/companies/?keywords=${qCompany}`,
    },
    ...(input.founderNames ?? [])
      .filter((n) => n.trim().length > 1)
      .slice(0, 3)
      .map((name) => ({
        label: `LinkedIn: ${name.trim()}`,
        category: "Founder" as const,
        url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name.trim()} ${input.companyName.trim()}`)}`,
      })),
  ];

  return {
    dealId: input.dealId,
    companyName: input.companyName,
    checkedAt: new Date().toISOString(),
    website,
    mentions,
    links,
  };
}
