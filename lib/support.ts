// Shared Two-Way Founder Support Desk schema, downloadable working templates,
// interactive playbook guides, and Partner Office Hours presets.

export type SupportCategory =
  | "Hiring & Talent"
  | "Customer Intro"
  | "Investor / Bridge Intro"
  | "Pitch & Deck Feedback"
  | "Missing Deck Details"
  | "Pricing & GTM"
  | "Legal & Cap Table"
  | "Partner Perks & Credits"
  | "Office Hours";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  "Hiring & Talent",
  "Customer Intro",
  "Investor / Bridge Intro",
  "Pitch & Deck Feedback",
  "Missing Deck Details",
  "Pricing & GTM",
  "Legal & Cap Table",
  "Partner Perks & Credits",
  "Office Hours",
];

export type SupportTicketStatus = "Open" | "In Progress" | "Resolved";

export interface SupportMessage {
  id: string;
  senderRole: "founder" | "fund";
  senderName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  companyId: string;
  companyName: string;
  side: "pitch" | "portfolio";
  category: SupportCategory;
  direction: "founder_to_fund" | "fund_to_founder";
  subject: string;
  status: SupportTicketStatus;
  priority: "Normal" | "Urgent";
  owner: string;
  founderEmail?: string;
  replyUrl?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  outcome?: string;
  messages: SupportMessage[];
}

export interface OfficeHourBooking {
  id: string;
  companyId: string;
  companyName: string;
  side: "pitch" | "portfolio";
  partnerName: string;
  topic: string;
  slotLabel: string;
  notes?: string;
  status: "Scheduled" | "Completed";
  createdAt: string;
}

export interface SupportStoreData {
  tickets: SupportTicket[];
  bookings: OfficeHourBooking[];
}

export const SUPPORT_STATE_KEY = "ds.support.v1";

export const EMPTY_SUPPORT_STORE: SupportStoreData = {
  tickets: [],
  bookings: [],
};

export const OFFICE_HOUR_SLOTS: string[] = [
  "Thu · 10:30 AM IST · 30 min",
  "Thu · 04:00 PM IST · 30 min",
  "Fri · 11:00 AM IST · 30 min",
  "Tue · 03:30 PM IST · 30 min",
  "Wed · 05:00 PM IST · 30 min",
];

export interface ToolkitDetail {
  id: string;
  actionLabel: string;
  downloadName?: string;
  downloadMime?: string;
  buildDownload?: () => string;
  checklist: string[];
  summary: string;
}

export function buildMisCsvTemplate(): string {
  return [
    "month,revenue,net_burn,cash_in_bank,customers,headcount",
    "2026-07,42000,28000,620000,34,11",
    "2026-08,46500,27500,592500,38,12",
    "2026-09,52000,26000,566500,43,12",
    "2026-10,58000,25500,541000,49,13",
  ].join("\n");
}

export function buildBoardDeckMarkdown(): string {
  return [
    "# Aarka Quarterly Board Deck Outline (12 Slides)",
    "",
    "1. **Executive Summary**: Top 3 wins, top 3 risks, and 2 specific asks for the board.",
    "2. **Headline KPI Dashboard**: MRR/ARR, MoM Growth, Net Burn, Cash Balance, Runway, Headcount.",
    "3. **Revenue vs. Plan Bridge**: Budget vs. Actual variance (flag any delta >10%).",
    "4. **Cohort Retention & Churn**: Logo retention, net dollar retention (NRR), top 3 customer concentration.",
    "5. **Sales Pipeline & GTM**: Qualified pipeline coverage, win rate, sales cycle, CAC payback.",
    "6. **Product Roadmap & Shipping Velocity**: Delivered milestones vs. next quarter priorities.",
    "7. **Hiring Plan & Org Health**: Open critical roles, key hires closed, attrition.",
    "8. **Unit Economics Deep Dive**: Gross margin trend, burn multiple, contribution margin.",
    "9. **Cash & Runway Scenarios**: Base, upside, and downside runway models.",
    "10. **Competitive & Market Shifts**: Key wins/losses against rivals and pricing feedback.",
    "11. **Next Fundraise Readiness**: Target milestone checklist, data room status, lead investor list.",
    "12. **Board Decisions & Approvals**: ESOP grants, budget sign-offs, and strategic asks.",
  ].join("\n");
}

export function buildInvestorUpdateMarkdown(): string {
  return [
    "# Monthly Investor Update Template (5 Numbers + 4 Lines)",
    "",
    "## Five Core Numbers (Due by 15th)",
    "- **Monthly Recognized Revenue (not GMV)**: $",
    "- **Net Cash Burn (Cash Out minus Cash In)**: $",
    "- **Cash in Bank (Month-End)**: $",
    "- **Paying Customers**: #",
    "- **Customers Churned**: #",
    "",
    "## Four Lines in Words",
    "1. **Highlights**: Biggest product, revenue, or team win this month.",
    "2. **Lowlights**: What missed target and the exact fix underway.",
    "3. **Customers Won & Lost**: Key logos added, churn reasons, and pricing signals.",
    "4. **How Aarka Can Help This Month**: One specific ask (Hiring, Customer Intro, Investor Intro, or Advice).",
  ].join("\n");
}

export function buildCashPlanCsv(): string {
  return [
    "scenario,monthly_revenue,monthly_burn,cash_in_bank,runway_months,decision_trigger",
    "Base Case,50000,45000,405000,9.0,Hold hiring and monitor collection cycle",
    "Cost Cut Case,50000,30000,405000,13.5,Freeze non-core spend to extend past 12 months",
    "Bridge + Growth Case,65000,48000,905000,18.9,Close $500K insider bridge and scale top channel",
  ].join("\n");
}

export const TOOLKIT_DETAILS: Record<string, ToolkitDetail> = {
  "mis-template": {
    id: "mis-template",
    actionLabel: "Download MIS CSV",
    downloadName: "aarka-monthly-mis-template.csv",
    downloadMime: "text/csv;charset=utf-8",
    buildDownload: buildMisCsvTemplate,
    summary:
      "Standard CSV columns mapped 1-to-1 with Aarka's Deal CSV re-scorer and Portfolio MIS dropzone. Upload directly to refresh runway and >10% math checks.",
    checklist: [
      "Use YYYY-MM format for the month column (e.g. 2026-10).",
      "Enter recognized monthly revenue, never annualized bookings or GMV.",
      "Keep all currency values in whole units matching your reporting currency.",
      "Upload directly on /portfolio/[id] or your private Founder Data Room.",
    ],
  },
  "board-template": {
    id: "board-template",
    actionLabel: "Download Outline (.md)",
    downloadName: "aarka-quarterly-board-deck-outline.md",
    downloadMime: "text/markdown;charset=utf-8",
    buildDownload: buildBoardDeckMarkdown,
    summary: "12-slide institutional board deck sequence designed to keep board meetings focused on decisions rather than status reads.",
    checklist: [
      "Distribute the deck 48 hours before the board call.",
      "Lead with Headline KPIs and Budget vs. Actual variance on Slides 2-3.",
      "End with 2 concrete asks for intros, hiring, or follow-on prep.",
    ],
  },
  "update-email": {
    id: "update-email",
    actionLabel: "Download Template (.md)",
    downloadName: "aarka-monthly-investor-update.md",
    downloadMime: "text/markdown;charset=utf-8",
    buildDownload: buildInvestorUpdateMarkdown,
    summary: "Short, structured monthly investor email built for 5-minute founder completion and rapid partner response.",
    checklist: [
      "Send by the 15th of each month alongside the MIS CSV.",
      "Include one specific ask so investors can make warm intros within 48 hours.",
      "Highlight churn reasons candidly so the fund can help troubleshoot GTM.",
    ],
  },
  "first-contract": {
    id: "first-contract",
    actionLabel: "Open Playbook",
    summary: "Key commercial clauses to negotiate on your first annual enterprise MSA without stalling procurement.",
    checklist: [
      "Target annual upfront billing (or quarterly minimum) to protect working capital.",
      "Cap general liability at 12 months of fees paid; carve out willful misconduct only.",
      "Keep auto-renewal notices at 30-60 days with explicit annual CPI uplift (5-8%).",
      "Define SLA credits as sole remedy rather than termination for minor downtime.",
    ],
  },
  "pricing-multi": {
    id: "pricing-multi",
    actionLabel: "Open Playbook",
    summary: "Structuring multi-site B2B SaaS pricing (per-location platform fee vs. usage tiers) to expand NRR above 110%.",
    checklist: [
      "Separate base platform fee (predictable ARR) from location/seat expansion tiers.",
      "Require a paid 60-90 day pilot with pre-agreed conversion pricing before rollout.",
      "Avoid unlimited-location flat fees that depress gross margin on large accounts.",
    ],
  },
  "series-a-room": {
    id: "series-a-room",
    actionLabel: "Open Checklist",
    summary: "Everything institutional Series A investors verify first in your Data Room so diligence clears in 3 weeks.",
    checklist: [
      "18 to 24 months of clean monthly P&L / CSV matching deck revenue within 10%.",
      "Customer cohort retention sheet (logo and net dollar retention by start quarter).",
      "Fully diluted Cap Table including SAFE caps, ESOP pool, and founder vesting.",
      "Top 10 customer contracts, pipeline summary, and 3 prepped customer references.",
    ],
  },
  "cash-plan": {
    id: "cash-plan",
    actionLabel: "Download Scenario CSV",
    downloadName: "aarka-runway-scenarios.csv",
    downloadMime: "text/csv;charset=utf-8",
    buildDownload: buildCashPlanCsv,
    summary: "Three-scenario cash runway workbook triggered automatically when Runway Radar drops below 9 months.",
    checklist: [
      "Model Base, Cost-Cut, and Insider Bridge scenarios side by side.",
      "Lock a hard calendar trigger date when runway hits 9 months (never wait until 4 months).",
      "Shortlist 5 bridge/extension funds and share updated monthly CSV before outreach.",
    ],
  },
  "perk-cloud": {
    id: "perk-cloud",
    actionLabel: "Request Credits",
    summary: "Access startup cloud credits across AWS Activate, Google Cloud for Startups, and Vercel through Aarka's partner portal.",
    checklist: [
      "Available to all Aarka Fund I portfolio companies and active diligence finalists.",
      "Submit your company domain and AWS/GCP account ID via the Support Desk.",
      "Typical activation turnaround: 3 to 5 business days.",
    ],
  },
  "perk-legal": {
    id: "perk-legal",
    actionLabel: "Request Legal Intro",
    summary: "Preferred fixed-fee counsel review for SAFEs, priced equity term sheets, ESOP pools, and India/GCC incorporation.",
    checklist: [
      "Select your company and share your target closing timeline.",
      "Aarka routes a warm intro to vetted startup counsel within 48 hours.",
    ],
  },
  "hours-partner": {
    id: "hours-partner",
    actionLabel: "Schedule Slot",
    summary: "Dedicated 30-minute Partner working sessions on fundraising narrative, enterprise pricing, hiring leadership, or deck feedback.",
    checklist: [
      "Book directly for any Portfolio company or Pitch founder from the Office Hours tab.",
      "Share 2 bullet points of context 24 hours ahead so the full 30 minutes are spent solving.",
    ],
  },
  "hours-peer": {
    id: "hours-peer",
    actionLabel: "Reserve Peer Seat",
    summary: "Quarterly founder-led roundtable covering GCC & India enterprise GTM, hiring senior engineers, and cross-border scaling.",
    checklist: [
      "Chatham House Rule: founders share live playbooks, vendors, and buyer intros.",
      "Open to portfolio founders and shortlisted Seed/Series A teams.",
    ],
  },
};

export function triggerTextDownload(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
