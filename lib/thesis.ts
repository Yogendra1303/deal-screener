// The fund's written investment thesis beyond the hard filters: fund basics, what good looks like at
// each stage, valuation guardrails, exclusions, the decision process and portfolio rules.
// Sample values for a fictional early-stage fund. Hard filters (stage, country, sector, round size)
// live in FundRules and sort pitches; these are written guidance shown to the team.

export interface StageBar {
  stage: "Pre-seed" | "Seed" | "Series A";
  cheque: string;
  ownership: string;
  maxPostMoney: string;
  revenue: string;
  growth: string;
  other: string;
}

export interface Thesis {
  fundSize: string;
  vintage: string;
  fundLife: string;
  investmentPeriod: string;
  companies: string;
  reserves: string;
  stageBars: StageBar[];
  quality: { label: string; value: string; why: string }[];
  exclusions: string[];
  process: { step: string; days: string; who: string; output: string }[];
  beforeIC: string[];
  portfolio: { label: string; value: string }[];
}

export const DEFAULT_THESIS: Thesis = {
  fundSize: "$60M",
  vintage: "2025",
  fundLife: "10 years, plus two 1-year extensions",
  investmentPeriod: "4 years for new companies",
  companies: "25 to 30 companies",
  reserves: "50% of the fund held back for follow-on rounds",
  stageBars: [
    {
      stage: "Pre-seed",
      cheque: "$250K to $750K",
      ownership: "8% to 12%",
      maxPostMoney: "$8M",
      revenue: "None needed; a working product or pilots",
      growth: "Usage growing week on week",
      other: "Founders with deep knowledge of the problem",
    },
    {
      stage: "Seed",
      cheque: "$750K to $2M",
      ownership: "10% to 15%",
      maxPostMoney: "$20M",
      revenue: "About $10K to $50K a month, recurring",
      growth: "10% or more a month",
      other: "First paying customers who came back",
    },
    {
      stage: "Series A",
      cheque: "$2M to $5M",
      ownership: "10% to 15%",
      maxPostMoney: "$60M",
      revenue: "About $1M a year or more",
      growth: "2.5 to 3 times a year",
      other: "Repeatable sales; net revenue retention over 100%",
    },
  ],
  quality: [
    { label: "Gross margin", value: "60% or more (software 70%+)", why: "Low margins cap what growth is worth" },
    { label: "Burn multiple", value: "2 or less", why: "Cash burned for each dollar of new yearly revenue" },
    { label: "Runway after our round", value: "18 months or more", why: "Time to reach the next milestone" },
    { label: "Top 3 customers", value: "40% of revenue or less", why: "Losing one shouldn't sink the company" },
    { label: "Founder ownership at seed", value: "50% or more together", why: "Founders need room for later rounds" },
    { label: "Customer payback", value: "18 months or less", why: "Faster payback means cheaper growth" },
  ],
  exclusions: [
    "Gambling and betting",
    "Tobacco, alcohol and weapons",
    "Adult content",
    "Crypto tokens and coin sales",
    "Payday or predatory lending",
    "Companies that can't meet local anti-bribery and data-protection law",
  ],
  process: [
    { step: "Screen", days: "Within 7 days", who: "Analyst", output: "Band with reasons, numbers checked" },
    { step: "First call", days: "Week 2", who: "Analyst and partner", output: "Call notes; go or pass" },
    { step: "Partner meeting", days: "Week 3", who: "All partners", output: "Agree to start diligence" },
    { step: "Diligence", days: "3 to 4 weeks", who: "Analyst, partner, lawyers", output: "Diligence checklist complete" },
    { step: "Investment committee", days: "Week 7 to 8", who: "2 partners must agree", output: "Investment memo and vote" },
    { step: "Term sheet and close", days: "4 to 6 weeks", who: "Partner and lawyers", output: "Signed documents, money sent" },
  ],
  beforeIC: [
    "Every number in the memo is Checked, or the memo says why not",
    "No open Conflict on revenue, cash or the round",
    "Cap table and founder vesting received",
    "At least 2 customer calls and 1 back-channel reference",
    "Registry, licences and legal cases checked",
  ],
  portfolio: [
    { label: "Monthly report due", value: "By the 15th of the next month" },
    { label: "Report contents", value: "MIS file, revenue, net burn, cash, paying customers" },
    { label: "Fund reads a report within", value: "7 days" },
    { label: "Founder asks answered within", value: "14 days, first reply in 48 hours" },
    { label: "Cash alert", value: "Under 9 months of runway" },
    { label: "Board seat", value: "When the fund leads a Series A" },
    { label: "Follow-on", value: "Pro-rata if On track and the round is priced fairly; a partner decides" },
  ],
};
