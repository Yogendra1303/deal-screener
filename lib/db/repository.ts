// The server-side data layer, with two drivers behind one interface.
//   supabase: when NEXT_PUBLIC_SUPABASE_URL and a key are set. Talks to PostgREST and Storage over fetch; no SDK needed.
//   file:     otherwise, a JSON file on disk (data/runtime-db.json) plus data/runtime-files/ for uploads. Works on a laptop.
//   none:     when the disk is read-only (Vercel without Supabase). Routes answer 503 and the browser keeps its own copy.
// Nothing here runs in the browser.
import { promises as fs, accessSync, constants, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export type Driver = "supabase" | "file" | "none";

export interface DealRow {
  id: string;
  slug: string;
  company_name: string;
  sector: string | null;
  sub_category: string | null;
  stage: string | null;
  country: string | null;
  city: string | null;
  ask_amount: number | null;
  currency: string | null;
  status: string | null;
  checks_status?: string | null;
  band: string | null;
  founder_fit: string | null;
  owner: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  founder_name?: string | null;
  founder_email?: string | null;
  received_at: string | null;
  is_historical: boolean;
  record_json: unknown;
  intake_json: unknown;
  decision_json: unknown;
  research_pack_json: unknown;
  updated_at?: string;
}

export interface FileRow {
  id: string;
  deal_id: string;
  file_type: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  raw_content: string | null;
  created_at: string;
}

export interface SignalRow {
  id: string;
  deal_id: string;
  event_type: string;
  title: string;
  publisher: string | null;
  source_url: string | null;
  event_date: string | null;
  relevance_note: string | null;
  points: number | null;
  created_at: string;
}

export interface Settings {
  workspace_mode: string | null;
  fund_rules_json: unknown;
  ai_mode: string | null;
  updated_at?: string;
}

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BUCKET = process.env.SUPABASE_BUCKET ?? "deal-files";
const DB_FILE =
  process.env.FUNDHUB_DB_FILE ??
  (process.env.NODE_ENV === "development"
    ? path.join("/tmp", "deal-screener-runtime-db.json")
    : path.join(process.cwd(), "data", "runtime-db.json"));
const FILES_DIR =
  process.env.FUNDHUB_FILES_DIR ??
  (process.env.NODE_ENV === "development"
    ? path.join("/tmp", "deal-screener-runtime-files")
    : path.join(process.cwd(), "data", "runtime-files"));

let fileOk: boolean | null = null;
function diskWritable(): boolean {
  if (fileOk != null) return fileOk;
  try {
    if (process.env.VERCEL && !process.env.FUNDHUB_DB_FILE) throw new Error("read-only");
    const dir = path.dirname(DB_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    fileOk = true;
  } catch {
    fileOk = false;
  }
  return fileOk;
}

export function driver(): Driver {
  if (SB_URL && SB_KEY) return "supabase";
  return diskWritable() ? "file" : "none";
}

export class NoDatabaseError extends Error {
  constructor() {
    super("No database is connected. Set the Supabase variables, or run the app on a machine with a writable disk.");
  }
}

// ---------- Supabase over REST ----------

async function sb(pathname: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${SB_URL}${pathname}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${init.method ?? "GET"} ${pathname} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await sb(`/rest/v1/${table}?${query}`);
  return (await res.json()) as T[];
}

async function sbUpsert(table: string, rows: unknown[], onConflict: string): Promise<void> {
  if (!rows.length) return;
  await sb(`/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", ...json(rows), prefer: "resolution=merge-duplicates,return=minimal" });
}

// ---------- JSON file ----------

interface FileDb {
  state: Record<string, unknown>;
  deals: Record<string, DealRow>;
  files: FileRow[];
  signals: SignalRow[];
  settings: Settings;
}

const EMPTY_DB: FileDb = { state: {}, deals: {}, files: [], signals: [], settings: { workspace_mode: null, fund_rules_json: null, ai_mode: null } };
let cache: FileDb | null = null;
let chain: Promise<void> = Promise.resolve();

async function readDb(): Promise<FileDb> {
  if (cache) return cache;
  try {
    cache = { ...EMPTY_DB, ...(JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Partial<FileDb>) };
  } catch {
    cache = structuredClone(EMPTY_DB);
  }
  return cache;
}

/** Writes go one after another, so two quick saves never interleave. */
function withDb<T>(fn: (db: FileDb) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const db = await readDb();
    const out = await fn(db);
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 1));
    return out;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function need(): void {
  if (driver() === "none") throw new NoDatabaseError();
}

// ---------- Key-value state (what each browser store keeps) ----------

export async function getState<T>(key: string): Promise<T | undefined> {
  need();
  if (driver() === "supabase") {
    const rows = await sbSelect<{ value: T }>("app_state", `key=eq.${encodeURIComponent(key)}&select=value`);
    return rows[0]?.value;
  }
  return (await readDb()).state[key] as T | undefined;
}

export async function putState(key: string, value: unknown): Promise<void> {
  need();
  if (driver() === "supabase") {
    await sbUpsert("app_state", [{ key, value, updated_at: now() }], "key");
    return;
  }
  await withDb((db) => {
    db.state[key] = value;
  });
}

export async function listStateKeys(): Promise<string[]> {
  need();
  if (driver() === "supabase") return (await sbSelect<{ key: string }>("app_state", "select=key")).map((r) => r.key);
  return Object.keys((await readDb()).state);
}

export async function clearState(): Promise<void> {
  need();
  if (driver() === "supabase") {
    await sb(`/rest/v1/app_state?key=neq.__none__`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`/rest/v1/deal_signals?id=neq.00000000-0000-0000-0000-000000000000`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`/rest/v1/deals?is_historical=eq.false`, { method: "DELETE", prefer: "return=minimal" });
    return;
  }
  await withDb((db) => {
    db.state = {};
    db.signals = [];
    for (const id of Object.keys(db.deals)) if (!db.deals[id].is_historical) delete db.deals[id];
  });
}

// ---------- Deals ----------

export async function listDeals(): Promise<DealRow[]> {
  need();
  if (driver() === "supabase") return sbSelect<DealRow>("deals", "select=*&order=received_at.desc.nullslast");
  return Object.values((await readDb()).deals).sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));
}

export async function getDeal(id: string): Promise<DealRow | null> {
  need();
  if (driver() === "supabase") return (await sbSelect<DealRow>("deals", `id=eq.${encodeURIComponent(id)}&select=*`))[0] ?? null;
  return (await readDb()).deals[id] ?? null;
}

/** Inserts new rows and changes only the given columns on rows that exist, so a status save never blanks a record. */
export async function mergeDeals(rows: (Partial<DealRow> & { id: string })[]): Promise<void> {
  need();
  if (!rows.length) return;
  const stamped = rows.map((r) => ({ ...r, updated_at: now() }));
  if (driver() === "supabase") {
    const ids = stamped.map((r) => r.id);
    const have = new Set((await sbSelect<{ id: string }>("deals", `id=in.(${ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",")})&select=id`)).map((r) => r.id));
    const fresh = stamped.filter((r) => !have.has(r.id)).map((r) => ({ company_name: r.id, is_historical: false, ...r }));
    if (fresh.length) await sb(`/rest/v1/deals`, { method: "POST", ...json(fresh), prefer: "return=minimal" });
    for (const r of stamped.filter((x) => have.has(x.id))) {
      const { id, ...patch } = r;
      await sb(`/rest/v1/deals?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", ...json(patch), prefer: "return=minimal" });
    }
    return;
  }
  await withDb((db) => {
    for (const r of stamped) {
      const base = db.deals[r.id] ?? ({ id: r.id, company_name: r.id, is_historical: false } as DealRow);
      db.deals[r.id] = { ...base, ...r };
    }
  });
}

export async function patchDeal(id: string, patch: Partial<DealRow>): Promise<DealRow | null> {
  need();
  await mergeDeals([{ id, ...patch }]);
  return getDeal(id);
}

// ---------- Files ----------

const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);

export async function putFile(dealId: string, fileType: string, fileName: string, mime: string, bytes: Uint8Array, bucket = BUCKET): Promise<FileRow> {
  need();
  const row: FileRow = {
    id: uuid(),
    deal_id: dealId,
    file_type: fileType,
    file_name: fileName,
    mime_type: mime || "application/octet-stream",
    storage_path: `${safe(dealId)}/${safe(fileType)}/${safe(fileName)}`,
    raw_content: null,
    created_at: now(),
  };
  if (driver() === "supabase") {
    await sb(`/storage/v1/object/${bucket}/${row.storage_path}`, { method: "POST", body: bytes as BodyInit, headers: { "Content-Type": row.mime_type, "x-upsert": "true" } });
    // One row per deal and file type: a re-upload replaces the old one.
    await sb(`/rest/v1/deal_files?deal_id=eq.${encodeURIComponent(dealId)}&file_type=eq.${encodeURIComponent(fileType)}`, { method: "DELETE", prefer: "return=minimal" });
    await sb(`/rest/v1/deal_files`, { method: "POST", ...json([row]), prefer: "return=minimal" });
    return row;
  }
  const full = path.join(FILES_DIR, row.storage_path);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  await withDb((db) => {
    db.files = db.files.filter((f) => !(f.deal_id === dealId && f.file_type === fileType));
    db.files.push(row);
  });
  return row;
}

export async function putPitchDeck(dealId: string, fileName: string, mime: string, bytes: Uint8Array): Promise<FileRow> {
  return putFile(dealId, "deck_pdf", fileName, mime, bytes, "pitch_decks");
}

export async function listFiles(dealId?: string): Promise<FileRow[]> {
  need();
  if (driver() === "supabase") return sbSelect<FileRow>("deal_files", dealId ? `deal_id=eq.${encodeURIComponent(dealId)}&select=*` : "select=*");
  const all = (await readDb()).files;
  return dealId ? all.filter((f) => f.deal_id === dealId) : all;
}

export async function getFile(dealId: string, fileType: string): Promise<{ row: FileRow; bytes: Uint8Array } | null> {
  need();
  const row = (await listFiles(dealId)).find((f) => f.file_type === fileType);
  if (!row) return null;
  if (driver() === "supabase") {
    try {
      const res = await sb(`/storage/v1/object/${BUCKET}/${row.storage_path}`);
      return { row, bytes: new Uint8Array(await res.arrayBuffer()) };
    } catch {
      const res = await sb(`/storage/v1/object/pitch_decks/${row.storage_path}`);
      return { row, bytes: new Uint8Array(await res.arrayBuffer()) };
    }
  }
  try {
    return { row, bytes: new Uint8Array(await fs.readFile(path.join(FILES_DIR, row.storage_path))) };
  } catch {
    return null;
  }
}

// ---------- Signals ----------

export async function replaceSignals(dealId: string, rows: Omit<SignalRow, "id" | "deal_id" | "created_at">[]): Promise<void> {
  need();
  const full: SignalRow[] = rows.map((r) => ({ ...r, id: uuid(), deal_id: dealId, created_at: now() }));
  if (driver() === "supabase") {
    await sb(`/rest/v1/deal_signals?deal_id=eq.${encodeURIComponent(dealId)}`, { method: "DELETE", prefer: "return=minimal" });
    if (full.length) await sb(`/rest/v1/deal_signals`, { method: "POST", ...json(full), prefer: "return=minimal" });
    return;
  }
  await withDb((db) => {
    db.signals = [...db.signals.filter((s) => s.deal_id !== dealId), ...full];
  });
}

export async function listSignals(dealId?: string): Promise<SignalRow[]> {
  need();
  if (driver() === "supabase") return sbSelect<SignalRow>("deal_signals", dealId ? `deal_id=eq.${encodeURIComponent(dealId)}&select=*&order=event_date.desc` : "select=*&order=event_date.desc");
  const all = (await readDb()).signals;
  return dealId ? all.filter((s) => s.deal_id === dealId) : all;
}

// ---------- Workspace settings ----------

export async function getSettings(): Promise<Settings> {
  need();
  if (driver() === "supabase") {
    const rows = await sbSelect<Settings>("workspace_settings", "id=eq.1&select=workspace_mode,fund_rules_json,ai_mode,updated_at");
    return rows[0] ?? { ...EMPTY_DB.settings };
  }
  return (await readDb()).settings;
}

export async function putSettings(patch: Partial<Settings>): Promise<Settings> {
  need();
  if (driver() === "supabase") {
    const cur = await getSettings();
    const next = { ...cur, ...patch, updated_at: now() };
    await sbUpsert("workspace_settings", [{ id: 1, ...next }], "id");
    return next;
  }
  return withDb((db) => {
    db.settings = { ...db.settings, ...patch, updated_at: now() };
    return db.settings;
  });
}

// ---------- Permitted users (who may sign in, and as what) ----------

export type AppRole = "analyst" | "partner";
export interface PermittedUser {
  email: string;
  name: string | null;
  role: AppRole;
  active: boolean;
}

/**
 * The permitted-user row for a Google email, or null. With Supabase this reads public.permitted_users.
 * Without it (file or none driver) only the FUNDHUB_PARTNERS / FUNDHUB_ANALYSTS email lists apply.
 */
export async function getPermittedUser(email: string): Promise<PermittedUser | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (driver() === "supabase") {
    const rows = await sbSelect<PermittedUser>("permitted_users", `email=eq.${encodeURIComponent(e)}&select=email,name,role,active`);
    const r = rows[0];
    return r && r.active ? r : null;
  }
  const list = (v: string | undefined) => (v ?? "").split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (list(process.env.FUNDHUB_PARTNERS).includes(e)) return { email: e, name: null, role: "partner", active: true };
  if (list(process.env.FUNDHUB_ANALYSTS).includes(e)) return { email: e, name: null, role: "analyst", active: true };
  return null;
}
