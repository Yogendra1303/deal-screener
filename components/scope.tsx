"use client";

// Analysts see only their own companies and pitches. Partners see the whole fund.
// (Owner's rule: an analyst checks the health of their own portfolio, not the whole fund.)
import { usePortfolio } from "./portfolio-store";
import { useWorkspace } from "./workspace";

export type Scope = "mine" | "all";

export function useScope() {
  const w = useWorkspace();
  const analyst = w.role === "Analyst";
  const effective: Scope = analyst ? "mine" : "all";
  return {
    analyst,
    scope: effective,
    inScope: (owner?: string) => effective === "all" || owner === w.me,
  };
}

/** Portfolio companies this person looks after: all of them for a partner, their own for an analyst. */
export function useMyCompanies() {
  const w = useWorkspace();
  const p = usePortfolio();
  return w.role === "Analyst" ? p.companies.filter((c) => c.owner === w.me) : p.companies;
}
