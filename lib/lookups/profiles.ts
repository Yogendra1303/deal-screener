// Live founder-profile lookup through Proxycurl (LinkedIn). Key: PROXYCURL_API_KEY, read on the server.
import type { FounderInput, Profile, ProfileRole } from "../types";
import { getJson } from "./http";

interface PcExperience {
  company?: string | null;
  title?: string | null;
  starts_at?: { year: number; month?: number | null } | null;
  ends_at?: { year: number; month?: number | null } | null;
}
interface PcProfile {
  full_name?: string | null;
  headline?: string | null;
  experiences?: PcExperience[];
}

const ym = (d: { year: number; month?: number | null }) => `${d.year}-${String(d.month ?? 1).padStart(2, "0")}`;

export function toProfile(p: PcProfile, fallbackName: string, url: string): Profile {
  const roles: ProfileRole[] = (p.experiences ?? [])
    .filter((e) => e.company && e.title && e.starts_at)
    .map((e) => ({ company: e.company as string, title: e.title as string, start: ym(e.starts_at!), end: e.ends_at ? ym(e.ends_at) : null }));
  return { name: p.full_name || fallbackName, headline: p.headline ?? "", roles, source: `Proxycurl / LinkedIn (${url})` };
}

export async function lookupProfile(f: FounderInput, key: string): Promise<Profile | null> {
  if (!/^https?:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(f.profileUrl ?? "")) return null;
  const data = await getJson<PcProfile>(`https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(f.profileUrl)}&use_cache=if-present`, {
    headers: { Authorization: `Bearer ${key}` },
    cacheKey: `pc:${f.profileUrl}`,
    timeoutMs: 20_000,
  });
  return data ? toProfile(data, f.name, f.profileUrl) : null;
}

/** Live profiles for the founders who gave a LinkedIn URL. Failures drop that founder only; never throws. */
export async function fetchProfiles(founders: FounderInput[], key: string | undefined = process.env.PROXYCURL_API_KEY || undefined): Promise<Profile[]> {
  if (!key) return [];
  const out = await Promise.all(founders.map((f) => lookupProfile(f, key).catch(() => null)));
  return out.filter((p): p is Profile => p != null);
}
