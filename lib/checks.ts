// Cross-checks in plain code. Same inputs, same answer, every time.
import type { Flag, FormInput, RegistryRecord, SheetRow } from "./types";
import type { DealRecord, MoneyFactT, NumberFactT } from "./schema";
import { fmtMoney, fmtMonth, fmtNum } from "./format";
import { rowFor, sheetGrowth } from "./sheet";
import { MISSING_FLAG_THRESHOLD, missingCoreFacts, usd } from "./rules";

/** Gaps above this share are flagged. */
export const GAP_TOLERANCE = 0.1;

const sameCurrency = (a?: string | null, b?: string | null) =>
  !a || !b || a.trim().toUpperCase() === b.trim().toUpperCase();

const gapOf = (claimed: number, actual: number) => Math.abs(claimed - actual) / Math.abs(actual);
const pctText = (g: number) => `${Math.round(g * 100)}%`;

function deckRef(f: MoneyFactT | NumberFactT, value: string) {
  return { label: "Deck", value, page: f.page, quote: f.quote };
}

export function runChecks(args: {
  record: DealRecord;
  form: FormInput;
  sheet: SheetRow[] | null;
  registry: RegistryRecord | null;
}): Flag[] {
  const { record, form, sheet, registry } = args;
  const t = record.traction;
  const flags: Flag[] = [];

  if (sheet && sheet.length) {
    // 1. Revenue: deck vs sheet
    const monthly = t.mrr.amount != null ? t.mrr : t.arr.amount != null ? t.arr : null;
    if (monthly) {
      const isAnnual = monthly === t.arr;
      const row = rowFor(sheet, "revenue", monthly.asOf);
      if (row && row.revenue && sameCurrency(monthly.currency, row.currency)) {
        const deckMonthly = isAnnual ? monthly.amount! / 12 : monthly.amount!;
        const gap = gapOf(deckMonthly, row.revenue);
        if (gap > GAP_TOLERANCE) {
          const cur = monthly.currency || row.currency;
          flags.push({
            checkId: "revenue_deck_vs_sheet",
            kind: "conflict",
            title: `Revenue in the deck is ${pctText(gap)} ${deckMonthly > row.revenue ? "higher" : "lower"} than the monthly sheet`,
            detail: isAnnual
              ? `The deck states annual revenue of ${fmtMoney(monthly.amount, cur)}. The sheet shows ${fmtMoney(row.revenue, cur)} for ${fmtMonth(row.month)}, which is ${fmtMoney(row.revenue * 12, cur)} a year.`
              : `The deck states monthly revenue of ${fmtMoney(monthly.amount, cur)}. The sheet shows ${fmtMoney(row.revenue, cur)} for ${fmtMonth(row.month)}.`,
            sources: [
              deckRef(monthly, fmtMoney(monthly.amount, cur) + (isAnnual ? " a year" : " a month")),
              { label: "Monthly sheet", value: `${fmtMoney(row.revenue, cur)} in ${fmtMonth(row.month)}` },
            ],
          });
        }
      }
    }

    // 2. Growth: deck vs sheet
    const growth = sheetGrowth(sheet);
    if (t.monthlyGrowthPct.value != null && growth) {
      const claimed = t.monthlyGrowthPct.value;
      const diff = Math.abs(claimed - growth.pct);
      if (diff > Math.max(3, 0.3 * Math.abs(growth.pct))) {
        flags.push({
          checkId: "growth_deck_vs_sheet",
          kind: "conflict",
          title: `Deck claims ${claimed}% monthly growth; the sheet shows ${growth.pct.toFixed(1)}%`,
          detail: `Average month-on-month revenue growth in the sheet from ${fmtMonth(growth.from.month)} to ${fmtMonth(growth.to.month)} is ${growth.pct.toFixed(1)}%, against ${claimed}% in the deck.`,
          sources: [
            deckRef(t.monthlyGrowthPct, `${claimed}% a month`),
            {
              label: "Monthly sheet",
              value: `${growth.pct.toFixed(1)}% a month (${fmtMonth(growth.from.month)} to ${fmtMonth(growth.to.month)})`,
            },
          ],
        });
      }
    }

    // 3. Customers and 4. team size: deck vs sheet
    const countCheck = (
      fact: NumberFactT,
      field: "customers" | "headcount",
      checkId: "customers_deck_vs_sheet" | "team_deck_vs_sheet",
      noun: string,
    ) => {
      if (fact.value == null) return;
      const row = rowFor(sheet, field, fact.asOf);
      const actual = row?.[field];
      if (!row || actual == null || actual === 0) return;
      const gap = gapOf(fact.value, actual);
      if (gap > GAP_TOLERANCE && Math.abs(fact.value - actual) >= 3) {
        flags.push({
          checkId,
          kind: "conflict",
          title: `Deck says ${fmtNum(fact.value)} ${noun}; the sheet shows ${fmtNum(actual)}`,
          detail: `A ${pctText(gap)} gap between the deck and the sheet for ${fmtMonth(row.month)}.`,
          sources: [
            deckRef(fact, `${fmtNum(fact.value)} ${noun}`),
            { label: "Monthly sheet", value: `${fmtNum(actual)} in ${fmtMonth(row.month)}` },
          ],
        });
      }
    };
    countCheck(t.customers, "customers", "customers_deck_vs_sheet", "customers");
    countCheck(t.teamSize, "headcount", "team_deck_vs_sheet", "people on the team");
  }

  // 5. The deck's own maths: annual vs monthly revenue
  if (t.mrr.amount && t.arr.amount && sameCurrency(t.mrr.currency, t.arr.currency)) {
    const expected = t.mrr.amount * 12;
    const gap = gapOf(t.arr.amount, expected);
    if (gap > GAP_TOLERANCE) {
      const cur = t.arr.currency || t.mrr.currency;
      flags.push({
        checkId: "arr_vs_mrr_maths",
        kind: "conflict",
        title: `Annual revenue doesn't match monthly revenue × 12`,
        detail: `${fmtMoney(t.mrr.amount, cur)} a month × 12 = ${fmtMoney(expected, cur)}, but the deck states ${fmtMoney(t.arr.amount, cur)} a year (${pctText(gap)} gap).`,
        sources: [
          deckRef(t.mrr, `${fmtMoney(t.mrr.amount, cur)} a month`),
          deckRef(t.arr, `${fmtMoney(t.arr.amount, cur)} a year`),
        ],
      });
    }
  }

  // 6. The deck's own maths: runway vs cash and burn
  if (
    t.cash.amount &&
    t.monthlyBurn.amount &&
    t.runwayMonths.value != null &&
    sameCurrency(t.cash.currency, t.monthlyBurn.currency)
  ) {
    const computed = t.cash.amount / t.monthlyBurn.amount;
    const stated = t.runwayMonths.value;
    if (Math.abs(stated - computed) > 2 && Math.abs(stated - computed) / computed > 0.2) {
      const cur = t.cash.currency || t.monthlyBurn.currency;
      flags.push({
        checkId: "runway_maths",
        kind: "conflict",
        title: `Runway stated as ${stated} months; cash and burn give ${computed.toFixed(1)}`,
        detail: `${fmtMoney(t.cash.amount, cur)} cash ÷ ${fmtMoney(t.monthlyBurn.amount, cur)} monthly burn = ${computed.toFixed(1)} months.`,
        sources: [
          deckRef(t.runwayMonths, `${stated} months runway`),
          deckRef(t.cash, `${fmtMoney(t.cash.amount, cur)} cash`),
          deckRef(t.monthlyBurn, `${fmtMoney(t.monthlyBurn.amount, cur)} a month burn`),
        ],
      });
    }
  }

  // 7. Round size: deck vs form (USD only; no currency conversion in the prototype)
  const round = record.round.amount;
  if (round.amount && form.amountUsd && (!round.currency || round.currency.toUpperCase() === "USD")) {
    const gap = gapOf(round.amount, form.amountUsd);
    if (gap > GAP_TOLERANCE) {
      flags.push({
        checkId: "round_deck_vs_form",
        kind: "conflict",
        title: `Deck asks for ${usd(round.amount)}; the form says ${usd(form.amountUsd)}`,
        detail: `The round size in the deck and in the application form differ by ${pctText(gap)}.`,
        sources: [deckRef(round, usd(round.amount)), { label: "Form", value: usd(form.amountUsd) }],
      });
    }
  }

  // 8. Founding date: deck vs registry
  const founded = record.company.foundedYear;
  if (registry && founded.value != null) {
    const regYear = Number(registry.incorporated.slice(0, 4));
    if (Math.abs(founded.value - regYear) >= 1) {
      flags.push({
        checkId: "founded_vs_registry",
        kind: "conflict",
        title: `Deck says founded ${founded.value}; registry shows ${regYear}`,
        detail: `${registry.legalName} was incorporated on ${registry.incorporated}. The company may have operated before incorporating, so ask rather than assume.`,
        sources: [
          deckRef(founded, `Founded ${founded.value}`),
          { label: /sample/i.test(registry.source) ? "Registry (sample)" : "Registry (live)", value: `Incorporated ${registry.incorporated}` },
        ],
      });
    }
  }

  // 9. Missing core facts
  const missing = missingCoreFacts(record);
  if (missing.length >= MISSING_FLAG_THRESHOLD) {
    flags.push({
      checkId: "missing_core_facts",
      kind: "missing",
      title: `${missing.length} of 8 core facts are missing from the deck`,
      detail: `Not stated: ${missing.join(", ")}. Ask the founder before scoring traction.`,
      sources: [],
    });
  }

  return flags;
}
