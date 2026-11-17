import { SEED_RESULTS } from "@/lib/data";
import { FLOW } from "@/lib/flow";
import { SEED_EMAILS, SEED_INBOUND, SEED_REQUESTS } from "@/lib/links";
import { PORTFOLIO } from "@/lib/portfolio/data";
import { STATE_KEYS, rowFromDeal } from "./project";
import { driver, mergeDeals, putState, upsertPermittedUsers, type DealRow, type PermittedUser } from "./repository";

export const PARTNER_EMAILS: PermittedUser[] = [
  { email: "yogendrakapkoti13@gmail.com", name: "Yogendra Kapkoti", role: "partner", active: true },
  { email: "yogendrakapkoti1309@gmail.com", name: "Yogendra Kapkoti", role: "partner", active: true },
  { email: "02.ashutosh@gmail.com", name: "Ashutosh Sinha", role: "partner", active: true },
  { email: "hello@gopalahuja.com", name: "Gopal Ahuja", role: "partner", active: true },
  { email: "sanchitkr7@gmail.com", name: "Sanchit Kumar", role: "partner", active: true },
];

export async function seedDatabase(): Promise<{
  success: boolean;
  driver: string;
  dealsCount: number;
  usersCount: number;
}> {
  const drv = driver();
  if (drv === "none") {
    return { success: false, driver: drv, dealsCount: 0, usersCount: 0 };
  }

  // 1. Seed Permitted Users
  try {
    await upsertPermittedUsers(PARTNER_EMAILS);
  } catch (err) {
    console.error("[seedDatabase] permitted_users error:", err);
  }

  // 2. Build rows for all canonical seed deals
  const seedRows: Partial<DealRow>[] = Object.values(SEED_RESULTS).map((deal) => {
    const base = rowFromDeal(deal);
    const flags = deal.flags || [];
    const conflicts = flags.filter((f) => f.kind === "conflict").length;
    const missing = flags.filter((f) => f.kind === "missing").length;
    const checksSummary =
      conflicts > 0 || missing > 0
        ? `${conflicts ? `${conflicts} Math Gap${conflicts > 1 ? "s" : ""}` : ""}${conflicts && missing ? " · " : ""}${missing ? `${missing} Missing Fact${missing > 1 ? "s" : ""}` : ""}`
        : "Checks Clear";

    return {
      ...base,
      checks_json: flags,
      checks_status: checksSummary,
      summary: deal.ai?.summary || `${deal.form.companyName} (${deal.form.sector}, ${deal.form.stage}) evaluation complete.`,
      ai_status: "Complete",
      status: deal.id === "ledgerly" ? "Reviewing" : "New",
      currency: "USD",
      is_historical: false,
    };
  });

  // 3. Build rows for historical deal flow
  const flowRows: (Partial<DealRow> & { id: string })[] = FLOW.map((h) => {
    const lastDeck = h.decks?.[h.decks.length - 1];
    return {
      id: h.id,
      slug: h.id,
      company_name: h.name,
      sector: h.sector,
      sub_category: h.sub,
      stage: lastDeck?.stage || "Seed",
      country: h.country,
      city: h.city,
      ask_amount: lastDeck?.askUsd ?? null,
      currency: "USD",
      status: h.decision?.status || (h.outcome === "Meeting" ? "Meeting set" : "Passed"),
      checks_status: "Historical",
      ai_status: "Complete",
      band: h.decision ? "Outside focus" : h.outcome === "Meeting" ? "Priority" : "Review",
      founder_fit: h.fit,
      owner: h.owner ?? null,
      received_at: lastDeck?.at || null,
      is_historical: true,
      decision_json: h.decision ?? null,
      intake_json: {
        companyName: h.name,
        sector: h.sector,
        stage: lastDeck?.stage || "Seed",
        amountUsd: lastDeck?.askUsd ?? null,
        country: h.country,
      },
    };
  });

  // 4. Merge all deals into Supabase `deals`
  const allDeals = [...seedRows, ...flowRows].filter(
    (r): r is Partial<DealRow> & { id: string } => typeof r.id === "string" && Boolean(r.id),
  );
  await mergeDeals(allDeals);

  // 5. Seed app_state with canonical blobs for instant sync
  await putState(STATE_KEYS.deals, SEED_RESULTS);
  await putState(STATE_KEYS.links, {
    requests: Object.fromEntries(SEED_REQUESTS.map((r) => [r.id, r])),
    inbound: SEED_INBOUND,
    owners: {},
    emails: Object.fromEntries(SEED_EMAILS.map((e) => [e.id, e])),
  });
  await putState("ds.portfolio.v1", {
    companies: PORTFOLIO,
  });
  await putState(STATE_KEYS.settings, {
    workspace_mode: "FULL_90",
  });

  return {
    success: true,
    driver: drv,
    dealsCount: allDeals.length,
    usersCount: PARTNER_EMAILS.length,
  };
}
