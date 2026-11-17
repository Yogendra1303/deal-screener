/**
 * Semantic & Full-Text Deal Search Engine.
 * Tokenizes queries with VC domain concept expansion (synonyms for burn, runway, math gaps,
 * repeat founders, fintech, SaaS, etc.) and scores every deal across company metadata,
 * extracted deck text, founder profiles, financial metrics, and check flags.
 */

import type { DealRow } from "@/lib/db/repository";
import type { DealResult } from "@/lib/types";

export interface SearchHit {
  id: string;
  companyName: string;
  sector: string;
  stage: string;
  city: string;
  askAmount: number | null;
  status: string;
  score: number;
  snippet: string;
  matchedFields: string[];
  href: string;
}

const VC_SYNONYMS: Record<string, string[]> = {
  burn: ["burn", "runway", "cash", "deficit", "spend"],
  runway: ["runway", "cash", "months", "burn", "bridge"],
  mismatch: ["mismatch", "conflict", "gap", "discrepancy", "variance", "higher", "lower"],
  gap: ["gap", "conflict", "mismatch", "discrepancy", "variance"],
  missing: ["missing", "unverified", "incomplete", "blank"],
  repeat: ["repeat", "exited", "second-time", "prior", "founded"],
  saas: ["saas", "b2b", "software", "arr", "mrr", "subscription"],
  fintech: ["fintech", "payments", "lending", "payroll", "banking", "remittance", "bnpl"],
  climate: ["climate", "solar", "ev", "energy", "mobility", "carbon"],
  logistics: ["logistics", "freight", "trucking", "supply", "cold-chain", "fleet"],
  health: ["health", "healthtech", "clinic", "medical", "pharma", "patient"],
  ai: ["ai", "ml", "llm", "model", "automation", "intelligence"],
};

function expandTerms(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^a-z0-9.\s$-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const expanded = new Set<string>(raw);
  for (const term of raw) {
    const syns = VC_SYNONYMS[term];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }
  return [...expanded];
}

function buildSearchableDoc(row: DealRow): {
  companyName: string;
  sector: string;
  stage: string;
  city: string;
  status: string;
  fields: { label: string; text: string; weight: number }[];
} {
  const rec = row.record_json as DealResult | null | undefined;
  const intake = row.intake_json as { oneLiner?: string; form?: { companyName?: string; founders?: Array<{ name?: string }> } } | null | undefined;

  const companyName =
    (intake?.form?.companyName && (!row.company_name || row.company_name === row.id) ? intake.form.companyName : row.company_name) ||
    rec?.form?.companyName ||
    row.id;
  const sector = row.sector || rec?.form?.sector || "Technology";
  const stage = row.stage || rec?.form?.stage || "Seed";
  const city = row.city || row.location || row.country || "";
  const status = row.status || "New";

  const foundersText = [
    row.founder_name || "",
    row.founder_email || "",
    ...(intake?.form?.founders?.map((f) => f.name || "") ?? []),
    ...(rec?.record?.team?.map((t) => `${t.name} ${t.role ?? ""} ${t.pastRoles?.map((r) => `${r.company} ${r.title}`).join(" ") ?? ""}`) ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const flagsText = [
    row.checks_status || "",
    ...(rec?.flags?.map((fl) => `${fl.kind} ${fl.title} ${fl.detail}`) ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const summaryText = [
    row.one_line_pitch || "",
    intake?.oneLiner || "",
    row.summary || "",
    rec?.record?.oneLiner || "",
    rec?.ai?.summary || "",
    ...(rec?.ai?.strengths ?? []),
    ...(rec?.ai?.concerns ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    companyName,
    sector,
    stage,
    city,
    status,
    fields: [
      { label: "Company", text: companyName, weight: 8 },
      { label: "Sector", text: `${sector} ${row.sub_category || ""}`, weight: 5 },
      { label: "Founder", text: foundersText, weight: 5 },
      { label: "Stage & Geo", text: `${stage} ${city} ${row.country || ""}`, weight: 3 },
      { label: "Checks & Flags", text: flagsText, weight: 4 },
      { label: "Pitch & AI Notes", text: summaryText, weight: 3 },
      { label: "Status", text: `${status} ${row.band || ""} ${row.founder_fit || ""}`, weight: 2 },
    ],
  };
}

export function searchDealsIndex(rows: DealRow[], query: string, limit = 12): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const qLower = q.toLowerCase();
  const exactTokens = qLower.split(/\s+/).filter((w) => w.length >= 2);
  const terms = expandTerms(q);
  const hits: SearchHit[] = [];

  for (const row of rows) {
    const doc = buildSearchableDoc(row);
    let score = 0;
    const matchedFields = new Set<string>();
    let bestSnippet = "";

    // Exact phrase boost
    if (doc.companyName.toLowerCase().includes(qLower)) {
      score += 25;
      matchedFields.add("Company");
    }

    for (const f of doc.fields) {
      const hay = f.text.toLowerCase();
      if (!hay) continue;

      let fieldHits = 0;
      for (const t of exactTokens) {
        if (hay.includes(t)) {
          score += f.weight * 2;
          fieldHits++;
        }
      }
      for (const t of terms) {
        if (!exactTokens.includes(t) && hay.includes(t)) {
          score += f.weight * 0.8;
          fieldHits++;
        }
      }

      if (fieldHits > 0) {
        matchedFields.add(f.label);
        if (!bestSnippet && f.label !== "Company" && f.text.trim()) {
          bestSnippet = f.text.trim().slice(0, 140);
        }
      }
    }

    if (score > 0) {
      const fallbackSnippet =
        doc.fields.find((f) => f.label === "Pitch & AI Notes")?.text.slice(0, 130) ||
        `${doc.sector} · ${doc.stage}${doc.city ? ` · ${doc.city}` : ""}`;

      hits.push({
        id: row.id,
        companyName: doc.companyName,
        sector: doc.sector,
        stage: doc.stage,
        city: doc.city,
        askAmount: row.ask_amount ?? null,
        status: doc.status,
        score: Math.round(score * 10) / 10,
        snippet: bestSnippet || fallbackSnippet,
        matchedFields: [...matchedFields],
        href: `/deals/${encodeURIComponent(row.id)}`,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.companyName.localeCompare(b.companyName)).slice(0, limit);
}
