// Sample registry and profile records. These stand in for real company-registry and
// LinkedIn lookups, which the prototype doesn't do. Every record is labelled as a sample.
import registryData from "../data/fixtures/registry.json";
import profileData from "../data/fixtures/profiles.json";
import type { Profile, RegistryRecord } from "./types";

const registry = registryData as Record<string, RegistryRecord>;
const profiles = profileData as Record<string, Profile>;

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llc|fz-llc|fzco|inc|technologies|technology)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function findRegistry(companyName: string): RegistryRecord | null {
  return registry[normaliseName(companyName)] ?? null;
}

export function findProfiles(founderNames: string[]): Profile[] {
  const out: Profile[] = [];
  for (const name of founderNames) {
    const p = profiles[normaliseName(name)];
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}
