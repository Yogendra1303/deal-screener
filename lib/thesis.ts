// The fund's written investment thesis beyond the hard filters: fund vehicle basics, stage playbooks,
// quantitative quality guardrails, hard exclusions, IC governance workflow, and portfolio covenants.
// Persisted to shared workspace state (ds.thesis.v1) and synchronized with Fund Analytics (ds.fund.config.v1).

export interface StageBar {
  stage: "Pre-seed" | "Seed" | "Series A";
  cheque: string;
  ownership: string;
  maxPostMoney: string;
  revenue: string;
  growth: string;
  convictionFloor?: string;
  other: string;
}

export interface QualityBar {
  label: string;
  value: string;
  why: string;
  category?: "Unit Economics" | "Capital Efficiency" | "Risk & Ownership";
  enforcedBy?: string;
}

export interface ProcessStep {
  step: string;
  days: string;
  who: string;
  output: string;
  gate?: string;
}

export interface PortfolioCovenant {
  label: string;
  value: string;
  party?: "Founder" | "Fund";
}

export interface Thesis {
  fundName?: string;
  fundSize: string;
  vintage: string;
  fundLife: string;
  investmentPeriod: string;
  companies: string;
  reserves: string;
  stageBars: StageBar[];
  quality: QualityBar[];
  exclusions: string[];
  process: ProcessStep[];
  beforeIC: string[];
  portfolio: PortfolioCovenant[];
}

export const DEFAULT_THESIS: Thesis = {
  fundName: "Aarka Fund I",
  fundSize: "$25M",
  vintage: "2025",
  fundLife: "10 years, plus two 1-year extensions",
  investmentPeriod: "4 years for new companies",
  companies: "25 to 30 companies",
  reserves: "40% held back for follow-on rounds",
  stageBars: [
    {
      stage: "Pre-seed",
      cheque: "$250K to $750K",
      ownership: "8% to 12%",
      maxPostMoney: "$8M",
      revenue: "Working product, design partners, or early pilots",
      growth: "Weekly active usage growing consistently",
      convictionFloor: "Grade C+ (60+) with verified founder pedigree",
      other: "Founders with earned domain insight and strong technical build speed",
    },
    {
      stage: "Seed",
      cheque: "$750K to $2M",
      ownership: "10% to 15%",
      maxPostMoney: "$20M",
      revenue: "$10K to $50K monthly recurring revenue",
      growth: "10% or higher month-on-month compounded",
      convictionFloor: "Grade B+ (75+) with CSV revenue corroboration",
      other: "Repeat paying customers with low churn and clean >10% math audit",
    },
    {
      stage: "Series A",
      cheque: "$2M to $5M",
      ownership: "10% to 15%",
      maxPostMoney: "$60M",
      revenue: "$1M+ annualized recurring revenue",
      growth: "2.5x to 3x year-on-year revenue expansion",
      convictionFloor: "Grade A- (85+) with full diligence pack",
      other: "Repeatable GTM motion, NRR above 100%, and institutional reporting cadence",
    },
  ],
  quality: [
    {
      label: "Gross margin",
      value: "60%+ (SaaS 70%+)",
      why: "Structurally low margins cap exit multiples and limit compounding capital efficiency.",
      category: "Unit Economics",
      enforcedBy: "Pillar 4 · Unit Economics",
    },
    {
      label: "Burn multiple",
      value: "2.0x or lower",
      why: "Measures net cash burned for each dollar of net new ARR added over the last 3 months.",
      category: "Capital Efficiency",
      enforcedBy: "Compare Matrix & Pillar 4",
    },
    {
      label: "Post-round runway",
      value: "18 months or more",
      why: "Ensures sufficient execution buffer to clear the next institutional milestone without bridge risk.",
      category: "Capital Efficiency",
      enforcedBy: "Evidence Matrix & Runway Radar",
    },
    {
      label: "Top 3 customer concentration",
      value: "40% of revenue or less",
      why: "Prevents single-account churn from threatening company survival or distorting growth trends.",
      category: "Risk & Ownership",
      enforcedBy: "Deal Diligence Checklist",
    },
    {
      label: "Founder ownership at Seed",
      value: "50% or more combined",
      why: "Preserves long-term founder alignment across Series A, B, and employee option pool refreshes.",
      category: "Risk & Ownership",
      enforcedBy: "Cap Table & SAFE Modeler",
    },
    {
      label: "Customer payback period",
      value: "18 months or less",
      why: "Faster CAC recovery reduces working capital drag and validates pricing power.",
      category: "Unit Economics",
      enforcedBy: "IC Diligence Review",
    },
  ],
  exclusions: [
    "Gambling, betting, and real-money wagering",
    "Tobacco, alcohol, and weapons manufacturing",
    "Adult content and exploitative media",
    "Unbacked crypto tokens and speculative coin sales",
    "Payday or predatory consumer lending",
    "Companies unable to meet local anti-bribery and data-protection law",
  ],
  process: [
    {
      step: "Screen & Audit",
      days: "Within 7 days",
      who: "Analyst + Aarka Engine",
      output: "Grade A-G matrix, >10% math audit & band",
      gate: "Deck passes 7-section structural check and mandate filter",
    },
    {
      step: "First Call",
      days: "Week 2",
      who: "Analyst and Partner",
      output: "Structured call notes; advance or pass with rationale",
      gate: "Missing facts requested via private Data Room link",
    },
    {
      step: "Partner Sync",
      days: "Week 3",
      who: "All Partners",
      output: "Formal sign-off to enter deep diligence",
      gate: "Lead Partner sponsorship and initial Conviction >= C+",
    },
    {
      step: "Deep Diligence",
      days: "3 to 4 weeks",
      who: "Analyst, Partner & Counsel",
      output: "Verified CSV tie-out, customer calls & registry check",
      gate: "Zero unresolved >10% math conflicts on revenue or cash",
    },
    {
      step: "Investment Committee",
      days: "Week 7 to 8",
      who: "IC Quorum (2+ Partners)",
      output: "Printable IC Memo PDF & logged Partner 1-5 votes",
      gate: "Unanimous or 2+ Partner approval with Cap Table modeled",
    },
    {
      step: "Term Sheet & Close",
      days: "4 to 6 weeks",
      who: "Lead Partner & Lawyers",
      output: "Executed SAFE/SHA, wire & Mark Invested promotion",
      gate: "Company promoted to Portfolio with monthly MIS schedule",
    },
  ],
  beforeIC: [
    "Every headline metric in the IC Memo is Checked against CSV/registry, or explicitly noted",
    "Zero unresolved >10% Conflict flags on revenue, cash balance, or round ask",
    "Full Cap Table, option pool schedule, and founder vesting terms verified",
    "Minimum 2 paying customer reference calls and 1 back-channel founder reference logged",
    "Entity registry, regulatory licences, and legal standing verified",
    "Conviction Matrix >= Grade B (or written Partner Override recorded in audit log)",
  ],
  portfolio: [
    { label: "Monthly MIS due date", value: "By the 15th of the following month", party: "Founder" },
    { label: "Required MIS payload", value: "MIS file plus monthly revenue, net burn, cash, and paying customers", party: "Founder" },
    { label: "Partner review SLA", value: "Read and acknowledged within 7 days of upload", party: "Fund" },
    { label: "Founder ask response SLA", value: "First reply within 48 hours; full resolution within 14 days", party: "Fund" },
    { label: "Runway Radar alert", value: "Warning below 9 months; critical escalation below 6 months", party: "Fund" },
    { label: "Governance & board seat", value: "Board seat when leading Series A; observer rights at Seed", party: "Founder" },
    { label: "Follow-on pro-rata policy", value: "Pro-rata exercised if On Track and priced within stage bars", party: "Fund" },
  ],
};
