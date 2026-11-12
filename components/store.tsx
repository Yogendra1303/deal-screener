"use client";

// Sample results ship with the app. Anything processed or changed (new uploads, overrules, fund rules,
// statuses, decisions, logged signals) is saved in this browser at once and on the server soon after,
// so every browser that opens the app sees the same state. Without a database the browser copy stands.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SAMPLES, SEED_RESULTS } from "@/lib/data";
import { DEFAULT_RULES, bandFor, rescore } from "@/lib/rules";
import type { Band, DealResult, DealStatus, FundRules, Level, Overrule, ScoreKey } from "@/lib/types";
import { deleteDeck } from "@/lib/deckstore";
import { health } from "@/lib/client-api";
import { flowById, flowStatus } from "@/lib/flow";
import { SEED_DECISIONS, type Decision } from "@/lib/funnel";
import { clearServerState, hydrate, persist } from "@/lib/db/client";
import type { LoggedSignal } from "@/lib/signals";
import type { Research } from "@/lib/schema";

const KEYS = {
  deals: "ds.deals.v1",
  overrules: "ds.overrules.v1",
  rules: "ds.rules.v1",
  factChecks: "ds.factchecks.v1",
  statuses: "ds.statuses.v1",
  decisions: "ds.decisions.v1",
  signals: "ds.signals.v1",
  settings: "ds.settings.v1",
  research: "ds.research.v1",
};

export type AiMode = "ACCOUNT_BRIDGE" | "API_KEY";
export interface Settings {
  aiMode: AiMode;
}
const DEFAULT_SETTINGS: Settings = { aiMode: "ACCOUNT_BRIDGE" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const write = persist;

export type FactCheck = "right" | "wrong";

interface Store {
  ready: boolean;
  deals: DealResult[];
  unprocessed: typeof SAMPLES;
  rules: FundRules;
  overrules: Record<string, Overrule>;
  factChecks: Record<string, FactCheck>;
  statuses: Record<string, DealStatus>;
  /** Open-web events people logged against a company, newest first. */
  signals: Record<string, LoggedSignal[]>;
  /** Research packs attached to companies that have no processed deal (history and unread pitches). */
  research: Record<string, Research>;
  settings: Settings;
  server: { hasKey: boolean; model: string; effort: string } | null;
  saveError: string | null;
  getDeal: (id: string) => DealResult | undefined;
  bandOf: (deal: DealResult) => Band;
  /** The scores as the team reads them: the code's, with any hand-set level laid over it. */
  scoresOf: (deal: DealResult) => DealResult["scores"];
  saveDeal: (deal: DealResult) => void;
  removeDeal: (id: string) => void;
  setRules: (rules: FundRules) => void;
  setOverrule: (id: string, overrule: Overrule | null) => void;
  setFactCheck: (key: string, value: FactCheck | null) => void;
  statusOf: (id: string) => DealStatus;
  setStatus: (id: string, status: DealStatus) => void;
  /** Why a pitch was passed or held, and when to look again. */
  decisionOf: (id: string) => Decision | undefined;
  setDecision: (id: string, d: Decision | null) => void;
  signalsOf: (id: string) => LoggedSignal[];
  addSignal: (id: string, s: Omit<LoggedSignal, "id" | "loggedAt">) => void;
  removeSignal: (id: string, signalId: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  researchOf: (id: string) => Research | null;
  setResearch: (id: string, r: Research | null) => void;
  /** True when anything in this store differs from what ships with the app. */
  changed: boolean;
  /** Puts every store this provider owns back to factory defaults, here and on the server. */
  resetAll: () => Promise<void>;
}

function applyScores(deal: DealResult, over?: Partial<Record<ScoreKey, Level>>): DealResult["scores"] {
  if (!over) return deal.scores;
  return deal.scores.map((s) => (over[s.key] && over[s.key] !== s.level ? { ...s, level: over[s.key]!, reason: `Set by hand. The ${s.by === "AI" ? "AI" : "code"} said ${s.level.toLowerCase()}: ${s.reason}` } : s));
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<Record<string, DealResult>>({});
  const [rules, setRulesState] = useState<FundRules>(DEFAULT_RULES);
  const [overrules, setOverrules] = useState<Record<string, Overrule>>({});
  const [factChecks, setFactChecks] = useState<Record<string, FactCheck>>({});
  const [statuses, setStatuses] = useState<Record<string, DealStatus>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision | null>>({});
  const [signals, setSignals] = useState<Record<string, LoggedSignal[]>>({});
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [research, setResearchState] = useState<Record<string, Research>>({});
  const [server, setServer] = useState<Store["server"]>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Load what this browser saved earlier. Runs once, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(read(KEYS.deals, {}));
    setRulesState(read(KEYS.rules, DEFAULT_RULES));
    setOverrules(read(KEYS.overrules, {}));
    setFactChecks(read(KEYS.factChecks, {}));
    setStatuses(read(KEYS.statuses, {}));
    setDecisions(read(KEYS.decisions, {}));
    setSignals(read(KEYS.signals, {}));
    setSettingsState({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
    setResearchState(read(KEYS.research, {}));
    setReady(true);
    health().then(setServer);
    // Then the server's copy, which wins over this browser's unless something changed here first.
    const hasLocal = (key: string) => (window.localStorage.getItem(key) ? read(key, null) : null);
    hydrate<Record<string, DealResult>>(KEYS.deals, setLocal, hasLocal(KEYS.deals));
    hydrate<FundRules>(KEYS.rules, setRulesState, hasLocal(KEYS.rules));
    hydrate<Record<string, Overrule>>(KEYS.overrules, setOverrules, hasLocal(KEYS.overrules));
    hydrate<Record<string, FactCheck>>(KEYS.factChecks, setFactChecks, hasLocal(KEYS.factChecks));
    hydrate<Record<string, DealStatus>>(KEYS.statuses, setStatuses, hasLocal(KEYS.statuses));
    hydrate<Record<string, Decision | null>>(KEYS.decisions, setDecisions, hasLocal(KEYS.decisions));
    hydrate<Record<string, LoggedSignal[]>>(KEYS.signals, setSignals, hasLocal(KEYS.signals));
    hydrate<Partial<Settings>>(KEYS.settings, (v) => setSettingsState({ ...DEFAULT_SETTINGS, ...v }), hasLocal(KEYS.settings));
    hydrate<Record<string, Research>>(KEYS.research, setResearchState, hasLocal(KEYS.research));
  }, []);

  const deals = useMemo(() => {
    const all: Record<string, DealResult> = { ...SEED_RESULTS, ...local };
    return Object.values(all).map((d) => rescore(d, rules));
  }, [local, rules]);

  const unprocessed = useMemo(() => SAMPLES.filter((s) => !deals.some((d) => d.id === s.id)), [deals]);

  const saveDeal = useCallback((deal: DealResult) => {
    setLocal((prev) => {
      const next = { ...prev, [deal.id]: deal };
      setSaveError(write(KEYS.deals, next));
      return next;
    });
  }, []);

  const removeDeal = useCallback((id: string) => {
    setLocal((prev) => {
      const next = { ...prev };
      delete next[id];
      setSaveError(write(KEYS.deals, next));
      return next;
    });
    deleteDeck(id);
  }, []);

  const setRules = useCallback((r: FundRules) => {
    setRulesState(r);
    setSaveError(write(KEYS.rules, r));
  }, []);

  const setOverrule = useCallback((id: string, o: Overrule | null) => {
    setOverrules((prev) => {
      const next = { ...prev };
      if (o) next[id] = o;
      else delete next[id];
      setSaveError(write(KEYS.overrules, next));
      return next;
    });
  }, []);

  const setFactCheck = useCallback((key: string, value: FactCheck | null) => {
    setFactChecks((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      setSaveError(write(KEYS.factChecks, next));
      return next;
    });
  }, []);

  const setDecision = useCallback((id: string, d: Decision | null) => {
    // null is kept (not deleted) so a sample decision someone reopened stays reopened.
    setDecisions((prev) => {
      const next = { ...prev, [id]: d };
      setSaveError(write(KEYS.decisions, next));
      return next;
    });
    setStatuses((prev) => {
      const next: Record<string, DealStatus> = { ...prev, [id]: d ? d.status : "Reviewing" };
      setSaveError(write(KEYS.statuses, next));
      return next;
    });
  }, []);

  const setStatus = useCallback((id: string, status: DealStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [id]: status };
      setSaveError(write(KEYS.statuses, next));
      return next;
    });
  }, []);

  const addSignal = useCallback((id: string, s: Omit<LoggedSignal, "id" | "loggedAt">) => {
    setSignals((prev) => {
      const entry: LoggedSignal = { ...s, id: `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, loggedAt: new Date().toISOString() };
      const next = { ...prev, [id]: [entry, ...(prev[id] ?? [])].sort((a, b) => b.at.localeCompare(a.at)) };
      setSaveError(write(KEYS.signals, next));
      return next;
    });
  }, []);

  const removeSignal = useCallback((id: string, signalId: string) => {
    setSignals((prev) => {
      const next = { ...prev, [id]: (prev[id] ?? []).filter((s) => s.id !== signalId) };
      if (!next[id].length) delete next[id];
      setSaveError(write(KEYS.signals, next));
      return next;
    });
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      setSaveError(write(KEYS.settings, next));
      return next;
    });
  }, []);

  const setResearch = useCallback((id: string, r: Research | null) => {
    setResearchState((prev) => {
      const next = { ...prev };
      if (r) next[id] = r;
      else delete next[id];
      setSaveError(write(KEYS.research, next));
      return next;
    });
  }, []);

  const resetAll = useCallback(async () => {
    for (const id of Object.keys(local)) deleteDeck(id);
    setLocal({});
    setRulesState(DEFAULT_RULES);
    setOverrules({});
    setFactChecks({});
    setStatuses({});
    setDecisions({});
    setSignals({});
    setSettingsState(DEFAULT_SETTINGS);
    setResearchState({});
    for (const key of Object.values(KEYS)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing saved to remove.
      }
    }
    await clearServerState();
  }, [local]);

  const changed =
    Object.keys(local).length > 0 ||
    Object.keys(overrules).length > 0 ||
    Object.keys(factChecks).length > 0 ||
    Object.keys(statuses).length > 0 ||
    Object.keys(decisions).length > 0 ||
    Object.keys(signals).length > 0 ||
    Object.keys(research).length > 0 ||
    JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);

  const store: Store = {
    ready,
    deals,
    unprocessed,
    rules,
    overrules,
    factChecks,
    statuses,
    signals,
    research,
    settings,
    server,
    saveError,
    getDeal: (id) => deals.find((d) => d.id === id),
    bandOf: (deal) => {
      const o = overrules[deal.id];
      if (o?.band) return o.band;
      if (o?.scores && Object.keys(o.scores).length) return bandFor(applyScores(deal, o.scores)).band;
      return deal.band;
    },
    scoresOf: (deal) => applyScores(deal, overrules[deal.id]?.scores),
    saveDeal,
    removeDeal,
    setRules,
    setOverrule,
    setFactCheck,
    statusOf: (id) => statuses[id] ?? (decisions[id] === undefined ? (SEED_DECISIONS[id]?.status ?? flowStatus(id)) : undefined) ?? "New",
    setStatus,
    decisionOf: (id) => (decisions[id] === undefined ? (SEED_DECISIONS[id] ?? flowById(id)?.decision) : (decisions[id] ?? undefined)),
    setDecision,
    signalsOf: (id) => signals[id] ?? [],
    addSignal,
    removeSignal,
    setSettings,
    researchOf: (id) => research[id] ?? deals.find((d) => d.id === id)?.research ?? null,
    setResearch,
    changed,
    resetAll,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
