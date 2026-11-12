"use client";

// Founder links and what came back through them (request links, emails, the founder portal), plus who
// picked up each new pitch.
// Saved in this browser and on the server (files included); a founder page open in another tab updates the dashboard live.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadDeck, saveDeck } from "@/lib/deckstore";
import { DEMO_DATE } from "@/lib/portfolio/health";
import { SEED_EMAILS, SEED_INBOUND, SEED_REQUESTS, newToken, type EmailIn, type FounderAnswer, type FounderRequest, type Inbound, type ItemAnswer, type LinkFile } from "@/lib/links";
import { DEAL_OWNERS } from "@/lib/team";
import { hydrate, persist, putServerFile } from "@/lib/db/client";

const KEY = "ds.links.v1";

interface Local {
  requests: Record<string, FounderRequest>;
  inbound: Inbound[];
  owners: Record<string, string>;
  emails: Record<string, EmailIn>;
}

const EMPTY: Local = { requests: {}, inbound: [], owners: {}, emails: {} };

function load(): Local {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Local>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

interface LinksStore {
  ready: boolean;
  today: string;
  requests: FounderRequest[];
  inbound: Inbound[];
  getRequest: (id: string) => FounderRequest | undefined;
  requestsFor: (companyId: string) => FounderRequest[];
  createRequest: (r: Omit<FounderRequest, "id" | "answers" | "checked" | "sentAt">) => FounderRequest;
  answer: (reqId: string, itemId: string, state: FounderAnswer | null, extra?: { note?: string; by?: string }) => void;
  addFiles: (reqId: string, itemId: string, files: File[]) => Promise<void>;
  markChecked: (reqId: string, itemId: string, by: string) => void;
  addInbound: (i: Omit<Inbound, "files" | "id">, files: File[]) => Promise<Inbound>;
  getInbound: (id: string) => Inbound | undefined;
  emails: EmailIn[];
  emailsFor: (companyId: string) => EmailIn[];
  addEmail: (e: Omit<EmailIn, "id" | "files" | "filed" | "at">, files: File[]) => Promise<EmailIn>;
  fileEmail: (emailId: string, fileName: string, folder: string | null, by: string, answers?: { key: string; label: string }) => void;
  /** Counts a file that came another way (email) as the founder's answer to a request line. */
  attach: (reqId: string, itemId: string, file: LinkFile, by: string) => void;
  detach: (reqId: string, itemId: string, emailId: string, fileName: string) => void;
  ownerOf: (id: string) => string | undefined;
  claim: (id: string, who: string) => void;
  openFile: (f: LinkFile) => Promise<boolean>;
  changed: boolean;
  reset: () => void;
}

const Ctx = createContext<LinksStore | null>(null);

/**
 * Keeps each file in this browser and, when there is a database, on the server under the company it
 * belongs to. A pitch's own deck and sheet get the plain names deck_pdf and monthly_csv so the database
 * can be read without the app; everything a founder sends through a link keeps a name of its own, so two
 * PDFs for two different asks never overwrite each other.
 */
async function keep(prefix: string, dealId: string, files: File[], today: string, named = false): Promise<LinkFile[]> {
  const out: LinkFile[] = [];
  for (const [i, f] of files.entries()) {
    const key = `${prefix}:${Date.now().toString(36)}-${i}`;
    await saveDeck(key, f);
    const plain = /\.pdf$/i.test(f.name) ? "deck_pdf" : /\.csv$/i.test(f.name) ? "monthly_csv" : null;
    const type = named && plain ? plain : key.replace(/[^a-zA-Z0-9_.-]+/g, "_");
    const url = await putServerFile(dealId, type, f, f.name);
    out.push({ name: f.name, size: f.size, at: today, key, ...(url ? { url } : {}) });
  }
  return out;
}

export function LinksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<Local>(EMPTY);
  const today = DEMO_DATE;

  useEffect(() => {
    // Load once, then follow changes made in other tabs (a founder page open next to the dashboard).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(load());
    setReady(true);
    hydrate<Partial<Local>>(KEY, (v) => setLocal({ ...EMPTY, ...v }), window.localStorage.getItem(KEY) ? load() : null);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setLocal(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (l: Local) => Local) => {
    setLocal((prev) => {
      const next = fn(prev);
      persist(KEY, next);
      return next;
    });
  }, []);

  const inbound = useMemo(() => [...SEED_INBOUND.filter((x) => !local.inbound.some((i) => i.id === x.id)), ...local.inbound], [local.inbound]);
  const emails = useMemo(() => {
    const all: Record<string, EmailIn> = {};
    for (const e of SEED_EMAILS) all[e.id] = e;
    Object.assign(all, local.emails);
    return Object.values(all).sort((a, b) => b.at.localeCompare(a.at));
  }, [local.emails]);

  const requests = useMemo(() => {
    const all: Record<string, FounderRequest> = {};
    for (const r of SEED_REQUESTS) all[r.id] = r;
    Object.assign(all, local.requests);
    return Object.values(all).sort((a, b) => b.sentAt.localeCompare(a.sentAt) || a.companyName.localeCompare(b.companyName));
  }, [local.requests]);

  const edit = useCallback(
    (reqId: string, fn: (r: FounderRequest) => FounderRequest) =>
      update((l) => {
        const base = l.requests[reqId] ?? SEED_REQUESTS.find((r) => r.id === reqId);
        return base ? { ...l, requests: { ...l.requests, [reqId]: fn(base) } } : l;
      }),
    [update],
  );

  const value = useMemo<LinksStore>(() => {
    const ownerOf = (id: string) => DEAL_OWNERS[id] ?? inbound.find((i) => i.id === id)?.owner ?? local.owners[id];
    return {
      ready,
      today,
      requests,
      inbound,
      getRequest: (id) => requests.find((r) => r.id === id),
      requestsFor: (companyId) => requests.filter((r) => r.companyId === companyId),
      createRequest: (r) => {
        const req: FounderRequest = { ...r, id: newToken(r.companyId), sentAt: today, answers: {}, checked: {} };
        update((l) => ({ ...l, requests: { ...l.requests, [req.id]: req } }));
        return req;
      },
      answer: (reqId, itemId, state, extra) =>
        edit(reqId, (r) => {
          const answers = { ...r.answers };
          if (!state) delete answers[itemId];
          else answers[itemId] = { state, files: state === "Sent" ? (answers[itemId]?.files ?? []) : [], note: extra?.note, by: extra?.by, at: today } satisfies ItemAnswer;
          return { ...r, answers };
        }),
      addFiles: async (reqId, itemId, files) => {
        const kept = await keep(`req:${reqId}:${itemId}`, requests.find((r) => r.id === reqId)?.companyId ?? reqId, files, today);
        edit(reqId, (r) => {
          const prev = r.answers[itemId];
          const checked = { ...r.checked };
          delete checked[itemId];
          return { ...r, checked, answers: { ...r.answers, [itemId]: { state: "Sent", files: [...(prev?.state === "Sent" ? prev.files : []), ...kept], at: today } } };
        });
      },
      attach: (reqId, itemId, file, by) =>
        edit(reqId, (r) => {
          const prev = r.answers[itemId];
          const others = prev?.state === "Sent" ? prev.files.filter((f) => !(f.viaEmail === file.viaEmail && f.name === file.name)) : [];
          return {
            ...r,
            answers: { ...r.answers, [itemId]: { state: "Sent", files: [...others, file], at: today } },
            checked: { ...r.checked, [itemId]: { by, at: today } },
          };
        }),
      detach: (reqId, itemId, emailId, fileName) =>
        edit(reqId, (r) => {
          const prev = r.answers[itemId];
          if (prev?.state !== "Sent") return r;
          const files = prev.files.filter((f) => !(f.viaEmail === emailId && f.name === fileName));
          const answers = { ...r.answers };
          const checked = { ...r.checked };
          if (files.length) answers[itemId] = { ...prev, files };
          else {
            delete answers[itemId];
            delete checked[itemId];
          }
          return { ...r, answers, checked };
        }),
      markChecked: (reqId, itemId, by) => edit(reqId, (r) => ({ ...r, checked: { ...r.checked, [itemId]: { by, at: today } } })),
      addInbound: async (i, files) => {
        const id = `${(i.form.companyName || "pitch").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}-${Math.random().toString(36).slice(2, 6)}`;
        const kept = await keep(`pitch:${id}`, id, files, today, true);
        const entry: Inbound = { ...i, id, files: kept };
        update((l) => ({ ...l, inbound: [...l.inbound, entry] }));
        return entry;
      },
      getInbound: (id) => inbound.find((x) => x.id === id),
      emails,
      emailsFor: (companyId) => emails.filter((e) => e.companyId === companyId),
      addEmail: async (e, files) => {
        const id = `mail-${e.companyId}-${Date.now().toString(36)}`;
        const kept = await keep(`mail:${id}`, e.companyId, files, today);
        const entry: EmailIn = { ...e, id, at: today, files: kept, filed: {} };
        update((l) => ({ ...l, emails: { ...l.emails, [id]: entry } }));
        return entry;
      },
      fileEmail: (emailId, fileName, folder, by, answers) =>
        update((l) => {
          const base = l.emails[emailId] ?? SEED_EMAILS.find((x) => x.id === emailId);
          if (!base) return l;
          const filed = { ...base.filed };
          if (folder) filed[fileName] = { folder, answers: answers?.key, answersLabel: answers?.label, by, at: today };
          else delete filed[fileName];
          return { ...l, emails: { ...l.emails, [emailId]: { ...base, filed } } };
        }),
      ownerOf,
      claim: (id, who) =>
        update((l) => ({
          ...l,
          owners: { ...l.owners, [id]: who },
          inbound: l.inbound.map((x) => (x.id === id ? { ...x, owner: who } : x)),
        })),
      openFile: async (f) => {
        // This browser's copy first; then the server's, which another browser may have uploaded.
        const blob = f.key ? await loadDeck(f.key) : null;
        if (blob) {
          window.open(URL.createObjectURL(blob), "_blank", "noopener");
          return true;
        }
        if (f.url) {
          window.open(f.url, "_blank", "noopener");
          return true;
        }
        return false;
      },
      changed: JSON.stringify(local) !== JSON.stringify(EMPTY),
      reset: () => update(() => EMPTY),
    };
  }, [ready, today, requests, inbound, emails, local, update, edit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLinks(): LinksStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLinks must be used inside LinksProvider");
  return v;
}
