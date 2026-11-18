// Institutional data lineage catalog, active intelligence engines, metric definitions, and audit log builder.
// Every status reflects what Aarka executes in production today vs. upcoming enterprise connectors.
import { fmtMonth } from "./format";
import type { DealResult } from "./types";
import type { PortfolioCompany } from "./portfolio/types";
import { METRICS } from "./portfolio/types";
import { portfolioFlags } from "./portfolio/health";
import type { Question } from "./questions";

export type SourceStatus = "Connected" | "Needs an API key" | "Assisted" | "Planned";
export type SourceCategory = "Founder Intake" | "Financials & MIS" | "External Intelligence" | "Enterprise Connectors";

export interface DataSource {
  id: string;
  name: string;
  shortName: string;
  category: SourceCategory;
  gives: string;
  howRead: string;
  status: SourceStatus;
  note: string;
  security: string;
  surfaces: { label: string; href: string }[];
}

export const SOURCES: DataSource[] = [
  {
    id: "pitch_decks",
    name: "Pitch Decks (PDF)",
    shortName: "Pitch deck PDFs",
    category: "Founder Intake",
    gives: "Company thesis, round ask, valuation cap, traction claims, unit economics, team roles, and market sizing.",
    howRead:
      "Dual-engine pipeline: Claude Sonnet 4.5 native PDF vision plus a zero-dependency ToUnicode CMap text parser and 7-section structural deck validator. Every extracted claim keeps its exact slide page and verbatim quote.",
    status: "Connected",
    note: "Non-standard or incomplete uploads (invoices, resumes, bare 1-pagers) are flagged automatically and clamped to Grade G.",
    security: "Binary %PDF magic-byte verification, 32 MB size guard, private Supabase Storage signed URLs.",
    surfaces: [
      { label: "Pitches", href: "/deals" },
      { label: "Data Room", href: "/dataroom" },
    ],
  },
  {
    id: "founder_links",
    name: "Founder Intake & Private Data Rooms",
    shortName: "Founder intake & links",
    category: "Founder Intake",
    gives: "Structured pitch form answers, requested diligence packs (cap tables, bank statements, cohorts), and direct status updates.",
    howRead:
      "Founders submit via /pitch or partner-issued request links without creating an account. Uploads stream directly to encrypted storage and trigger live re-scoring.",
    status: "Connected",
    note: "Time-bound HMAC-SHA256 v2 tracking tokens (60-day TTL) isolate each founder strictly to their own deal record.",
    security: "Row-level token verification rejects forged or cross-deal requests with 401/403.",
    surfaces: [
      { label: "Pitch Intake", href: "/pitch" },
      { label: "Data Room", href: "/dataroom" },
    ],
  },
  {
    id: "application_form",
    name: "Structured Intake Form",
    shortName: "Application form",
    category: "Founder Intake",
    gives: "Stage, sector, geography, USD round ask, website URL, founder names, LinkedIn profiles, and contact email.",
    howRead:
      "Validated deterministically on submission and immediately cross-checked against written Fund Mandate rules and the deck's stated round size.",
    status: "Connected",
    note: "Feeds instant mandate fit filtering and triggers automated partner notifications.",
    security: "Honeypot bot protection + IP rate limiting on public submission endpoints.",
    surfaces: [
      { label: "Pitches", href: "/deals" },
      { label: "Fund Rules", href: "/rules" },
    ],
  },
  {
    id: "numbers_sheet",
    name: "Monthly Financial Sheets (CSV / Excel)",
    shortName: "Monthly CSV sheets",
    category: "Financials & MIS",
    gives: "Month-by-month revenue/MRR, paying customers, headcount, net burn, and cash in bank.",
    howRead:
      "Parsed deterministically by code into a normalized monthly series. Cross-checked against deck claims using the strict >10% variance threshold and optional multi-currency FX normalization (USD/INR/AED/SAR/EUR/GBP).",
    status: "Connected",
    note: "Partners can also upload a CSV directly on any Deal page to trigger live Grade G to Grade B re-scoring.",
    security: "Zero AI math: all ARR, growth, burn multiple, and runway formulas run in deterministic TypeScript.",
    surfaces: [
      { label: "Compare Grid", href: "/compare" },
      { label: "How Numbers Work", href: "/method" },
    ],
  },
  {
    id: "monthly_mis",
    name: "Portfolio Monthly MIS & Runway Radar",
    shortName: "Portfolio monthly MIS",
    category: "Financials & MIS",
    gives: "Post-investment monthly revenue, net burn, cash balance, paying customers, and MIS attachments.",
    howRead:
      "Ingested via self-serve Partner CSV dropzones on /portfolio/[id] or founder reporting links. Immediately refreshes revenue-vs-plan charts, runway radar (<9 mo warnings), and Fund Analytics NAV.",
    status: "Connected",
    note: "Automated digest cron checks low-runway alerts and overdue MIS filings against the 15th-of-month SLA.",
    security: "Founder figures are preserved verbatim; discrepancies against MIS pages are flagged, never silently overwritten.",
    surfaces: [
      { label: "Portfolio", href: "/portfolio" },
      { label: "Fund Analytics", href: "/fund" },
    ],
  },
  {
    id: "web_research",
    name: "Live Web Research & Competitor Matrix",
    shortName: "Live web research",
    category: "External Intelligence",
    gives: "Named and unnamed competitors, bottom-up TAM sizing, and cited public red flags.",
    howRead:
      "Runs Claude with live web search tool execution; every competitor entry, market assumption, and risk signal requires a verifiable source URL.",
    status: "Needs an API key",
    note: "Triggered on-demand from any deal's Market tab once ANTHROPIC_API_KEY is configured.",
    security: "Strict schema validation prevents uncited claims from persisting to the deal record.",
    surfaces: [
      { label: "Pitches", href: "/deals" },
      { label: "Market Pulse", href: "/sectors" },
    ],
  },
  {
    id: "entity_enrichment",
    name: "Entity Probes & Registry Verification",
    shortName: "Registries & web probes",
    category: "External Intelligence",
    gives: "Live website SSL/HTTP reachability, page metadata, Hacker News mentions, and direct MCA/ZaubaCorp, OpenCorporates, Crunchbase, LinkedIn, and SEC verification links.",
    howRead:
      "SSRF-hardened server probes verify the company domain and public mentions in real time, paired with curated registry lookups to cross-check incorporation year and directors.",
    status: "Connected",
    note: "Blocks private RFC1918/loopback targets and validates redirect hops against SSRF.",
    security: "Authenticated VC-only endpoint (/api/deals/[id]/enrich) with bounded 5-second timeouts.",
    surfaces: [
      { label: "Pitches", href: "/deals" },
      { label: "How Numbers Work", href: "/method" },
    ],
  },
  {
    id: "founder_profiles",
    name: "Founder Background & Pedigree Signals",
    shortName: "Founder profiles",
    category: "External Intelligence",
    gives: "Prior founding history, domain operator depth, technical/CTO roles, and role tenure verification.",
    howRead:
      "Evaluated deterministically inside Pillar 3 of the Conviction Matrix (Serial Founder +35, Domain Overlap +30, Tech Pedigree +20, Registry Match +15). School, age, and hometown are strictly excluded.",
    status: "Assisted",
    note: "Cross-checks deck team slides against submitted LinkedIn links and reference profiles without scraping.",
    security: "Bias-controlled rubric: scores operator experience and domain relevance only.",
    surfaces: [
      { label: "How Numbers Work", href: "/method" },
      { label: "Pitches", href: "/deals" },
    ],
  },
  {
    id: "email_calendar",
    name: "Email & Calendar Relationship Graph",
    shortName: "Email & calendar",
    category: "Enterprise Connectors",
    gives: "Warm intro paths, partner touchpoint recency, and automatic inbound pitch forwarding.",
    howRead:
      "Inbound pitch webhook (/api/webhooks/inbound-email) is ready for Resend/Postmark routing; full Google Workspace / Microsoft 365 header sync is scheduled for Phase 2.",
    status: "Planned",
    note: "Will inspect message headers and calendar invites only, never private email bodies.",
    security: "Least-privilege metadata-only OAuth scopes planned.",
    surfaces: [{ label: "Team", href: "/team" }],
  },
  {
    id: "external_datarooms",
    name: "External Data Rooms (Drive / DocSend)",
    shortName: "Drive / DocSend sync",
    category: "Enterprise Connectors",
    gives: "Multi-file diligence folders, signed SAFEs, audited financials, and cap table exports.",
    howRead:
      "Native Aarka Data Room is live today; automated one-click mirroring from Google Drive, SharePoint, and DocSend is on the enterprise roadmap.",
    status: "Planned",
    note: "Each mirrored document will inherit Aarka's slide/page provenance engine.",
    security: "Read-only scoped connector tokens with audit logging.",
    surfaces: [{ label: "Data Room", href: "/dataroom" }],
  },
  {
    id: "paid_databases",
    name: "Institutional Data Feeds (PitchBook / Tracxn)",
    shortName: "PitchBook / Tracxn API",
    category: "Enterprise Connectors",
    gives: "Verified prior funding rounds, co-investor syndicates, and historical headcount curves.",
    howRead:
      "Designed for Bring-Your-Own-License (BYOL) API integration using the fund's existing data provider credentials.",
    status: "Planned",
    note: "Official licensed APIs only; Aarka never scrapes third-party paywalled databases.",
    security: "Fund-scoped encrypted API credentials.",
    surfaces: [{ label: "Market Pulse", href: "/sectors" }],
  },
];

export type AgentStatus = "Live · Hybrid AI + Code" | "Live · Deterministic Code" | "Live · Needs API Key" | "Planned";

export interface Agent {
  id: string;
  name: string;
  job: string;
  reads: string[];
  suggests: string;
  approval: string;
  guardrail: string;
  status: AgentStatus;
  statusNote: string;
  href: string;
}

export const AGENTS: Agent[] = [
  {
    id: "deck_extractor",
    name: "Pitch Deck Extractor & Structural Gate",
    job: "Validates pitch deck structure and extracts source-cited facts with page numbers and verbatim quotes.",
    reads: ["PDF Deck", "Intake Form", "ToUnicode Text Layer"],
    suggests: "Structured deal record, 7-section structural validation report, non-deck warnings, and slide citations.",
    approval: "Partners click any citation badge to jump directly to the exact slide inside the side-by-side PDF viewer.",
    guardrail: "Dual-engine resilience: Claude Sonnet 4.5 primary with zero-dependency local PDF text fallback. Never alters raw numbers.",
    status: "Live · Hybrid AI + Code",
    statusNote: "Active on every /pitch submission and deal upload.",
    href: "/deals",
  },
  {
    id: "math_auditor",
    name: "Financial Math Gap & FX Auditor",
    job: "Deterministically cross-checks slide claims against monthly CSV sheets, forms, and registry filings.",
    reads: ["Deck Claims", "Monthly CSV", "Intake Form", "Registry"],
    suggests: "8-row Evidence Matrix flagging any discrepancy strictly >10% with full written arithmetic and optional FX normalization (USD/INR/AED/SAR/EUR/GBP).",
    approval: "Conflicts remain highlighted until a partner reviews both sources and records a disposition.",
    guardrail: "100% pure TypeScript arithmetic verified by automated boundary tests (9.9% vs 10.0% vs 10.1%, zero-burn safety).",
    status: "Live · Deterministic Code",
    statusNote: "Zero AI hallucination risk; identical inputs always yield identical flags.",
    href: "/method",
  },
  {
    id: "conviction_engine",
    name: "5-Pillar Conviction Matrix (Grade A to G)",
    job: "Scores every deal from 0 to 100 across Disclosure, Financial Veracity, Founder Signal, Unit Economics, and Mandate Fit.",
    reads: ["10 Core Facts", "Conflict Flags", "Founder Pedigree", "Burn & Runway", "Ownership"],
    suggests: "Grade A-G rating, Completeness Multiplier discount, active penalty audit, and next recommended IC step.",
    approval: "Partners log independent IC votes (1-5 rating) and can overrule automated bands with a mandatory reason.",
    guardrail: "Hard completeness clamp: incomplete decks with 6+ missing core facts or non-deck files are capped at Grade G (5-15/100).",
    status: "Live · Deterministic Code",
    statusNote: "Powers Pipeline Kanban, Pitches grid, Compare rankings, and IC Memo PDFs.",
    href: "/method",
  },
  {
    id: "memo_captable",
    name: "IC Memo PDF & Cap Table Modeler",
    job: "Compiles publication-grade Investment Committee memos and models Post/Pre-Money SAFE and Priced Equity dilution.",
    reads: ["5-Pillar Matrix", "Evidence Conflicts", "Rubric Scores", "Round Terms"],
    suggests: "Printable IC Diligence Pack with signature blocks, ownership schedules, option pool carve-outs, and Series A pro-rata reserves.",
    approval: "Lead Partner and Managing Partner review and sign off before promoting the deal to Portfolio.",
    guardrail: "Deterministic cap table math guaranteed finite (zero NaN/Infinity) with clipboard schedule export.",
    status: "Live · Deterministic Code",
    statusNote: "One-click Export IC Memo PDF and Mark Invested promotion live on every deal.",
    href: "/deals",
  },
  {
    id: "portfolio_radar",
    name: "Portfolio MIS Monitor & Runway Radar",
    job: "Tracks post-investment monthly reporting compliance, cash runway alerts, and real-time Fund I capital pacing.",
    reads: ["Monthly MIS CSV", "Pitch Plan", "Investment Terms", "Fund Parameters"],
    suggests: "Runway Radar badges (<9 mo warning, <6 mo critical), reporting SLA health, and LP Analytics (TVPI, Dry Powder, NAV).",
    approval: "Partners acknowledge monthly MIS uploads, trigger founder reminders, and export quarterly LP Pack PDFs.",
    guardrail: "Direct CSV ingestion refreshes charts, runway, and Fund Analytics live without mutating prior historical months.",
    status: "Live · Deterministic Code",
    statusNote: "Backed by automated weekly digest checks (/api/cron/portfolio-digest).",
    href: "/portfolio",
  },
  {
    id: "market_research",
    name: "Live Market & Competitor Researcher",
    job: "Searches the open web for unnamed rivals, bottom-up market sizing, and public risk signals.",
    reads: ["Company Website", "Sector Thesis", "Live Web Search", "HN & Registry Links"],
    suggests: "Competitor comparison table flagging rivals omitted from the deck, bottom-up TAM math, and linked public sources.",
    approval: "Read-only research pack attached to the Market tab for partner verification.",
    guardrail: "Every external claim must include a clickable URL citation; runs live domain SSL probes with SSRF protection.",
    status: "Live · Needs API Key",
    statusNote: "Domain/HN/registry enrichment runs out of the box; full web TAM research activates with ANTHROPIC_API_KEY.",
    href: "/sectors",
  },
];

export const DEFINITIONS: { name: string; rule: string }[] = [
  { name: "Revenue a month", rule: "What the company invoiced or recognised in the month, as reported. GMV and bookings are never counted as revenue." },
  { name: "ARR", rule: "12 × the latest month's recurring revenue. Signed contracts that aren't live yet don't count." },
  { name: "Growth", rule: "Average month-on-month growth, compounded over the last three months." },
  { name: "Net burn", rule: "Cash out minus cash in for the month, as reported." },
  { name: "Runway", rule: "Cash in bank ÷ the latest month's net burn." },
  { name: "Burn multiple", rule: "Net burn over three months ÷ the new annual revenue added in them. Under 1× is efficient; over 2× is worth asking about." },
  { name: "Currency", rule: "Each company reports in its own currency. Compare and FX-normalized checks convert at reference USD rates and display the original figure alongside." },
];

export interface LogEntry {
  date: string;
  actor: string; // "Screening agent", "Monitoring checks", a person
  company: string;
  href: string;
  text: string;
  kind: "agent" | "code" | "person";
}

const plural = (n: number, w: string) => `${n === 0 ? "no" : n} ${n === 1 ? w : `${w}s`}`;

/** A log of what each engine and person did, built from the records. Newest first. */
export function activityLog(deals: DealResult[], companies: PortfolioCompany[], questions: Question[], today: string): LogEntry[] {
  const log: LogEntry[] = [];
  for (const d of deals) {
    const facts = Object.values(d.record.traction).filter((f) => f && typeof f === "object" && "page" in f && f.page != null).length;
    log.push({
      date: d.processedAt.slice(0, 10),
      actor: "Extraction engine",
      company: d.form.companyName,
      href: `/deals/${d.id}`,
      text: `Parsed ${d.deck.fileName} into a structured record with ${facts} cited traction fact${facts === 1 ? "" : "s"}.`,
      kind: "agent",
    });
    log.push({
      date: d.processedAt.slice(0, 10),
      actor: "Math & rules engine",
      company: d.form.companyName,
      href: `/deals/${d.id}`,
      text: `Cross-checked deck against intake form, sheet, and registry: ${plural(d.flags.filter((f) => f.kind === "conflict").length, "conflict")}. Band assigned: ${d.band}.`,
      kind: "code",
    });
  }
  for (const c of companies) {
    const flags = portfolioFlags(c, today);
    for (const r of c.reports) {
      if (!r.receivedAt || r.receivedAt.slice(0, 10) > today) continue;
      const got = METRICS.filter((m) => r.numbers[m.key]).length;
      const mine = flags.filter((f) => f.month === r.month);
      log.push({
        date: r.receivedAt.slice(0, 10),
        actor: "Portfolio monitor",
        company: c.name,
        href: `/portfolio/${c.id}?tab=numbers`,
        text: `${fmtMonth(r.month)} MIS: ${got} of 4 metrics${r.fileName ? " + file attached" : ""}. ${mine.length ? `Flagged: ${mine.map((f) => f.title.replace(": the form and the MIS disagree", ", form vs MIS variance")).join("; ")}.` : "All checks clear."}`,
        kind: "code",
      });
      if (r.acknowledgedAt && r.acknowledgedAt <= today)
        log.push({ date: r.acknowledgedAt, actor: c.owner, company: c.name, href: `/portfolio/${c.id}?tab=reporting`, text: `Reviewed and acknowledged the ${fmtMonth(r.month)} MIS report.`, kind: "person" });
    }
  }
  for (const q of questions) {
    log.push({
      date: q.askedAt,
      actor: q.askedBy,
      company: q.companyName,
      href: q.side === "deal" ? `/deals/${q.companyId}` : `/portfolio/${q.companyId}`,
      text: `Asked ${q.owner.split(" ")[0]}${q.about ? ` about ${q.about.label.toLowerCase()}` : ""}: "${q.text}"`,
      kind: "person",
    });
    if (q.answer)
      log.push({
        date: q.answer.at,
        actor: q.answer.by,
        company: q.companyName,
        href: q.side === "deal" ? `/deals/${q.companyId}` : `/portfolio/${q.companyId}`,
        text: `Answered, citing ${q.answer.source}.`,
        kind: "person",
      });
  }
  return log.filter((e) => e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
}
