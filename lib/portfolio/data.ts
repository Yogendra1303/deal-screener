// Fictional portfolio for the prototype. Every company, person and number here is made up.
// Months run up to the demo date in health.ts (29 Oct 2026).
import { dueDateFor } from "./health";
import type { MonthlyReport, PortfolioCompany, Resource } from "./types";

// Where each number sits in a sample MIS file.
const PAGE = { revenue: 2, burn: 3, cash: 3, customers: 4 };

type Nums = [revenue: number, burn: number, cash: number, customers: number | null];

/** One month's report. `received` null = not sent. Numbers in the reporting currency. */
function m(
  company: string,
  month: string,
  received: string | null,
  nums: Nums | null,
  acknowledged: string | null,
  extra: Partial<MonthlyReport> = {},
): MonthlyReport {
  const [revenue, burn, cash, customers] = nums ?? [];
  return {
    month,
    dueDate: dueDateFor(month),
    receivedAt: received,
    fileName: received ? `${company}-MIS-${month}.pdf` : undefined,
    pages: received ? 6 : undefined,
    numbers: nums
      ? {
          revenue: { value: revenue!, page: PAGE.revenue },
          burn: { value: burn!, page: PAGE.burn },
          cash: { value: cash!, page: PAGE.cash },
          ...(customers != null ? { customers: { value: customers, page: PAGE.customers } } : {}),
        }
      : {},
    acknowledgedAt: acknowledged,
    ...extra,
  };
}

export const PORTFOLIO: PortfolioCompany[] = [
  {
    id: "kitebay",
    name: "Kitebay",
    oneLiner: "Shipping and returns software for direct-to-consumer brands.",
    sector: "Logistics software",
    country: "India",
    currency: "INR",
    website: "kitebay.example",
    founders: [
      { name: "Neha Kulkarni", role: "CEO" },
      { name: "Farhan Ali", role: "CTO" },
    ],
    owner: "Riya Menon",
    partner: "Kabir Shah",
    investment: { date: "2026-01-20", round: "Seed", amountUsd: 1_500_000, ownershipPct: 9.5 },
    pitch: {
      receivedAt: "2025-11-04",
      deckFile: "Kitebay-pitch-deck.pdf",
      band: "Priority",
      meetingAt: "2025-11-18",
      claims: {
        revenue: { value: 1_800_000, page: 4 },
        customers: { value: 64, page: 5 },
        burn: { value: 2_200_000, page: 9 },
        cash: { value: 11_000_000, page: 9 },
      },
      plan: { month: "2026-09", revenue: 4_000_000, page: 11 },
    },
    reports: [
      m("Kitebay", "2026-02", "2026-03-10", [2_100_000, 2_600_000, 121_000_000, 70], "2026-03-11"),
      m("Kitebay", "2026-03", "2026-04-09", [2_350_000, 2_700_000, 118_500_000, 76], "2026-04-10"),
      m("Kitebay", "2026-04", "2026-05-12", [2_600_000, 2_900_000, 115_800_000, 81], "2026-05-13"),
      m("Kitebay", "2026-05", "2026-06-11", [2_900_000, 3_000_000, 112_900_000, 88], "2026-06-12"),
      m("Kitebay", "2026-06", "2026-07-10", [3_200_000, 3_100_000, 109_800_000, 95], "2026-07-13"),
      m("Kitebay", "2026-07", "2026-08-12", [3_500_000, 3_200_000, 106_700_000, 101], "2026-08-13"),
      m("Kitebay", "2026-08", "2026-09-11", [3_800_000, 3_300_000, 103_400_000, 108], "2026-09-14"),
      m("Kitebay", "2026-09", "2026-10-09", [4_150_000, 3_400_000, 100_000_000, 116], "2026-10-10"),
    ],
    requests: [
      { id: "q2-board", title: "Q2 board deck", kind: "Board deck", askedAt: "2026-07-01", dueDate: "2026-07-20", receivedAt: "2026-07-18", fileName: "Kitebay-board-Q2-2026.pdf", pages: 14 },
    ],
    asks: [
      {
        id: "kitebay-1",
        openedAt: "2026-08-02",
        topic: "Intro to a customer",
        text: "Looking for the operations head at a large fashion brand to pilot our returns module.",
        answeredAt: "2026-08-06",
        outcome: "Intro made. Pilot call held on 12 Aug.",
      },
    ],
    notes: [
      { date: "2026-06-15", author: "Riya Menon", text: "Steady month. Customer growth is coming mostly from referrals." },
      { date: "2026-09-20", author: "Kabir Shah", text: "The returns module is pulling revenue ahead of plan. Next month, ask about gross margin on it." },
    ],
  },
  {
    id: "mandiwise",
    name: "Mandiwise",
    oneLiner: "Marketplace linking farmer groups with restaurant chains for fresh produce.",
    sector: "Agri marketplace",
    country: "India",
    currency: "INR",
    website: "mandiwise.example",
    founders: [
      { name: "Suresh Patil", role: "CEO" },
      { name: "Kavya Iyer", role: "COO" },
    ],
    owner: "Arjun Bhat",
    partner: "Kabir Shah",
    investment: { date: "2025-12-10", round: "Seed", amountUsd: 2_000_000, ownershipPct: 11 },
    pitch: {
      receivedAt: "2025-09-15",
      deckFile: "Mandiwise-pitch-deck.pdf",
      band: "Priority",
      meetingAt: "2025-10-01",
      claims: {
        revenue: { value: 5_500_000, page: 3 },
        customers: { value: 140, page: 4 },
        burn: { value: 3_500_000, page: 8 },
        cash: { value: 24_000_000, page: 8 },
      },
      plan: { month: "2026-09", revenue: 11_000_000, page: 10 },
    },
    reports: [
      m("Mandiwise", "2026-01", "2026-02-12", [5_800_000, 3_800_000, 175_000_000, 150], "2026-02-13"),
      m("Mandiwise", "2026-02", "2026-03-13", [6_100_000, 3_900_000, 171_000_000, 156], "2026-03-16"),
      m("Mandiwise", "2026-03", "2026-04-14", [6_500_000, 4_200_000, 166_500_000, 161], "2026-04-15"),
      m("Mandiwise", "2026-04", "2026-05-13", [6_900_000, 4_400_000, 162_000_000, 168], "2026-05-14"),
      m("Mandiwise", "2026-05", "2026-06-15", [7_200_000, 4_600_000, 157_200_000, 172], "2026-06-17"),
      m("Mandiwise", "2026-06", "2026-07-14", [7_000_000, 5_200_000, 151_800_000, 170], "2026-07-15"),
      m("Mandiwise", "2026-07", "2026-08-14", [7_300_000, 5_600_000, 146_000_000, 174], "2026-08-18"),
      m("Mandiwise", "2026-08", "2026-10-03", [7_100_000, 6_100_000, 139_800_000, 171], "2026-10-04", {
        reminders: ["2026-09-22"],
        question: {
          askedAt: "2026-10-04",
          text: "Burn rose 9% while revenue fell. What changed in August?",
          answeredAt: "2026-10-08",
          answer: "Two new cold-storage hubs opened. Their costs land before the extra volume does.",
        },
      }),
      m("Mandiwise", "2026-09", "2026-10-20", [7_400_000, 6_300_000, 133_400_000, null], "2026-10-21"),
    ],
    requests: [
      { id: "q2-board", title: "Q2 board deck", kind: "Board deck", askedAt: "2026-07-01", dueDate: "2026-07-20", receivedAt: "2026-07-25", fileName: "Mandiwise-board-Q2-2026.pdf", pages: 16 },
      { id: "fy26-audit", title: "Audited FY26 financials", kind: "Financials", askedAt: "2026-07-15", dueDate: "2026-09-30", receivedAt: null, reminders: ["2026-10-07"] },
    ],
    asks: [
      {
        id: "mandiwise-1",
        openedAt: "2026-10-22",
        topic: "Intro to an investor",
        text: "We need an equipment lender for cold storage. Is there a lender in the fund's network we could speak to?",
        answeredAt: null,
      },
    ],
    notes: [
      { date: "2026-08-25", author: "Arjun Bhat", text: "Monsoon months are slow for produce, so the June dip is expected. Watch burn from the new hubs." },
    ],
  },
  {
    id: "sehatflow",
    name: "Sehatflow",
    oneLiner: "Booking and billing software for clinics in the Gulf.",
    sector: "Health software",
    country: "UAE",
    currency: "AED",
    website: "sehatflow.example",
    founders: [
      { name: "Omar Haddad", role: "CEO" },
      { name: "Leena Thomas", role: "CTO" },
    ],
    owner: "Riya Menon",
    partner: "Kabir Shah",
    investment: { date: "2025-11-05", round: "Pre-seed", amountUsd: 500_000, ownershipPct: 6 },
    pitch: {
      receivedAt: "2025-08-20",
      deckFile: "Sehatflow-pitch-deck.pdf",
      band: "Review",
      meetingAt: "2025-09-08",
      claims: {
        revenue: { value: 95_000, page: 4 },
        customers: { value: 42, page: 5 },
        burn: { value: 160_000, page: 9 },
        cash: { value: 1_900_000, page: 9 },
      },
      plan: { month: "2026-09", revenue: 260_000, page: 12 },
    },
    reports: [
      m("Sehatflow", "2025-12", "2026-01-14", [102_000, 210_000, 3_540_000, 45], "2026-01-15"),
      m("Sehatflow", "2026-01", "2026-02-12", [108_000, 230_000, 3_310_000, 47], "2026-02-16"),
      m("Sehatflow", "2026-02", "2026-03-15", [111_000, 240_000, 3_070_000, 48], "2026-03-19"),
      m("Sehatflow", "2026-03", "2026-04-20", [115_000, 255_000, 2_815_000, 49], "2026-04-27"),
      m("Sehatflow", "2026-04", "2026-05-27", [117_000, 270_000, 2_545_000, 50], "2026-06-08", { reminders: ["2026-05-20"] }),
      m("Sehatflow", "2026-05", "2026-06-24", [113_000, 280_000, 2_265_000, 48], "2026-07-06", { reminders: ["2026-06-20"] }),
      m("Sehatflow", "2026-06", "2026-07-29", [110_000, 290_000, 1_975_000, 47], "2026-08-14", { reminders: ["2026-07-22"] }),
      m("Sehatflow", "2026-07", "2026-08-21", [104_000, 300_000, 1_675_000, null], null),
      m("Sehatflow", "2026-08", null, null, null, { reminders: ["2026-09-22", "2026-10-06"] }),
      m("Sehatflow", "2026-09", null, null, null, { reminders: ["2026-10-20"] }),
    ],
    requests: [
      { id: "q2-board", title: "Q2 board deck", kind: "Board deck", askedAt: "2026-07-01", dueDate: "2026-07-20", receivedAt: null, reminders: ["2026-07-28", "2026-08-20"] },
    ],
    asks: [
      {
        id: "sehatflow-1",
        openedAt: "2026-09-30",
        topic: "Advice",
        text: "How should we price for clinic groups with five or more branches?",
        answeredAt: null,
      },
    ],
    notes: [{ date: "2026-05-10", author: "Riya Menon", text: "Clinic growth has flattened. Suggested a call on pricing." }],
  },
  {
    id: "brightcart",
    name: "Brightcart",
    oneLiner: "Shelf and sales analytics for consumer brands selling through supermarkets.",
    sector: "Retail analytics",
    country: "India",
    currency: "INR",
    website: "brightcart.example",
    founders: [
      { name: "Ishaan Mehta", role: "CEO" },
      { name: "Tanvi Rao", role: "CPO" },
    ],
    owner: "Arjun Bhat",
    partner: "Kabir Shah",
    investment: { date: "2026-02-25", round: "Pre-seed", amountUsd: 750_000, ownershipPct: 7 },
    pitch: {
      receivedAt: "2025-12-09",
      deckFile: "Brightcart-pitch-deck.pdf",
      band: "Priority",
      meetingAt: "2025-12-22",
      claims: {
        revenue: { value: 600_000, page: 4 },
        customers: { value: 9, page: 5 },
        burn: { value: 1_200_000, page: 8 },
        cash: { value: 4_000_000, page: 8 },
      },
      plan: { month: "2026-09", revenue: 1_500_000, page: 10 },
    },
    reports: [
      m("Brightcart", "2026-03", "2026-04-08", [650_000, 1_400_000, 66_000_000, 10], "2026-04-21"),
      m("Brightcart", "2026-04", "2026-05-07", [720_000, 1_500_000, 64_500_000, 11], "2026-05-22"),
      m("Brightcart", "2026-05", "2026-06-09", [810_000, 1_550_000, 62_950_000, 13], "2026-06-19"),
      m("Brightcart", "2026-06", "2026-07-08", [900_000, 1_600_000, 61_350_000, 14], "2026-07-24"),
      m("Brightcart", "2026-07", "2026-08-07", [1_020_000, 1_650_000, 59_700_000, 16], "2026-08-18"),
      m("Brightcart", "2026-08", "2026-09-08", [1_150_000, 1_700_000, 58_000_000, 18], "2026-09-25"),
      m("Brightcart", "2026-09", "2026-10-07", [1_420_000, 1_750_000, 56_250_000, 21], null),
    ],
    requests: [
      { id: "cap-table", title: "Cap table after the round", kind: "Cap table", askedAt: "2026-03-01", dueDate: "2026-03-20", receivedAt: "2026-03-12", fileName: "Brightcart-cap-table.pdf", pages: 2 },
    ],
    asks: [
      {
        id: "brightcart-1",
        openedAt: "2026-10-01",
        topic: "Template or playbook",
        text: "Do you have a template for a first annual contract with a large consumer brand?",
        answeredAt: null,
      },
    ],
    notes: [{ date: "2026-09-10", author: "Arjun Bhat", text: "Two new brands signed. Reports always arrive on time." }],
  },
  {
    id: "voltnest",
    name: "Voltnest",
    oneLiner: "Charging-station management software for electric vehicle fleets.",
    sector: "Mobility software",
    country: "India",
    currency: "INR",
    website: "voltnest.example",
    founders: [
      { name: "Aditya Sen", role: "CEO" },
      { name: "Meera Pillai", role: "CTO" },
    ],
    owner: "Riya Menon",
    partner: "Kabir Shah",
    investment: { date: "2025-10-15", round: "Seed", amountUsd: 2_500_000, ownershipPct: 12 },
    pitch: {
      receivedAt: "2025-07-10",
      deckFile: "Voltnest-pitch-deck.pdf",
      band: "Priority",
      meetingAt: "2025-07-24",
      claims: {
        revenue: { value: 3_000_000, page: 4 },
        customers: { value: 18, page: 5 },
        burn: { value: 4_000_000, page: 9 },
        cash: { value: 30_000_000, page: 9 },
      },
      plan: { month: "2026-09", revenue: 7_500_000, page: 11 },
    },
    reports: [
      m("Voltnest", "2025-11", "2025-12-10", [3_300_000, 4_300_000, 205_000_000, 19], "2025-12-11"),
      m("Voltnest", "2025-12", "2026-01-12", [3_500_000, 4_500_000, 199_500_000, 20], "2026-01-13"),
      m("Voltnest", "2026-01", "2026-02-10", [3_800_000, 4_700_000, 193_800_000, 22], "2026-02-11"),
      m("Voltnest", "2026-02", "2026-03-11", [4_000_000, 4_900_000, 188_100_000, 23], "2026-03-12"),
      m("Voltnest", "2026-03", "2026-04-09", [4_300_000, 5_000_000, 182_400_000, 25], "2026-04-10"),
      m("Voltnest", "2026-04", "2026-05-11", [4_600_000, 5_200_000, 177_200_000, 26], "2026-05-12"),
      m("Voltnest", "2026-05", "2026-06-10", [5_000_000, 5_300_000, 171_900_000, 28], "2026-06-11"),
      m("Voltnest", "2026-06", "2026-07-09", [5_300_000, 5_500_000, 166_400_000, 30], "2026-07-10"),
      m("Voltnest", "2026-07", "2026-08-12", [7_200_000, 5_600_000, 160_800_000, 33], "2026-08-13", {
        question: {
          askedAt: "2026-08-13",
          text: "Revenue jumped 36% in July. Is the new fleet contract recurring?",
          answeredAt: "2026-08-16",
          answer: "Yes. It's a 24-month contract with a ride-hailing fleet, billed monthly.",
        },
      }),
      m("Voltnest", "2026-08", "2026-10-12", [7_000_000, 5_800_000, 155_000_000, 33], "2026-10-13", {
        excused: "Annual audit in August. On 2 Sep the founder told the fund August would come with September.",
      }),
      (() => {
        const r = m("Voltnest", "2026-09", "2026-10-12", [7_600_000, 5_900_000, 149_100_000, 35], "2026-10-13");
        r.numbers.revenue = { value: 7_600_000, page: PAGE.revenue, inFile: 6_900_000 };
        return r;
      })(),
    ],
    requests: [
      { id: "fy26-audit", title: "Audited FY26 financials", kind: "Financials", askedAt: "2026-07-15", dueDate: "2026-09-30", receivedAt: "2026-10-12", fileName: "Voltnest-FY26-audited.pdf", pages: 38 },
      { id: "q3-board", title: "Q3 board deck", kind: "Board deck", askedAt: "2026-10-01", dueDate: "2026-11-10", receivedAt: null },
    ],
    asks: [
      {
        id: "voltnest-1",
        openedAt: "2026-06-02",
        topic: "Intro to an investor",
        text: "We start Series A conversations in Q4. Who should we meet first?",
        answeredAt: "2026-06-09",
        outcome: "Intros to two funds. One first meeting held.",
      },
    ],
    notes: [
      { date: "2026-07-20", author: "Kabir Shah", text: "Fleet contracts are lumpy. Good to see revenue that renews monthly." },
      { date: "2026-10-14", author: "Riya Menon", text: "Audit done; August and September arrived together, as agreed." },
    ],
    nextRound: { round: "Series A", when: "Q4 2026", source: "Founder's ask on 2 Jun 2026" },
  },
  {
    id: "nestara",
    name: "Nestara",
    oneLiner: "Collections software for small lenders.",
    sector: "Fintech software",
    country: "Saudi Arabia",
    currency: "SAR",
    website: "nestara.example",
    founders: [
      { name: "Faisal Al-Harbi", role: "CEO" },
      { name: "Dana Yousef", role: "CTO" },
    ],
    owner: "Arjun Bhat",
    partner: "Kabir Shah",
    investment: { date: "2026-09-02", round: "Pre-seed", amountUsd: 600_000, ownershipPct: 6 },
    pitch: {
      receivedAt: "2026-06-18",
      deckFile: "Nestara-pitch-deck.pdf",
      band: "Priority",
      meetingAt: "2026-07-02",
      claims: {
        revenue: { value: 48_000, page: 4 },
        customers: { value: 7, page: 5 },
        burn: { value: 120_000, page: 8 },
        cash: { value: 600_000, page: 8 },
      },
      plan: { month: "2027-03", revenue: 150_000, page: 10 },
    },
    reports: [m("Nestara", "2026-09", "2026-10-13", [52_000, 130_000, 2_700_000, 8], "2026-10-14")],
    requests: [
      { id: "cap-table", title: "Cap table after the round", kind: "Cap table", askedAt: "2026-09-05", dueDate: "2026-09-30", receivedAt: "2026-09-29", fileName: "Nestara-cap-table.pdf", pages: 2 },
    ],
    asks: [],
    notes: [{ date: "2026-09-05", author: "Arjun Bhat", text: "Welcome aboard. The monthly report is due by the 15th: the MIS file plus four numbers." }],
  },
];

export function portfolioById(id: string): PortfolioCompany | undefined {
  return PORTFOLIO.find((c) => c.id === id);
}

export const RESOURCES: Resource[] = [
  { id: "mis-template", kind: "Template", title: "Monthly MIS template", format: "Spreadsheet", description: "The four numbers the fund asks for, always on the same pages, so reports can be read the same way every month." },
  { id: "board-template", kind: "Template", title: "Quarterly board deck", format: "Slides, 12 pages", description: "A board deck outline: numbers first, then what went wrong, then the asks." },
  { id: "update-email", kind: "Template", title: "Monthly investor update email", format: "Document", description: "A short update founders can send to all their investors at once: highlights, lowlights, asks." },
  { id: "first-contract", kind: "Playbook", title: "Your first annual enterprise contract", format: "Document", description: "Terms to watch: payment schedule, renewal, liability caps and data clauses." },
  { id: "pricing-multi", kind: "Playbook", title: "Pricing for customers with many locations", format: "Document", description: "Per-site vs per-seat vs platform fee, with worked examples." },
  { id: "series-a-room", kind: "Playbook", title: "Getting ready for a Series A", format: "Checklist", description: "What goes in the data room and which numbers investors will check first." },
  { id: "cash-plan", kind: "Playbook", title: "When runway drops under 12 months", format: "Spreadsheet", description: "A cash plan with three scenarios and the decisions each one triggers." },
  { id: "perk-cloud", kind: "Partner perk", title: "Cloud hosting credits (sample)", format: "Perk", description: "Sample entry. A real fund would list its actual partner offers here." },
  { id: "perk-legal", kind: "Partner perk", title: "Discounted legal review of term sheets (sample)", format: "Perk", description: "Sample entry. A real fund would list its actual partner offers here." },
  { id: "hours-partner", kind: "Office hours", title: "Partner office hours", format: "Every other Thursday, 30 minutes", description: "Book time with a partner on pricing, fundraising or a hard customer conversation." },
  { id: "hours-peer", kind: "Office hours", title: "Founder peer session: selling into the Gulf", format: "Quarterly, online", description: "Founders in the portfolio share what worked. The fund hosts; founders lead." },
];
