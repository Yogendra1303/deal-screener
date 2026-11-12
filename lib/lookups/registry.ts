// Live company-registry lookup. OpenCorporates is tried first (a legal incorporation date), then Clearbit
// (a founding year only). Keys are read on the server from OPENCORPORATES_API_KEY and CLEARBIT_API_KEY.
import type { RegistryRecord } from "../types";
import { getJson } from "./http";

export interface RegistryKeys {
  openCorporates?: string;
  clearbit?: string;
}

export function registryKeysFromEnv(): RegistryKeys {
  return { openCorporates: process.env.OPENCORPORATES_API_KEY || undefined, clearbit: process.env.CLEARBIT_API_KEY || undefined };
}

const JURISDICTION: Record<string, string> = {
  india: "in", uae: "ae", "united arab emirates": "ae", "united kingdom": "gb", uk: "gb", "united states": "us", usa: "us",
  singapore: "sg", germany: "de", france: "fr", ireland: "ie", nigeria: "ng", kenya: "ke", indonesia: "id", brazil: "br",
};

interface OcCompany {
  name?: string;
  incorporation_date?: string | null;
  jurisdiction_code?: string;
  current_status?: string | null;
  company_number?: string;
  opencorporates_url?: string;
}

function sameCompany(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/\b(private|pvt|limited|ltd|llc|fz-llc|fzco|inc|technologies|technology)\b/g, "").replace(/[^a-z0-9]/g, "");
  const x = n(a), y = n(b);
  return x.length > 0 && (x === y || x.startsWith(y) || y.startsWith(x));
}

export async function lookupOpenCorporates(name: string, country: string, key: string): Promise<RegistryRecord | null> {
  const j = JURISDICTION[country.trim().toLowerCase()];
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}&order=score${j ? `&jurisdiction_code=${j}` : ""}&per_page=5&api_token=${encodeURIComponent(key)}`;
  const data = await getJson<{ results?: { companies?: { company: OcCompany }[] } }>(url, { cacheKey: `oc:${name}:${j ?? ""}` });
  const match = data?.results?.companies?.map((c) => c.company).find((c) => c.name && c.incorporation_date && sameCompany(c.name, name));
  if (!match?.name || !match.incorporation_date) return null;
  return {
    legalName: match.name,
    incorporated: match.incorporation_date.slice(0, 10),
    country,
    status: match.current_status ?? "Unknown",
    directors: [], // officers are a separate paid call; the founding-date check doesn't need them
    source: `OpenCorporates${match.opencorporates_url ? ` (${match.opencorporates_url})` : ""}`,
  };
}

export async function lookupClearbit(name: string, website: string, country: string, key: string): Promise<RegistryRecord | null> {
  let domain = "";
  try {
    domain = new URL(/^https?:\/\//.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!domain) return null;
  const data = await getJson<{ legalName?: string | null; name?: string; foundedYear?: number | null }>(
    `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`,
    { headers: { Authorization: `Bearer ${key}` }, cacheKey: `cb:${domain}` },
  );
  if (!data?.foundedYear) return null;
  return {
    legalName: data.legalName ?? data.name ?? name,
    incorporated: `${data.foundedYear}-01-01`, // Clearbit gives a year only
    country,
    status: "Unknown",
    directors: [],
    source: `Clearbit (founding year ${data.foundedYear}; month and day not given)`,
  };
}

/** Live registry record for a company, or null when nothing trustworthy was found. Never throws. */
export async function fetchRegistry(a: { companyName: string; website?: string; country?: string }, keys: RegistryKeys = registryKeysFromEnv()): Promise<RegistryRecord | null> {
  const country = a.country ?? "";
  if (keys.openCorporates) {
    try {
      const r = await lookupOpenCorporates(a.companyName, country, keys.openCorporates);
      if (r) return r;
    } catch {
      // fall through to the next source
    }
  }
  if (keys.clearbit && a.website) {
    try {
      return await lookupClearbit(a.companyName, a.website, country, keys.clearbit);
    } catch {
      return null;
    }
  }
  return null;
}
