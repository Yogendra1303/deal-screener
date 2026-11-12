// Browser-side calls to the app's own API routes.
import type { DealResult, RunStep } from "./types";
import type { Research } from "./schema";
import { sampleById } from "./data";

/** Vercel rejects request bodies over 4.5 MB, so the hosted demo needs smaller decks. */
export const HOSTED_UPLOAD_LIMIT = 4.4 * 1024 * 1024;

export function isLocalhost(): boolean {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export async function processOnServer(fd: FormData, onStep: (message: string) => void): Promise<DealResult> {
  const res = await fetch("/api/process", { method: "POST", body: fd });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || `The server answered ${res.status}.`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "step") onStep(event.message);
      else if (event.type === "result") return event.deal as DealResult;
      else if (event.type === "error") throw new Error(event.error);
    }
  }
  throw new Error("The connection closed before the deck finished. On Vercel this usually means the time limit was hit.");
}

export async function processSample(id: string, onStep: (message: string) => void): Promise<DealResult> {
  const sample = sampleById(id);
  if (!sample) throw new Error(`Unknown sample ${id}`);
  const fd = new FormData();
  fd.set("sampleId", id);
  const pdf = await fetch(`/samples/${sample.deckFile}`).then((r) => r.blob());
  fd.set("deck", new File([pdf], sample.deckFile, { type: "application/pdf" }));
  if (sample.sheetFile) {
    const csv = await fetch(`/samples/${sample.sheetFile}`).then((r) => r.text());
    fd.set("sheet", new File([csv], sample.sheetFile, { type: "text/csv" }));
  }
  return processOnServer(fd, onStep);
}

export async function researchOnServer(deal: DealResult): Promise<{ research: Research; step: RunStep }> {
  const res = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form: deal.form, record: deal.record }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error || `The server answered ${res.status}.`);
  return j;
}

export async function health(): Promise<{ hasKey: boolean; model: string; effort: string } | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return await res.json();
  } catch {
    return null;
  }
}
