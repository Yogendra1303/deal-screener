"use client";

// Who a founder is to the fund, worked out from the email address the fund already holds for them.
// Founders sign in with a one-time link sent to that address; there are no founder passwords.
import { useMemo } from "react";
import { useLinks } from "./links-store";
import { usePortfolio } from "./portfolio-store";
import { useStore } from "./store";
import { founderEmail, type FounderRequest } from "@/lib/links";

const KEY = "ds.founder.v1";

export function founderSession(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setFounderSession(email: string | null) {
  try {
    if (email) window.localStorage.setItem(KEY, email.trim().toLowerCase());
    else window.localStorage.removeItem(KEY);
  } catch {
    // Not saved; the founder signs in again next time.
  }
}

export interface FounderCompany {
  id: string;
  name: string;
  side: "pitch" | "portfolio";
  founder: string;
  requests: FounderRequest[];
}

/** Every company this email belongs to, and what the fund has asked of it. */
export function useFounderAccess(email: string | null): FounderCompany[] {
  const links = useLinks();
  const p = usePortfolio();
  const store = useStore();
  return useMemo(() => {
    if (!email) return [];
    const e = email.trim().toLowerCase();
    const out = new Map<string, FounderCompany>();
    const add = (id: string, name: string, side: "pitch" | "portfolio", founder: string) => {
      if (!out.has(id)) out.set(id, { id, name, side, founder, requests: links.requestsFor(id) });
    };
    for (const c of p.companies) for (const f of c.founders) if (founderEmail(f.name, c.name) === e) add(c.id, c.name, "portfolio", f.name);
    for (const d of store.deals) if (d.form.email.toLowerCase() === e || d.form.founders.some((f) => founderEmail(f.name, d.form.companyName) === e)) add(d.id, d.form.companyName, "pitch", d.form.founders[0]?.name ?? "");
    for (const s of store.unprocessed) if (s.form.email.toLowerCase() === e) add(s.id, s.form.companyName, "pitch", s.form.founders[0]?.name ?? "");
    for (const i of links.inbound) if (i.form.email.toLowerCase() === e) add(i.id, i.form.companyName, "pitch", i.form.founders[0]?.name ?? "");
    for (const r of links.requests) if (founderEmail(r.founder, r.companyName) === e) add(r.companyId, r.companyName, r.side, r.founder);
    return [...out.values()];
  }, [email, links, p.companies, store.deals, store.unprocessed]);
}
