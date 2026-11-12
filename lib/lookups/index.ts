// The one entry point the pipeline uses for registry and founder-profile facts.
//   - With any lookup key set, facts come from the live services only. A miss means "no data", never a sample record.
//   - With no key set, the labelled sample fixtures are used so the prototype and the tests still run offline.
import { findProfiles, findRegistry } from "../fixtures";
import type { FormInput, Profile, RegistryRecord } from "../types";
import { fetchRegistry, registryKeysFromEnv } from "./registry";
import { fetchProfiles } from "./profiles";

export function liveRegistryEnabled(): boolean {
  const k = registryKeysFromEnv();
  return Boolean(k.openCorporates || k.clearbit);
}
export function liveProfilesEnabled(): boolean {
  return Boolean(process.env.PROXYCURL_API_KEY);
}

export interface Lookups {
  registry: RegistryRecord | null;
  profiles: Profile[];
  /** Where each answer came from, for the audit trail. */
  mode: { registry: "live" | "sample"; profiles: "live" | "sample" };
}

export async function lookupFacts(form: FormInput, extra: { companyName?: string; founderNames?: string[] } = {}): Promise<Lookups> {
  const names = [form.companyName, extra.companyName ?? ""].filter(Boolean);
  const founders = [...form.founders, ...(extra.founderNames ?? []).filter((n) => !form.founders.some((f) => f.name === n)).map((name) => ({ name, profileUrl: "" }))];

  let registry: RegistryRecord | null;
  if (liveRegistryEnabled()) {
    registry = null;
    for (const n of names) {
      registry = await fetchRegistry({ companyName: n, website: form.website, country: form.country });
      if (registry) break;
    }
  } else {
    registry = names.map((n) => findRegistry(n)).find(Boolean) ?? null;
  }

  const profiles = liveProfilesEnabled() ? await fetchProfiles(founders) : findProfiles(founders.map((f) => f.name));
  return { registry, profiles, mode: { registry: liveRegistryEnabled() ? "live" : "sample", profiles: liveProfilesEnabled() ? "live" : "sample" } };
}
