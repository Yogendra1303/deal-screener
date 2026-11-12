// Ten fictional companies used to test the screener. Every name, person and number here is made up.
// Mistakes are planted on purpose; `expected` is the answer key the Results page scores against.

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

/** Monthly rows that grow smoothly from start to end, with small deterministic wobble in between. */
function series(start, end, { round = 1, wobble = 0.012 } = {}) {
  const n = MONTHS.length - 1;
  const g = Math.pow(end / start, 1 / n);
  return MONTHS.map((_, i) => {
    if (i === 0) return start;
    if (i === n) return end;
    const v = start * Math.pow(g, i) * (1 + (i % 2 ? wobble : -wobble));
    return Math.round(v / round) * round;
  });
}

function sheet({ currency, revenue, customers, headcount, burn, cash, revRound }) {
  const rev = series(revenue[0], revenue[1], { round: revRound });
  const cust = series(customers[0], customers[1], { wobble: 0 }).map(Math.round);
  const head = series(headcount[0], headcount[1], { wobble: 0 }).map(Math.round);
  const cashCol = MONTHS.map((_, i) => cash + burn * (MONTHS.length - 1 - i));
  return MONTHS.map((month, i) => ({
    month,
    currency,
    revenue: rev[i],
    customers: cust[i],
    headcount: head[i],
    net_burn: burn,
    cash: cashCol[i],
  }));
}

export const companies = [
  {
    id: "ledgerly",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: null, arr: { amount: 75000000, currency: "INR" }, growth: 7, customers: 92, team: 24, burn: { amount: 5500000, currency: "INR" }, cash: { amount: 62000000, currency: "INR" }, runway: 11, round: 2000000, founded: 2022 },
    theme: "navy",
    receivedAt: "2026-10-26T09:12:00Z",
    form: {
      companyName: "Ledgerly",
      website: "ledgerly.example",
      country: "India",
      sector: "B2B software",
      stage: "Seed",
      amountUsd: 2000000,
      founders: [
        { name: "Ananya Rao", profileUrl: "https://profiles.example/ananya-rao" },
        { name: "Vikram Joshi", profileUrl: "https://profiles.example/vikram-joshi" },
      ],
      email: "ananya@ledgerly.example",
    },
    sheet: sheet({
      currency: "INR",
      revenue: [3420000, 4800000],
      customers: [64, 92],
      headcount: [21, 24],
      burn: 5500000,
      cash: 62000000,
      revRound: 10000,
    }),
    registry: {
      legalName: "Ledgerly Technologies Private Limited",
      incorporated: "2022-06-14",
      country: "India",
      status: "Active",
      directors: ["Ananya Rao", "Vikram Joshi"],
    },
    profiles: [
      {
        name: "Ananya Rao",
        headline: "Co-founder and CEO, Ledgerly",
        roles: [
          { company: "Ledgerly", title: "Co-founder and CEO", start: "2022-06", end: null },
          { company: "Kestrel Auto Components", title: "Finance Controller", start: "2015-04", end: "2022-05" },
          { company: "Mehra & Iyer LLP", title: "Senior Audit Associate", start: "2011-07", end: "2015-03" },
        ],
      },
      {
        name: "Vikram Joshi",
        headline: "Co-founder and CTO, Ledgerly",
        roles: [
          { company: "Ledgerly", title: "Co-founder and CTO", start: "2022-06", end: null },
          { company: "Brightpath Software", title: "Senior Software Engineer", start: "2016-07", end: "2022-03" },
        ],
      },
    ],
    expected: { issues: ["revenue_deck_vs_sheet"], band: "Priority" },
    planted: "Deck states annual revenue of ₹7.5 Cr; the sheet supports ₹5.76 Cr (30% higher in the deck).",
    slides: [
      {
        kind: "cover",
        title: "Ledgerly",
        tagline: "Accounts payable on autopilot for Indian manufacturers",
        meta: ["Seed round · October 2026", "Pune, India · Founded 2022", "ledgerly.example"],
      },
      {
        kind: "bullets",
        title: "The problem",
        lead: "Mid-size manufacturers process 2,000 to 10,000 supplier invoices a month, mostly by hand.",
        bullets: [
          "Three-way matching of purchase orders, receipts and invoices happens in Excel",
          "GST input credit is lost when supplier filings don't match the books",
          "Late payments cost penalties and supplier goodwill",
        ],
      },
      {
        kind: "bullets",
        title: "What Ledgerly does",
        lead: "One inbox for every supplier invoice, from capture to payment.",
        bullets: [
          "Reads invoices from email, WhatsApp and scans",
          "Matches each invoice to its purchase order and goods receipt",
          "Reconciles GST credit every month",
          "Prepares payment runs for approval; works with Tally and SAP Business One",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "₹7.5 Cr", label: "ARR, September 2026" },
          { value: "92", label: "paying manufacturers" },
          { value: "7%", label: "month-on-month growth" },
          { value: "118%", label: "net revenue retention" },
        ],
        chart: {
          title: "ARR, ₹ Cr",
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
          values: [5.4, 5.8, 6.3, 6.7, 7.1, 7.5],
          fmt: "₹{v} Cr",
        },
      },
      {
        kind: "bullets",
        title: "Business model",
        bullets: [
          "Monthly subscription priced by invoice volume: ₹25,000 to ₹1.5 lakh a month",
          "Gross margin 78%",
          "Sold by a direct sales team to CFOs; average sales cycle 6 weeks",
        ],
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "A $2.1B yearly opportunity in India alone.",
        bullets: [
          "48,000 mid-size manufacturers in India",
          "Average yearly spend on finance operations software: $44,000",
          "Next: Indonesia and Vietnam from 2028",
        ],
      },
      {
        kind: "table",
        title: "Competition",
        headers: ["", "Invoice capture", "3-way match", "GST reconciliation", "Built for India"],
        rows: [
          ["Ledgerly", "Yes", "Yes", "Yes", "Yes"],
          ["Generic OCR tools", "Yes", "No", "No", "Partly"],
          ["ERP add-on modules", "Partly", "Yes", "No", "Partly"],
          ["Global AP automation suites", "Yes", "Yes", "No", "No"],
        ],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Ananya Rao",
            role: "Co-founder and CEO",
            lines: ["Finance Controller, Kestrel Auto Components (2015–2022)", "Chartered accountant"],
          },
          {
            name: "Vikram Joshi",
            role: "Co-founder and CTO",
            lines: ["Senior Engineer, Brightpath Software (2016–2022)", "Built its invoicing platform"],
          },
        ],
        note: "Team of 24 across Pune and Bengaluru",
      },
      {
        kind: "round",
        title: "The round",
        ask: "Raising $2M Seed on a SAFE",
        items: ["45% product and AI", "35% sales in Maharashtra and Gujarat", "20% customer success"],
        stats: [
          { value: "₹6.2 Cr", label: "cash in bank" },
          { value: "₹55 L", label: "monthly burn" },
          { value: "11 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Ananya Rao, CEO", "ananya@ledgerly.example"] },
    ],
  },

  {
    id: "mandiflow",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 6200000, currency: "INR" }, arr: null, growth: 25, customers: 1200, team: 38, burn: { amount: 4500000, currency: "INR" }, cash: { amount: 59000000, currency: "INR" }, runway: 13, round: 5000000, founded: 2021 },
    theme: "cream",
    receivedAt: "2026-10-24T14:40:00Z",
    form: {
      companyName: "Mandiflow",
      website: "mandiflow.example",
      country: "India",
      sector: "Food supply",
      stage: "Series A",
      amountUsd: 5000000,
      founders: [
        { name: "Rahul Menon", profileUrl: "https://profiles.example/rahul-menon" },
        { name: "Sneha Kulkarni", profileUrl: "https://profiles.example/sneha-kulkarni" },
      ],
      email: "rahul@mandiflow.example",
    },
    sheet: sheet({
      currency: "INR",
      revenue: [4040000, 6200000],
      customers: [540, 760],
      headcount: [33, 37],
      burn: 4500000,
      cash: 59000000,
      revRound: 10000,
    }),
    registry: {
      legalName: "Mandiflow Agritech Private Limited",
      incorporated: "2021-03-09",
      country: "India",
      status: "Active",
      directors: ["Rahul Menon", "Sneha Kulkarni"],
    },
    profiles: [
      {
        name: "Rahul Menon",
        headline: "Co-founder and CEO, Mandiflow",
        roles: [
          { company: "Mandiflow", title: "Co-founder and CEO", start: "2021-03", end: null },
          { company: "FreshKart Retail", title: "Category Head, Fruits and Vegetables", start: "2016-02", end: "2021-01" },
        ],
      },
      {
        name: "Sneha Kulkarni",
        headline: "Co-founder and COO, Mandiflow",
        roles: [
          { company: "Mandiflow", title: "Co-founder and COO", start: "2021-03", end: null },
          { company: "Coastline Logistics", title: "Operations Manager", start: "2014-08", end: "2020-11" },
        ],
      },
    ],
    expected: { issues: ["growth_deck_vs_sheet", "customers_deck_vs_sheet"], band: "Review" },
    planted: "Deck claims 25% monthly growth and 1,200 restaurants; the sheet shows about 9% and 760.",
    slides: [
      {
        kind: "cover",
        title: "Mandiflow",
        tagline: "Fresh produce from farm clusters to restaurant kitchens, next morning",
        meta: ["Series A · 2026", "Bengaluru · Est. 2021"],
      },
      {
        kind: "bullets",
        title: "Restaurants buy produce the hard way",
        bullets: [
          "A chef or owner visits the wholesale mandi at 4 am, three times a week",
          "Prices change daily and quality is a gamble",
          "Wastage runs at 12 to 18% of what they buy",
        ],
      },
      {
        kind: "bullets",
        title: "Mandiflow",
        bullets: [
          "Order on WhatsApp or the app by 11 pm, delivered by 7 am",
          "Sourced directly from 140 farmer groups around Bengaluru and Mysuru",
          "Graded, cleaned and packed in our own two warehouses",
          "Credit terms for restaurants with good payment history",
        ],
      },
      {
        kind: "stats",
        title: "Growing fast",
        stats: [
          { value: "1,200", label: "restaurants served" },
          { value: "25%", label: "month-on-month growth for the last 6 months" },
          { value: "₹62 L", label: "monthly revenue, Sep 2026" },
          { value: "14%", label: "gross margin" },
        ],
        chart: {
          title: "Monthly revenue, ₹ lakh",
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
          values: [40, 44, 48, 52, 57, 62],
          fmt: "₹{v} L",
        },
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "India's restaurant produce spend is $9B a year (top-down industry estimate).",
        bullets: ["Bengaluru alone has 25,000 restaurants", "We plan Hyderabad and Chennai in 2027"],
      },
      {
        kind: "table",
        title: "How we compare",
        headers: ["", "Next-morning delivery", "Farm-direct", "Credit terms"],
        rows: [
          ["Mandiflow", "Yes", "Yes", "Yes"],
          ["Local wholesale mandi", "No", "No", "Sometimes"],
          ["Large B2B food marketplaces", "Yes", "Partly", "No"],
        ],
      },
      {
        kind: "team",
        title: "Founders",
        people: [
          {
            name: "Rahul Menon",
            role: "CEO",
            lines: ["Category Head, FreshKart Retail (2016–2021)", "Ran a ₹300 Cr fruits and vegetables category"],
          },
          {
            name: "Sneha Kulkarni",
            role: "COO",
            lines: ["Operations Manager, Coastline Logistics (2014–2020)", "Ran cold-chain operations for South India"],
          },
        ],
        note: "38 people across sourcing, warehouses and sales",
      },
      {
        kind: "round",
        title: "Raising $5M Series A",
        ask: "To open two new cities and a third warehouse",
        items: ["50% new cities", "30% warehouse and cold chain", "20% technology"],
        stats: [
          { value: "₹5.9 Cr", label: "cash" },
          { value: "₹45 L", label: "net burn per month" },
          { value: "13 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Let's talk", lines: ["Rahul Menon", "rahul@mandiflow.example"] },
    ],
  },

  {
    id: "remitwell",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 18000, currency: "USD" }, arr: null, growth: 7, customers: 21, team: 11, burn: { amount: 85000, currency: "USD" }, cash: { amount: 700000, currency: "USD" }, runway: 8, round: 2500000, founded: 2023 },
    theme: "navy",
    receivedAt: "2026-10-23T07:55:00Z",
    form: {
      companyName: "Remitwell",
      website: "remitwell.example",
      country: "UAE",
      sector: "Fintech",
      stage: "Seed",
      amountUsd: 2500000,
      founders: [
        { name: "Omar Haddad", profileUrl: "https://profiles.example/omar-haddad" },
        { name: "Maria Santos", profileUrl: "https://profiles.example/maria-santos" },
      ],
      email: "omar@remitwell.example",
    },
    sheet: sheet({
      currency: "USD",
      revenue: [12800, 18000],
      customers: [14, 21],
      headcount: [10, 11],
      burn: 85000,
      cash: 700000,
      revRound: 100,
    }),
    registry: {
      legalName: "Remitwell Technologies FZ-LLC",
      incorporated: "2023-02-08",
      country: "UAE",
      status: "Active",
      directors: ["Omar Haddad"],
    },
    profiles: [
      {
        name: "Omar Haddad",
        headline: "Founder, Remitwell",
        roles: [
          { company: "Remitwell", title: "Founder and CEO", start: "2023-02", end: null },
          { company: "Gulfstone Bank", title: "Senior Product Manager, Payments", start: "2019-03", end: "2022-06" },
          { company: "Fintrac Payments", title: "Product Analyst", start: "2016-01", end: "2019-02" },
        ],
      },
      {
        name: "Maria Santos",
        headline: "CTO, Remitwell",
        roles: [
          { company: "Remitwell", title: "Co-founder and CTO", start: "2023-04", end: null },
          { company: "Paylane", title: "Staff Engineer", start: "2017-05", end: "2023-01" },
        ],
      },
    ],
    expected: { issues: ["founder_vs_profile"], band: "Review" },
    planted: "CEO claims VP Product at Gulfstone Bank 2016–2022; the profile shows Senior Product Manager from 2019.",
    slides: [
      {
        kind: "cover",
        title: "Remitwell",
        tagline: "Payroll across borders for Gulf SMEs, paid the same day",
        meta: ["Seed · 2026", "Dubai, UAE · Founded 2023"],
      },
      {
        kind: "bullets",
        title: "The problem",
        bullets: [
          "Gulf SMEs pay staff and contractors in India, the Philippines and Pakistan every month",
          "Each payment is a separate bank transfer with fees of 2 to 4%",
          "Payslips, tax and compliance live in spreadsheets",
        ],
      },
      {
        kind: "bullets",
        title: "Our product",
        bullets: [
          "One payroll run pays everyone, in their local currency",
          "Exchange margin of 0.6%, shown before you pay",
          "Payslips and year-end statements generated automatically",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "$18K", label: "MRR, September 2026" },
          { value: "21", label: "business customers" },
          { value: "7%", label: "month-on-month revenue growth" },
          { value: "$2.4M", label: "payroll processed in September" },
        ],
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "$40B in yearly cross-border payroll from GCC employers (top-down estimate).",
        bullets: ["Starting with UAE SMEs of 20 to 200 staff", "Saudi Arabia in 2027"],
      },
      {
        kind: "table",
        title: "Competition",
        headers: ["", "Multi-country payroll", "Same-day", "SME pricing"],
        rows: [
          ["Remitwell", "Yes", "Yes", "Yes"],
          ["Bank transfers", "No", "Sometimes", "Yes"],
          ["Global employer-of-record platforms", "Yes", "No", "No"],
          ["Exchange houses", "No", "Yes", "Yes"],
        ],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Omar Haddad",
            role: "Founder and CEO",
            lines: ["VP Product, Gulfstone Bank (2016–2022)", "Led the bank's payments products"],
          },
          {
            name: "Maria Santos",
            role: "Co-founder and CTO",
            lines: ["Staff Engineer, Paylane (2017–2023)", "Built card and payout systems"],
          },
        ],
        note: "11 people in Dubai and Manila",
      },
      {
        kind: "round",
        title: "Raising $2.5M Seed",
        ask: "To get licensed in Saudi Arabia and grow sales",
        items: ["40% licensing and compliance", "40% sales", "20% product"],
        stats: [
          { value: "$700K", label: "cash" },
          { value: "$85K", label: "monthly burn" },
          { value: "8 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Omar Haddad", "omar@remitwell.example"] },
    ],
  },

  {
    id: "sunroof-grid",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 1800000, currency: "INR" }, arr: null, growth: 6, customers: 120, team: 45, burn: { amount: 3000000, currency: "INR" }, cash: { amount: 45000000, currency: "INR" }, runway: 15, round: 1800000, founded: 2019 },
    theme: "cream",
    receivedAt: "2026-10-22T11:20:00Z",
    form: {
      companyName: "Sunroof Grid",
      website: "sunroofgrid.example",
      country: "India",
      sector: "Climate",
      stage: "Seed",
      amountUsd: 1800000,
      founders: [
        { name: "Karan Patel", profileUrl: "https://profiles.example/karan-patel" },
        { name: "Divya Shah", profileUrl: "https://profiles.example/divya-shah" },
      ],
      email: "karan@sunroofgrid.example",
    },
    sheet: sheet({
      currency: "INR",
      revenue: [1345000, 1800000],
      customers: [96, 120],
      headcount: [15, 17],
      burn: 3000000,
      cash: 45000000,
      revRound: 5000,
    }),
    registry: {
      legalName: "Sunroof Grid Energy Private Limited",
      incorporated: "2024-01-22",
      country: "India",
      status: "Active",
      directors: ["Karan Patel", "Divya Shah"],
    },
    profiles: [
      {
        name: "Karan Patel",
        headline: "Co-founder, Sunroof Grid",
        roles: [
          { company: "Sunroof Grid", title: "Co-founder and CEO", start: "2024-01", end: null },
          { company: "Helios Power Systems", title: "Project Lead, Rooftop Solar", start: "2015-06", end: "2023-08" },
        ],
      },
      {
        name: "Divya Shah",
        headline: "Co-founder, Sunroof Grid",
        roles: [
          { company: "Sunroof Grid", title: "Co-founder and CFO", start: "2024-01", end: null },
          { company: "Greenbridge Capital", title: "Associate Director", start: "2017-09", end: "2023-10" },
        ],
      },
    ],
    expected: { issues: ["founded_vs_registry", "team_deck_vs_sheet"], band: "Review" },
    planted: "Deck says founded 2019 with a 45-person team; registry shows 2024 and the sheet shows 17 staff.",
    slides: [
      {
        kind: "cover",
        title: "Sunroof Grid",
        tagline: "Rooftop solar for housing societies, with no money down",
        meta: ["Seed round · 2026", "Ahmedabad, India"],
      },
      {
        kind: "bullets",
        title: "Why societies don't go solar",
        bullets: [
          "A 100 kW rooftop system costs ₹45 lakh up front",
          "Committees change every year and can't agree on a loan",
          "Nobody owns maintenance after installation",
        ],
      },
      {
        kind: "bullets",
        title: "Our model",
        bullets: [
          "We install, own and maintain the system",
          "The society pays a fixed monthly fee, 20% below its old common-area power bill",
          "Ownership passes to the society after 7 years",
        ],
      },
      {
        kind: "stats",
        title: "Where we are",
        stats: [
          { value: "Founded 2019", label: "7 years in rooftop solar" },
          { value: "120", label: "housing societies financed" },
          { value: "₹18 L", label: "monthly recurring revenue, Sep 2026" },
          { value: "6%", label: "monthly growth" },
        ],
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "India has 1.2 lakh large housing societies in its top 15 cities.",
        bullets: ["Each needs 50 to 200 kW of rooftop solar", "A ₹27,000 Cr financing opportunity"],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Karan Patel",
            role: "CEO",
            lines: ["Project Lead, Helios Power Systems (2015–2023)", "Delivered 400+ rooftop projects"],
          },
          {
            name: "Divya Shah",
            role: "CFO",
            lines: ["Associate Director, Greenbridge Capital (2017–2023)", "Structured clean energy debt"],
          },
        ],
        note: "A 45-member team of engineers, installers and sales",
      },
      {
        kind: "round",
        title: "The raise",
        ask: "$1.8M Seed equity, plus a debt line for systems",
        items: ["Equity: team, sales and software", "Debt: the solar systems themselves"],
        stats: [
          { value: "₹4.5 Cr", label: "cash" },
          { value: "₹30 L", label: "monthly burn" },
          { value: "15 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Contact", lines: ["Karan Patel", "karan@sunroofgrid.example"] },
    ],
  },

  {
    id: "rostrly",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 85000, currency: "USD" }, arr: { amount: 1400000, currency: "USD" }, growth: 5, customers: 46, team: 31, burn: { amount: 150000, currency: "USD" }, cash: { amount: 1200000, currency: "USD" }, runway: 18, round: 4000000, founded: 2022 },
    theme: "navy",
    receivedAt: "2026-10-21T08:05:00Z",
    form: {
      companyName: "Rostrly",
      website: "rostrly.example",
      country: "Saudi Arabia",
      sector: "B2B software",
      stage: "Series A",
      amountUsd: 4000000,
      founders: [
        { name: "Faisal Al-Harbi", profileUrl: "https://profiles.example/faisal-alharbi" },
        { name: "Lina Mansour", profileUrl: "https://profiles.example/lina-mansour" },
      ],
      email: "faisal@rostrly.example",
    },
    sheet: sheet({
      currency: "USD",
      revenue: [66600, 85000],
      customers: [36, 46],
      headcount: [28, 31],
      burn: 150000,
      cash: 1200000,
      revRound: 100,
    }),
    registry: {
      legalName: "Rostrly Information Technology Company",
      incorporated: "2022-05-10",
      country: "Saudi Arabia",
      status: "Active",
      directors: ["Faisal Al-Harbi", "Lina Mansour"],
    },
    profiles: [
      {
        name: "Faisal Al-Harbi",
        headline: "CEO, Rostrly",
        roles: [
          { company: "Rostrly", title: "Co-founder and CEO", start: "2022-05", end: null },
          { company: "Najd Hypermarkets", title: "Head of Retail Operations", start: "2014-09", end: "2022-02" },
        ],
      },
      {
        name: "Lina Mansour",
        headline: "CTO, Rostrly",
        roles: [
          { company: "Rostrly", title: "Co-founder and CTO", start: "2022-05", end: null },
          { company: "Cloudnest", title: "Engineering Manager", start: "2016-03", end: "2022-04" },
        ],
      },
    ],
    expected: { issues: ["arr_vs_mrr_maths", "runway_maths"], band: "Review" },
    planted: "MRR $85K but ARR stated as $1.4M; runway stated 18 months while $1.2M cash ÷ $150K burn is 8.",
    slides: [
      {
        kind: "cover",
        title: "Rostrly",
        tagline: "Shift scheduling that retail chains in the Gulf actually use",
        meta: ["Series A · 2026", "Riyadh · Founded 2022"],
      },
      {
        kind: "bullets",
        title: "The problem",
        bullets: [
          "Store managers spend 6 to 8 hours a week building rosters in spreadsheets",
          "Saudization quotas and labour rules change often",
          "Overtime and no-shows go unnoticed until payroll",
        ],
      },
      {
        kind: "bullets",
        title: "Product",
        bullets: [
          "Rosters built in minutes from forecasted footfall",
          "Labour rule and Saudization checks before a roster is published",
          "Mobile app for staff in Arabic, English, Hindi and Tagalog",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "$85K", label: "MRR (Sep 2026)" },
          { value: "$1.4M", label: "ARR" },
          { value: "46", label: "retail chains" },
          { value: "5%", label: "month-on-month growth" },
        ],
        chart: {
          title: "MRR, $ thousand",
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
          values: [66.6, 70, 73.4, 77.3, 81, 85],
          fmt: "${v}K",
        },
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "$1.1B yearly workforce software spend across GCC retail and hospitality.",
        bullets: ["14,000 chains with 10+ stores", "Average contract value today: $22,000 a year"],
      },
      {
        kind: "table",
        title: "Competition",
        headers: ["", "Saudization checks", "Arabic-first", "Retail forecasting"],
        rows: [
          ["Rostrly", "Yes", "Yes", "Yes"],
          ["Global workforce suites", "No", "No", "Yes"],
          ["Local HR software", "Yes", "Yes", "No"],
          ["Spreadsheets", "No", "Yes", "No"],
        ],
      },
      {
        kind: "team",
        title: "Founders",
        people: [
          {
            name: "Faisal Al-Harbi",
            role: "CEO",
            lines: ["Head of Retail Operations, Najd Hypermarkets (2014–2022)", "Ran 60 stores and 4,000 staff"],
          },
          {
            name: "Lina Mansour",
            role: "CTO",
            lines: ["Engineering Manager, Cloudnest (2016–2022)", "Led a team of 25 engineers"],
          },
        ],
        note: "31 people in Riyadh and Cairo",
      },
      {
        kind: "round",
        title: "Raising $4M Series A",
        ask: "To expand to the UAE and Qatar",
        items: ["50% sales and partnerships", "30% product", "20% customer success"],
        stats: [
          { value: "$1.2M", label: "cash" },
          { value: "$150K", label: "monthly burn" },
          { value: "18 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Faisal Al-Harbi", "faisal@rostrly.example"] },
    ],
  },

  {
    id: "loomhaus",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: null, arr: null, growth: null, customers: null, team: null, burn: null, cash: null, runway: null, round: 600000, founded: 2025 },
    theme: "cream",
    receivedAt: "2026-10-20T16:30:00Z",
    form: {
      companyName: "Loomhaus",
      website: "loomhaus.example",
      country: "India",
      sector: "Consumer brands",
      stage: "Pre-seed",
      amountUsd: 600000,
      founders: [
        { name: "Meera Singh", profileUrl: "https://profiles.example/meera-singh" },
        { name: "Arjun Rathore", profileUrl: "https://profiles.example/arjun-rathore" },
      ],
      email: "meera@loomhaus.example",
    },
    sheet: null,
    registry: {
      legalName: "Loomhaus Home Private Limited",
      incorporated: "2025-03-03",
      country: "India",
      status: "Active",
      directors: ["Meera Singh", "Arjun Rathore"],
    },
    profiles: [
      {
        name: "Meera Singh",
        headline: "Founder, Loomhaus",
        roles: [
          { company: "Loomhaus", title: "Founder", start: "2025-03", end: null },
          { company: "Jaipur Weaves Studio", title: "Lead Textile Designer", start: "2014-06", end: "2024-12" },
        ],
      },
      {
        name: "Arjun Rathore",
        headline: "Co-founder, Loomhaus",
        roles: [
          { company: "Loomhaus", title: "Co-founder, Product and Brand", start: "2025-03", end: null },
          { company: "Urban Nest Home", title: "Brand Manager", start: "2017-01", end: "2024-11" },
        ],
      },
    ],
    expected: { issues: ["missing_core_facts"], band: "Review" },
    planted: "No revenue, customer, growth, burn or team-size numbers anywhere in the deck.",
    slides: [
      {
        kind: "cover",
        title: "Loomhaus",
        tagline: "Handloom home textiles for the modern Indian home",
        meta: ["Pre-seed · Est. 2025", "Jaipur, India"],
      },
      {
        kind: "bullets",
        title: "Our story",
        bullets: [
          "Handloom weavers earn less every year as buyers move to machine-made textiles",
          "Young urban buyers want handmade, but can't find it in modern designs",
          "Loomhaus brings the two together",
        ],
      },
      {
        kind: "bullets",
        title: "The products",
        bullets: [
          "Bedsheets, cushion covers and throws, woven by hand in Rajasthan",
          "Modern colours designed in-house",
          "Sold on our website and Instagram",
        ],
      },
      {
        kind: "bullets",
        title: "Early love",
        bullets: [
          "Our first two collections sold out",
          "Customers across India keep coming back",
          "Growing fast every month",
        ],
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "India's home textiles market is worth $10B.",
        bullets: ["Premium and handmade is the fastest-growing part"],
      },
      {
        kind: "team",
        title: "Founders",
        people: [
          { name: "Meera Singh", role: "Founder", lines: ["10 years designing handloom collections"] },
          { name: "Arjun Rathore", role: "Co-founder", lines: ["Has built D2C home brands"] },
        ],
      },
      {
        kind: "round",
        title: "The ask",
        ask: "Raising $600K pre-seed",
        items: ["New collections", "Performance marketing", "A small studio and warehouse"],
        stats: [],
      },
      { kind: "contact", title: "Thank you", lines: ["Meera Singh", "meera@loomhaus.example"] },
    ],
  },

  {
    id: "tutorbridge",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 1400000, currency: "INR" }, arr: null, growth: 10, customers: 3400, team: 22, burn: { amount: 4000000, currency: "INR" }, cash: { amount: 50000000, currency: "INR" }, runway: 12, round: 2000000, founded: 2023 },
    theme: "slate",
    receivedAt: "2026-10-19T10:00:00Z",
    form: {
      companyName: "Tutorbridge",
      website: "tutorbridge.example",
      country: "India",
      sector: "Edtech",
      stage: "Seed",
      amountUsd: 1200000,
      founders: [
        { name: "Priya Nair", profileUrl: "https://profiles.example/priya-nair" },
        { name: "Sameer Khan", profileUrl: "https://profiles.example/sameer-khan" },
      ],
      email: "priya@tutorbridge.example",
    },
    sheet: sheet({
      currency: "INR",
      revenue: [870000, 1400000],
      customers: [2100, 3400],
      headcount: [20, 22],
      burn: 4000000,
      cash: 50000000,
      revRound: 5000,
    }),
    registry: {
      legalName: "Tutorbridge Learning Private Limited",
      incorporated: "2023-07-17",
      country: "India",
      status: "Active",
      directors: ["Priya Nair", "Sameer Khan"],
    },
    profiles: [
      {
        name: "Priya Nair",
        headline: "Co-founder and CEO, Tutorbridge",
        roles: [
          { company: "Tutorbridge", title: "Co-founder and CEO", start: "2023-07", end: null },
          { company: "Brightminds Schools", title: "Academic Director", start: "2012-06", end: "2022-12" },
        ],
      },
      {
        name: "Sameer Khan",
        headline: "Co-founder and CTO, Tutorbridge",
        roles: [
          { company: "Tutorbridge", title: "Co-founder and CTO", start: "2023-07", end: null },
          { company: "Quizly", title: "Engineering Lead", start: "2018-02", end: "2023-05" },
        ],
      },
    ],
    expected: { issues: ["round_deck_vs_form"], band: "Outside focus" },
    planted: "Deck asks for $2M; the application form says $1.2M. Edtech is outside the fund's focus.",
    slides: [
      {
        kind: "cover",
        title: "Tutorbridge",
        tagline: "After-school tutoring from verified teachers, in your own language",
        meta: ["Seed · 2026", "Hyderabad · Founded 2023"],
      },
      {
        kind: "bullets",
        title: "The problem",
        bullets: [
          "Parents in tier-2 cities pay for tutoring but can't judge quality",
          "Good teachers can't find enough students near them",
        ],
      },
      {
        kind: "bullets",
        title: "Solution",
        bullets: [
          "Small online groups of 6 students, taught in Telugu, Hindi or English",
          "Every teacher verified and trial-taught before joining",
          "Monthly progress reports for parents",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "3,400", label: "paying students" },
          { value: "₹14 L", label: "monthly revenue, Sep 2026" },
          { value: "10%", label: "month-on-month growth" },
          { value: "82%", label: "renew after 3 months" },
        ],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Priya Nair",
            role: "CEO",
            lines: ["Academic Director, Brightminds Schools (2012–2022)", "Ran 14 schools' curriculum"],
          },
          {
            name: "Sameer Khan",
            role: "CTO",
            lines: ["Engineering Lead, Quizly (2018–2023)", "Built live classroom software"],
          },
        ],
        note: "22 people",
      },
      {
        kind: "round",
        title: "Raising $2M Seed",
        ask: "To launch in Karnataka and Maharashtra",
        items: ["60% teacher supply and marketing", "40% product"],
        stats: [
          { value: "₹5 Cr", label: "cash" },
          { value: "₹40 L", label: "monthly burn" },
          { value: "12 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Priya Nair", "priya@tutorbridge.example"] },
    ],
  },

  {
    id: "clinicall",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: null, arr: { amount: 6800000, currency: "USD" }, growth: 4, customers: 140, team: 85, burn: { amount: 1100000, currency: "USD" }, cash: { amount: 14000000, currency: "USD" }, runway: 13, round: 25000000, founded: 2019 },
    theme: "navy",
    receivedAt: "2026-10-17T13:45:00Z",
    form: {
      companyName: "Clinicall",
      website: "clinicall.example",
      country: "USA",
      sector: "Healthtech",
      stage: "Series B",
      amountUsd: 25000000,
      founders: [
        { name: "Daniel Brooks", profileUrl: "https://profiles.example/daniel-brooks" },
        { name: "Grace Liu", profileUrl: "https://profiles.example/grace-liu" },
      ],
      email: "daniel@clinicall.example",
    },
    sheet: null,
    registry: {
      legalName: "Clinicall, Inc.",
      incorporated: "2019-08-15",
      country: "USA",
      status: "Active",
      directors: ["Daniel Brooks", "Grace Liu"],
    },
    profiles: [
      {
        name: "Daniel Brooks",
        headline: "CEO, Clinicall",
        roles: [
          { company: "Clinicall", title: "Co-founder and CEO", start: "2019-08", end: null },
          { company: "Harborview Cardiology Group", title: "VP Operations", start: "2012-03", end: "2019-06" },
        ],
      },
      {
        name: "Grace Liu",
        headline: "CTO, Clinicall",
        roles: [
          { company: "Clinicall", title: "Co-founder and CTO", start: "2019-08", end: null },
          { company: "Medisync", title: "Principal Engineer", start: "2013-01", end: "2019-07" },
        ],
      },
    ],
    expected: { issues: [], band: "Outside focus" },
    planted: "Nothing planted. Outside focus on country, stage and round size.",
    slides: [
      {
        kind: "cover",
        title: "Clinicall",
        tagline: "Remote heart monitoring that cardiology clinics get paid for",
        meta: ["Series B · 2026", "Boston, MA · Founded 2019"],
      },
      {
        kind: "bullets",
        title: "The problem",
        bullets: [
          "Heart-failure patients are readmitted within 30 days at high rates",
          "Clinics can bill for remote monitoring but lack the staff to run it",
        ],
      },
      {
        kind: "bullets",
        title: "What we do",
        bullets: [
          "Connected devices shipped to patients' homes",
          "Our nurses watch the data and escalate to the clinic",
          "We handle billing codes and documentation",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "$6.8M", label: "ARR, September 2026" },
          { value: "140", label: "cardiology clinics" },
          { value: "4%", label: "month-on-month growth" },
          { value: "21,000", label: "patients monitored" },
        ],
      },
      {
        kind: "team",
        title: "Leadership",
        people: [
          {
            name: "Daniel Brooks",
            role: "CEO",
            lines: ["VP Operations, Harborview Cardiology Group (2012–2019)"],
          },
          { name: "Grace Liu", role: "CTO", lines: ["Principal Engineer, Medisync (2013–2019)"] },
        ],
        note: "85 employees",
      },
      {
        kind: "round",
        title: "Series B: $25M",
        ask: "To reach 500 clinics by 2028",
        items: ["Sales team expansion", "Nurse operations", "Device supply"],
        stats: [
          { value: "$14M", label: "cash" },
          { value: "$1.1M", label: "monthly burn" },
          { value: "13 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Contact", lines: ["Daniel Brooks", "daniel@clinicall.example"] },
    ],
  },

  {
    id: "parkwise",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 64000, currency: "USD" }, arr: null, growth: 9.5, customers: 18, team: 16, burn: { amount: 95000, currency: "USD" }, cash: { amount: 1100000, currency: "USD" }, runway: 11, round: 1500000, founded: 2022 },
    theme: "slate",
    receivedAt: "2026-10-16T09:30:00Z",
    form: {
      companyName: "Parkwise",
      website: "parkwise.example",
      country: "UAE",
      sector: "Mobility",
      stage: "Seed",
      amountUsd: 1500000,
      founders: [
        { name: "Ahmed Saleh", profileUrl: "https://profiles.example/ahmed-saleh" },
        { name: "Rohan Desai", profileUrl: "https://profiles.example/rohan-desai" },
      ],
      email: "ahmed@parkwise.example",
    },
    sheet: sheet({
      currency: "USD",
      revenue: [40700, 64000],
      customers: [11, 18],
      headcount: [13, 16],
      burn: 95000,
      cash: 1100000,
      revRound: 100,
    }),
    registry: {
      legalName: "Parkwise Technologies FZ-LLC",
      incorporated: "2022-01-18",
      country: "UAE",
      status: "Active",
      directors: ["Ahmed Saleh", "Rohan Desai"],
    },
    profiles: [
      {
        name: "Ahmed Saleh",
        headline: "CEO, Parkwise",
        roles: [
          { company: "Parkwise", title: "Co-founder and CEO", start: "2022-01", end: null },
          { company: "CityPark Operations", title: "General Manager", start: "2014-02", end: "2021-10" },
        ],
      },
      {
        name: "Rohan Desai",
        headline: "CTO, Parkwise",
        roles: [
          { company: "Parkwise", title: "Co-founder and CTO", start: "2022-01", end: null },
          { company: "Visionlane", title: "Senior Engineer, Computer Vision", start: "2016-05", end: "2021-11" },
        ],
      },
    ],
    expected: { issues: [], band: "Priority" },
    planted: "Nothing planted. Clean control deck.",
    slides: [
      {
        kind: "cover",
        title: "Parkwise",
        tagline: "Ticketless parking for malls and hospitals",
        meta: ["Seed round · 2026", "Dubai · Founded 2022"],
      },
      {
        kind: "bullets",
        title: "Parking is still run on paper tickets",
        bullets: [
          "Queues at exit barriers at peak hours",
          "Operators can't see occupancy or revenue in real time",
          "Lost tickets and cash handling cause leakage",
        ],
      },
      {
        kind: "bullets",
        title: "Parkwise",
        bullets: [
          "Number-plate cameras open the barrier, no ticket needed",
          "Drivers pay by app, card or Salik-style account",
          "Live dashboard of occupancy and revenue for operators",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "$64K", label: "MRR, Sep 2026" },
          { value: "18", label: "operators, 41 sites" },
          { value: "9.5%", label: "average monthly growth" },
          { value: "0", label: "operators lost" },
        ],
        chart: {
          title: "MRR, $ thousand",
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
          values: [40.7, 45.1, 48.5, 53.7, 57.8, 64],
          fmt: "${v}K",
        },
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "Bottom-up: 2,300 paid parking sites in the GCC with 300+ spaces, at $18,000 a year each: $41M a year today.",
        bullets: ["Adjacent: residential and office towers", "Saudi Arabia from 2027"],
      },
      {
        kind: "table",
        title: "Competition",
        headers: ["", "Ticketless", "Software-only pricing", "Live operator dashboard"],
        rows: [
          ["Parkwise", "Yes", "Yes", "Yes"],
          ["Barrier hardware makers", "Partly", "No", "Partly"],
          ["Parking apps for drivers", "No", "Yes", "No"],
        ],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Ahmed Saleh",
            role: "CEO",
            lines: ["General Manager, CityPark Operations (2014–2021)", "Ran 30 car parks in Dubai and Sharjah"],
          },
          {
            name: "Rohan Desai",
            role: "CTO",
            lines: ["Senior Engineer, Visionlane (2016–2021)", "Built number-plate recognition systems"],
          },
        ],
        note: "Team of 16",
      },
      {
        kind: "round",
        title: "Raising $1.5M Seed",
        ask: "To reach 100 sites across the UAE",
        items: ["50% sales", "30% product", "20% installation team"],
        stats: [
          { value: "$1.1M", label: "cash" },
          { value: "$95K", label: "monthly burn" },
          { value: "11 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Ahmed Saleh", "ahmed@parkwise.example"] },
    ],
  },

  {
    id: "freightnest",
    // What a perfect reading of the deck gives (for measuring extraction accuracy).
    gold: { mrr: { amount: 58000, currency: "USD" }, arr: null, growth: 8, customers: 140, team: 19, burn: { amount: 120000, currency: "USD" }, cash: { amount: 1500000, currency: "USD" }, runway: 12, round: 2000000, founded: 2022 },
    theme: "slate",
    receivedAt: "2026-10-27T06:15:00Z",
    form: {
      companyName: "Freightnest",
      website: "freightnest.example",
      country: "UAE",
      sector: "Logistics",
      stage: "Seed",
      amountUsd: 2000000,
      founders: [
        { name: "Nikhil Bansal", profileUrl: "https://profiles.example/nikhil-bansal" },
        { name: "Aisha Rahman", profileUrl: "https://profiles.example/aisha-rahman" },
      ],
      email: "nikhil@freightnest.example",
    },
    sheet: sheet({
      currency: "USD",
      revenue: [39500, 58000],
      customers: [96, 134],
      headcount: [16, 19],
      burn: 120000,
      cash: 1500000,
      revRound: 100,
    }),
    registry: {
      legalName: "Freightnest Technologies FZCO",
      incorporated: "2022-09-05",
      country: "UAE",
      status: "Active",
      directors: ["Nikhil Bansal", "Aisha Rahman"],
    },
    profiles: [
      {
        name: "Nikhil Bansal",
        headline: "CEO, Freightnest",
        roles: [
          { company: "Freightnest", title: "Co-founder and CEO", start: "2022-09", end: null },
          { company: "Seabridge Forwarding", title: "Regional Director, Middle East", start: "2012-04", end: "2021-12" },
        ],
      },
      {
        name: "Aisha Rahman",
        headline: "CPO, Freightnest",
        roles: [
          { company: "Freightnest", title: "Co-founder and CPO", start: "2022-09", end: null },
          { company: "Cargolink", title: "Product Manager", start: "2017-03", end: "2022-07" },
        ],
      },
    ],
    expected: { issues: [], band: "Priority" },
    planted: "Near-miss only: deck says about 140 customers, the sheet shows 134 (4% gap, under the 10% threshold).",
    slides: [
      {
        kind: "cover",
        title: "Freightnest",
        tagline: "The operating system for small freight forwarders",
        meta: ["Seed · 2026", "Dubai and Mumbai · Founded 2022"],
      },
      {
        kind: "bullets",
        title: "Small forwarders run on email and Excel",
        bullets: [
          "A quote takes 4 hours of emails with carriers",
          "Shipments are tracked by calling agents",
          "Invoices go out late and with errors",
        ],
      },
      {
        kind: "bullets",
        title: "Freightnest",
        bullets: [
          "Instant quotes from 60+ carriers and agents",
          "Bookings, documents and tracking in one place",
          "Invoices raised automatically when a shipment moves",
        ],
      },
      {
        kind: "stats",
        title: "Traction",
        stats: [
          { value: "~140", label: "freight forwarders using Freightnest" },
          { value: "$58K", label: "MRR, September 2026" },
          { value: "8%", label: "month-on-month growth" },
          { value: "3%", label: "monthly logo churn" },
        ],
      },
      {
        kind: "bullets",
        title: "Market",
        lead: "Bottom-up: 9,000 small and mid-size forwarders on the UAE–India corridor, at $6,000 a year: $54M a year.",
        bullets: ["Then Saudi Arabia, Oman and East Africa"],
      },
      {
        kind: "table",
        title: "Competition",
        headers: ["", "Built for small forwarders", "Carrier quotes", "Price per month"],
        rows: [
          ["Freightnest", "Yes", "Yes", "$300–$900"],
          ["Enterprise forwarding software", "No", "Yes", "$5,000+"],
          ["Digital forwarders", "Compete with them", "Yes", "n/a"],
        ],
      },
      {
        kind: "team",
        title: "Team",
        people: [
          {
            name: "Nikhil Bansal",
            role: "CEO",
            lines: ["Regional Director, Seabridge Forwarding (2012–2021)", "Ran a $40M forwarding P&L"],
          },
          {
            name: "Aisha Rahman",
            role: "CPO",
            lines: ["Product Manager, Cargolink (2017–2022)", "Shipped its booking platform"],
          },
        ],
        note: "19 people in Dubai and Mumbai",
      },
      {
        kind: "round",
        title: "Raising $2M Seed",
        ask: "To reach 500 forwarders by end of 2027",
        items: ["50% sales in India and the GCC", "35% product", "15% onboarding"],
        stats: [
          { value: "$1.5M", label: "cash" },
          { value: "$120K", label: "monthly burn" },
          { value: "12 months", label: "runway" },
        ],
      },
      { kind: "contact", title: "Thank you", lines: ["Nikhil Bansal", "nikhil@freightnest.example"] },
    ],
  },
];
