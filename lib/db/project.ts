// Turns what the browser stores save (one JSON blob per store) into rows in the deals, deal_signals and
// workspace_settings tables, so the database can be queried without knowing the app's blobs.
// app_state stays the source of truth; these rows are a mirror kept in step on every save.
import { FLOW, flowById } from "../flow";
import { sampleById } from "../data";
import type { DealResult, DealStatus, FundRules } from "../types";
import type { Decision } from "../funnel";
import type { Inbound } from "../links";
import { checkUpload } from "../upload";
import { mergeDeals, putSettings, replaceSignals, type DealRow } from "./repository";
import type { LoggedSignal } from "../signals";

export const STATE_KEYS = {
  deals: "ds.deals.v1",
  statuses: "ds.statuses.v1",
  decisions: "ds.decisions.v1",
  overrules: "ds.overrules.v1",
  rules: "ds.rules.v1",
  links: "ds.links.v1",
  signals: "ds.signals.v1",
  mode: "fundhub.workspaceMode",
  settings: "ds.settings.v1",
  research: "ds.research.v1",
} as const;

type Partial_ = Partial<DealRow> & { id: string };

/** A minimal row for a company the database hasn't seen yet, from whatever the app knows about it. */
export function baseRow(id: string): Partial_ {
  const h = flowById(id);
  if (h) {
    const last = h.decks[h.decks.length - 1];
    return {
      id,
      slug: id,
      company_name: h.name,
      sector: h.sector,
      sub_category: h.sub,
      stage: last.stage,
      country: h.country,
      city: h.city,
      ask_amount: last.askUsd,
      currency: "USD",
      founder_fit: h.fit,
      owner: h.owner ?? null,
      received_at: last.at,
      is_historical: true,
      decision_json: h.decision ?? null,
    };
  }
  const s = sampleById(id);
  if (s) {
    return {
      id,
      slug: id,
      company_name: s.form.companyName,
      sector: s.form.sector,
      stage: s.form.stage,
      country: s.form.country,
      ask_amount: s.form.amountUsd,
      currency: "USD",
      received_at: s.receivedAt,
      is_historical: false,
      intake_json: s.form,
    };
  }
  return { id, slug: id, company_name: id, is_historical: false };
}

function rowFromDeal(d: DealResult): Partial_ {
  return {
    id: d.id,
    slug: d.id,
    company_name: d.form.companyName,
    sector: d.form.sector,
    sub_category: d.record.company.businessModel.value,
    stage: d.form.stage,
    country: d.form.country,
    city: d.record.company.city.value,
    ask_amount: d.record.round.amount.amount ?? d.form.amountUsd,
    currency: d.record.round.amount.currency ?? "USD",
    band: d.band,
    received_at: d.receivedAt,
    is_historical: false,
    record_json: d.record,
    intake_json: d.form,
    research_pack_json: d.research,
  };
}

function rowFromInbound(i: Inbound): Partial_ {
  const up = i.manual ? checkUpload(i.form, i.manual) : null;
  return {
    id: i.id,
    slug: i.id,
    company_name: i.form.companyName,
    sector: i.form.sector,
    sub_category: i.manual?.sub ?? null,
    stage: i.form.stage,
    country: i.form.country,
    city: i.manual?.city ?? null,
    ask_amount: i.form.amountUsd,
    currency: "USD",
    founder_fit: up?.fit?.level ?? null,
    owner: i.owner ?? null,
    received_at: i.receivedAt,
    is_historical: false,
    record_json: up?.record ?? null,
    intake_json: i.form,
  };
}

/** Called after a store blob is saved. Errors are logged, never thrown: the blob is already safe. */
export async function projectState(key: string, value: unknown): Promise<void> {
  try {
    switch (key) {
      case STATE_KEYS.deals: {
        const deals = Object.values((value ?? {}) as Record<string, DealResult>);
        await mergeDeals(deals.map(rowFromDeal));
        break;
      }
      case STATE_KEYS.links: {
        const inbound = ((value as { inbound?: Inbound[] })?.inbound ?? []).filter((i) => i.form?.companyName);
        await mergeDeals(inbound.map(rowFromInbound));
        break;
      }
      case STATE_KEYS.statuses: {
        const statuses = (value ?? {}) as Record<string, DealStatus>;
        await mergeDeals(Object.entries(statuses).map(([id, status]) => ({ ...baseRow(id), status })));
        break;
      }
      case STATE_KEYS.decisions: {
        const decisions = (value ?? {}) as Record<string, Decision | null>;
        await mergeDeals(Object.entries(decisions).map(([id, d]) => ({ ...baseRow(id), decision_json: d, status: d?.status ?? "Reviewing" })));
        break;
      }
      case STATE_KEYS.overrules: {
        const overrules = (value ?? {}) as Record<string, { band?: string }>;
        await mergeDeals(Object.entries(overrules).filter(([, o]) => o.band).map(([id, o]) => ({ ...baseRow(id), band: o.band! })));
        break;
      }
      case STATE_KEYS.signals: {
        const all = (value ?? {}) as Record<string, LoggedSignal[]>;
        for (const [id, list] of Object.entries(all)) {
          await mergeDeals([baseRow(id)]);
          await replaceSignals(
            id,
            list.map((s) => ({ event_type: s.kind, title: s.text, publisher: s.publisher ?? null, source_url: s.url ?? null, event_date: s.at, relevance_note: s.note ?? null, points: null })),
          );
        }
        break;
      }
      case STATE_KEYS.research: {
        const packs = (value ?? {}) as Record<string, unknown>;
        await mergeDeals(Object.entries(packs).map(([id, r]) => ({ ...baseRow(id), research_pack_json: r })));
        break;
      }
      case STATE_KEYS.rules:
        await putSettings({ fund_rules_json: value as FundRules });
        break;
      case STATE_KEYS.mode:
        await putSettings({ workspace_mode: String(value) });
        break;
      case STATE_KEYS.settings:
        await putSettings({ ai_mode: (value as { aiMode?: string })?.aiMode ?? null });
        break;
    }
  } catch (e) {
    console.error(`project ${key} failed`, e);
  }
}

/** Every sample company the database should know about before anyone changes anything. */
export function historicalRows(): Partial_[] {
  return FLOW.map((h) => baseRow(h.id));
}
