"use client";

// The browser side of persistence. Every store keeps working from localStorage first (instant, offline),
// then asks the server for the saved copy and writes changes back. When the server has no database
// (Vercel without Supabase), the server says so once and the browser simply keeps its own copy.
import { useEffect, useState } from "react";

export type DbDriver = "supabase" | "file" | "none";
export interface DbInfo {
  driver: DbDriver;
  hasKey: boolean;
  model: string;
}

let infoPromise: Promise<DbInfo> | null = null;
const listeners = new Set<(i: DbInfo) => void>();
let current: DbInfo | null = null;

export function dbInfo(): Promise<DbInfo> {
  if (!infoPromise) {
    infoPromise = fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => ({ driver: (j.db as DbDriver) ?? "none", hasKey: Boolean(j.hasKey), model: String(j.model ?? "") }))
      .catch(() => ({ driver: "none" as const, hasKey: false, model: "" }))
      .then((i) => {
        current = i;
        listeners.forEach((l) => l(i));
        return i;
      });
  }
  return infoPromise;
}

/** Where saves go: a shared database, a file on this machine, or this browser only. */
export function useDbInfo(): DbInfo | null {
  const [info, setInfo] = useState<DbInfo | null>(current);
  useEffect(() => {
    let on = true;
    dbInfo().then((i) => on && setInfo(i));
    const l = (i: DbInfo) => on && setInfo(i);
    listeners.add(l);
    return () => {
      on = false;
      listeners.delete(l);
    };
  }, []);
  return info;
}

export async function loadState<T>(key: string): Promise<{ found: boolean; value?: T }> {
  const info = await dbInfo();
  if (info.driver === "none") return { found: false };
  try {
    const res = await fetch(`/api/state/${encodeURIComponent(key)}`, { cache: "no-store" });
    if (res.status !== 200) return { found: false };
    const j = (await res.json()) as { value?: T };
    return j.value === undefined ? { found: false } : { found: true, value: j.value };
  } catch {
    return { found: false };
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, unknown>();

/** Saves soon, not on every keystroke. The last value for a key wins. */
export function saveState(key: string, value: unknown, delay = 600): void {
  pending.set(key, value);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(async () => {
      timers.delete(key);
      const info = await dbInfo();
      if (info.driver === "none") return;
      const v = pending.get(key);
      pending.delete(key);
      try {
        await fetch(`/api/state/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: v }) });
      } catch {
        // The browser copy is already saved; the next change tries again.
      }
    }, delay),
  );
}

/** Sends a file to the server store and returns the URL it can be fetched from, or null without a database. */
export async function putServerFile(dealId: string, fileType: string, file: File | Blob, fileName: string): Promise<string | null> {
  const info = await dbInfo();
  if (info.driver === "none") return null;
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(dealId)}/${encodeURIComponent(fileType)}`, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(fileName) },
      body: file,
    });
    if (!res.ok) return null;
    return `/api/files/${encodeURIComponent(dealId)}/${encodeURIComponent(fileType)}`;
  } catch {
    return null;
  }
}

const dirty = new Set<string>();
let keysPromise: Promise<string[]> | null = null;

/** Which store blobs the server already holds. Asked once per page load. */
function serverKeys(): Promise<string[]> {
  if (!keysPromise) {
    keysPromise = dbInfo().then(async (info) => {
      if (info.driver === "none") return [];
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        const j = (await res.json()) as { keys?: string[] };
        return j.keys ?? [];
      } catch {
        return [];
      }
    });
  }
  return keysPromise;
}

/** Saves to this browser now and to the server soon. Returns a message when the browser copy failed. */
export function persist(key: string, value: unknown): string | null {
  dirty.add(key);
  saveState(key, value);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return "This browser couldn't save the change (storage is full or blocked).";
  }
}

/**
 * Asks the server for the saved copy of a store and applies it, unless this browser changed the store
 * since the page loaded (then the browser's newer copy is sent up instead by the next save).
 * On a database that holds nothing yet, the browser's own copy seeds it.
 */
export async function hydrate<T>(key: string, apply: (value: T) => void, local?: T | null): Promise<void> {
  const r = await loadState<T>(key);
  if (dirty.has(key)) return;
  if (r.found) {
    try {
      window.localStorage.setItem(key, JSON.stringify(r.value));
    } catch {
      // The server copy still shows; it just isn't cached here.
    }
    apply(r.value as T);
    return;
  }
  if (local != null && (await serverKeys()).length === 0) saveState(key, local, 50);
}

/** Wipes every saved blob on the server (the factory reset). */
export async function clearServerState(): Promise<void> {
  const info = await dbInfo();
  if (info.driver === "none") return;
  await fetch("/api/state", { method: "DELETE" }).catch(() => undefined);
  keysPromise = null;
}

export const DB_TEXT: Record<DbDriver, { short: string; help: string }> = {
  supabase: { short: "Shared database", help: "Saved to Supabase. Everyone with the link sees the same statuses, notes and uploads." },
  file: { short: "Saved on this machine", help: "Saved to data/runtime-db.json on the computer running the app. Every browser on this machine sees the same data." },
  none: { short: "This browser only", help: "No database is connected, so changes live in this browser. Add the Supabase variables to share them." },
};
