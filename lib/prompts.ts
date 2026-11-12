// The words the AI is given, kept apart from the API client so the browser can build the same prompts
// for the account bridge (copy into Claude.ai or ChatGPT, paste the JSON back).
import { sheetGrowth } from "./sheet";
import type { DealRecord } from "./schema";
import type { Flag, FormInput, Profile, RegistryRecord, SheetRow } from "./types";

export const EXTRACT_SYSTEM = `You read startup pitch decks for a venture capital fund and fill a standard deal record.

Rules:
- Record only what the deck itself states. Never work one number out from another: don't turn monthly revenue into annual, don't compute runway from cash and burn, don't estimate growth from a chart's shape. If the deck doesn't state something, set stated to false, numbers to 0, text to an empty string and page to 0.
- For every value, give the 1-based PDF page number and a short exact quote (under 20 words) from that page.
- Amounts are plain numbers in the stated currency. k = 1,000; M or Mn = 1,000,000; B or Bn = 1,000,000,000; 1 lakh (L) = 100,000; 1 crore (Cr) = 10,000,000. So "₹4.2 Cr" is 42000000 INR and "$85K" is 85000 USD. Currency is an ISO code (INR, USD, AED, SAR).
- mrr is monthly recurring revenue or monthly revenue. arr is annual recurring revenue or annual run-rate. Fill each one only if the deck states that figure.
- monthlyGrowthPct is month-on-month growth in percent (9 for 9%), only if the deck states a monthly rate.
- asOf is YYYY-MM when the deck dates a figure (for example "Sep 2026" becomes 2026-09).
- team lists each founder with every past role the deck claims for them, including years when given. "6 years at X" ending in 2023 means startYear 2017.
- Read charts and tables too. A value printed on a chart counts as stated; cite that page.
- Don't judge or score anything. Just record what is there.`;

export const ASSESS_SYSTEM = `You help a venture capital analyst screen inbound pitches. The AI sorts and explains; people decide.

You get a standard deal record filled from the deck, the founder's form answers, results of cross-checks done in code, the founder's monthly numbers sheet (if any), and sample registry and profile records.

Your job:
1. traction: judge the evidence for the company's stage. Strong = clear evidence of paying customers and growth that is good for the stage, confirmed by the sheet where one exists. Mixed = some evidence, but small, slow, partly unconfirmed, or mixed signals. Weak = little evidence for the stage. Not enough info = the key numbers are missing. Where the deck and the sheet disagree, judge on the sheet and say so.
2. team: judge relevant experience, time working together, and things the founders have built and shipped. Never use school, gender, age, nationality, name, photo or home city.
3. founderChecks: compare each past role the deck claims with the sample profile for that founder. "conflict" only when the profile shows a clearly more junior title or dates that differ by a year or more. Small wording differences are a "match". No profile or no matching role is "not_found". One entry per claimed role.
4. summary, strengths, concerns: plain and specific, citing numbers and their source (deck page, sheet, form, registry, profile).
5. founderQuestions: polite, specific questions for each conflict and each missing core fact, at most 6. Ask; don't accuse.

Never invent facts. If something isn't in the inputs, say it is unknown.`;

export type AssessArgs = {
  record: DealRecord;
  form: FormInput;
  flags: Flag[];
  sheet: SheetRow[] | null;
  registry: RegistryRecord | null;
  profiles: Profile[];
};

/** Everything the AI sees when it assesses a deal. Also used when a deck is screened in chat. */
export function assessContext(args: AssessArgs) {
  const { record, form, flags, sheet, registry, profiles } = args;
  const growth = sheet ? sheetGrowth(sheet) : null;
  return {
    formAnswers: form,
    dealRecord: record,
    codeChecks: flags.length ? flags.map((f) => ({ title: f.title, detail: f.detail })) : "No conflicts found by code checks.",
    monthlySheet: sheet?.length
      ? {
          months: sheet.map((r) => r.month),
          latest: sheet[sheet.length - 1],
          averageMonthlyRevenueGrowthPct: growth ? +growth.pct.toFixed(1) : null,
          all: sheet,
        }
      : "The founder did not provide a monthly numbers sheet.",
    registryRecord: registry ?? "No registry record available.",
    founderProfiles: profiles.length ? profiles : "No profile records available.",
  };
}

export const RESEARCH_SYSTEM = `You do first-level market research for a venture capital analyst, using web search.

For the company described:
1. Find the closest competitors (up to 8) in the same country or region and globally. Mark which ones the deck already names. Link each to its own website or a solid source.
2. Build a bottom-up market size range: number of possible customers × realistic yearly spend per customer, each step with its source. Give a low and a high figure in one currency, and compare it with the deck's own claim.
3. Note any red flags you find in public sources (lawsuits, shutdowns, a different founding story), with links. If none, return an empty list.

Use only what you find. Prefer primary sources. If you can't find something, say so instead of guessing. When finished, call submit_research exactly once.`;

/** What the researcher is told about the company. */
export function researchBrief(form: FormInput, record: DealRecord) {
  return {
    company: form.companyName,
    website: form.website,
    country: form.country,
    sector: form.sector,
    stage: form.stage,
    whatItDoes: record.oneLiner,
    description: record.company.description.value,
    businessModel: record.company.businessModel.value,
    competitorsNamedInDeck: record.market.competitors.map((c) => c.name),
    deckMarketSizeClaim: record.market.sizeClaim,
  };
}
