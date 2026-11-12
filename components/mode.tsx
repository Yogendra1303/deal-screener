"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { MODES, MODE_KEY, type WorkspaceMode } from "@/lib/mode";
import { hydrate, persist } from "@/lib/db/client";

const EVENT = "fundhub-mode";
let asked = false;

/** Once per page load: take the mode saved on the server, so every browser opens on the same one. */
function askServer() {
  if (asked) return;
  asked = true;
  hydrate<WorkspaceMode>(
    MODE_KEY,
    (m) => {
      if (MODES.includes(m)) {
        window.dispatchEvent(new Event(EVENT));
      }
    },
    (() => {
      try {
        return saved();
      } catch {
        return null;
      }
    })(),
  );
}

/** The saved value, whether written raw or as a JSON string. */
function saved(): WorkspaceMode | null {
  const raw = localStorage.getItem(MODE_KEY);
  return (raw?.startsWith('"') ? (JSON.parse(raw) as string) : raw) as WorkspaceMode | null;
}

function read(): WorkspaceMode {
  try {
    const v = saved();
    return v && MODES.includes(v) ? v : "FULL_90";
  } catch {
    return "FULL_90";
  }
}

function subscribe(cb: () => void) {
  askServer();
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The workspace mode for this browser. Every list of pitches reads it. */
export function useMode(): WorkspaceMode {
  return useSyncExternalStore(subscribe, read, () => "FULL_90");
}

export function setMode(m: WorkspaceMode) {
  persist(MODE_KEY, m);
  window.dispatchEvent(new Event(EVENT));
}

/** The card every main screen shows when the workspace has no pitches. */
export function ZeroState({ what = "pitches" }: { what?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Workspace is at 0 {what}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-700">
        Click <span className="font-semibold">+ Upload Pitch</span> to ingest your first live pitch deck PDF and monthly CSV. The checks run as soon as you save.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/upload" className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          + Upload Pitch
        </Link>
        <Link href="/workspace" className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Restore sample data
        </Link>
      </div>
    </div>
  );
}
