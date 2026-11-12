// The source documents behind a deal, as files an analyst can preview and download.
// Real files (sample PDFs and CSVs, uploads) are served as they are. Files the prototype makes
// (archived-deal tear-sheets, snapshots, audit reports) say so in their own text.
import type { Coverage } from "./coverage";
import { fmtMoney, fmtNum } from "./format";
import type { DealRecord } from "./schema";
import type { FormInput, SheetRow } from "./types";

export type DocCode = "DECK" | "CSV" | "FORM" | "REG" | "AUDIT";

export interface SourceDoc {
  code: DocCode;
  title: string;
  fileName: string;
  mime: string;
  view: "pdf" | "csv" | "json" | "html";
  /** Where it came from, in plain words. */
  origin: string;
  /** A real file served by the app. */
  url?: string;
  /** A file kept in this browser (IndexedDB key). */
  storeKey?: string;
  /** A file made on request from the deal's data. */
  make?: () => string;
}

export const DOC_TEXT: Record<DocCode, string> = {
  DECK: "Pitch deck",
  CSV: "Monthly sheet",
  FORM: "Intake form",
  REG: "Registry record",
  AUDIT: "Audit report",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const slugFile = (name: string) => name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deal";

/** Monthly rows in the same layout as the upload template, so a downloaded sheet can be uploaded again. */
export function sheetCsv(rows: SheetRow[]): string {
  const head = "month,currency,revenue,customers,headcount,net_burn,cash";
  return [head, ...rows.map((r) => [r.month, r.currency, r.revenue, r.customers, r.headcount, r.netBurn, r.cash].map(cell).join(","))].join("\n") + "\n";
}

/** The deck's stated numbers as one table. */
export function deckFacts(record: DealRecord): [string, string][] {
  const t = record.traction;
  const m = (x: { amount: number | null; currency: string | null }) => (x.amount != null ? fmtMoney(x.amount, x.currency) : "Not stated");
  const n = (v: number | null, unit = "") => (v != null ? `${fmtNum(v)}${unit}` : "Not stated");
  return [
    ["Monthly revenue (MRR)", m(t.mrr)],
    ["Annual revenue (ARR)", m(t.arr)],
    ["Monthly growth", n(t.monthlyGrowthPct.value, "%")],
    ["Customers", n(t.customers.value)],
    ["Team size", n(t.teamSize.value)],
    ["Monthly burn", m(t.monthlyBurn)],
    ["Cash in bank", m(t.cash)],
    ["Runway", n(t.runwayMonths.value, " months")],
    ["Round ask", m(record.round.amount)],
    ["Founded", record.company.foundedYear.value != null ? String(record.company.foundedYear.value) : "Not stated"],
  ];
}

export function snapshotCsv(name: string, record: DealRecord, asOf: string | null, source: string): string {
  return ["company,metric,value,as_of,source", ...deckFacts(record).map(([k, v]) => [name, k, v, asOf ?? "", source].map(cell).join(","))].join("\n") + "\n";
}

export function formJson(form: FormInput, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...form, ...extra }, null, 2) + "\n";
}

const PAGE = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font:14px/1.5 -apple-system,"Segoe UI",system-ui,sans-serif;color:#0f172a;margin:0;padding:32px;max-width:760px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:24px 0 8px}
.sub{color:#475569;margin:0}.note{margin:16px 0;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#475569;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}
.pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid}
.ok{color:#047857;border-color:#a7f3d0;background:#ecfdf5}.bad{color:#be123c;border-color:#fecdd3;background:#fff1f2}.miss{color:#b45309;border-color:#fde68a;background:#fffbeb}.off{color:#64748b;border-color:#e2e8f0;background:#f8fafc}
.foot{margin-top:28px;color:#94a3b8;font-size:11px}@media print{body{padding:0}}
</style></head><body>${body}</body></html>`;

/** A one-page tear-sheet of the deck's stated numbers. Printable to PDF from the browser. */
export function deckSheetHtml(o: { name: string; line: string; facts: [string, string][]; meta: [string, string][]; note: string }): string {
  return PAGE(
    `${o.name} deck summary`,
    `<h1>${esc(o.name)}</h1><p class="sub">${esc(o.line)}</p>
<div class="note">${esc(o.note)}</div>
<h2>Company</h2><table>${o.meta.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
<h2>Numbers stated in the deck</h2><table>${o.facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td class="n">${esc(v)}</td></tr>`).join("")}</table>
<p class="foot">Fund Hub prototype. Fictional sample data.</p>`,
  );
}

/** What the code checks found, line by line. */
export function auditHtml(o: { name: string; cover: Coverage | null; sources: string[]; note: string }): string {
  const c = o.cover;
  const rows = c
    ? c.lines
        .map((l) => {
          const flag = c.flags.find((f) => f.checkId === l.id && f.kind === "conflict");
          const tag = !l.ran ? `<span class="pill off">Not run</span>` : l.passed ? `<span class="pill ok">Matched</span>` : `<span class="pill bad">Gap over 10%</span>`;
          const why = !l.ran ? (l.why ?? "") : flag ? flag.detail : "Within 10%.";
          return `<tr><td>${esc(l.label)}</td><td>${tag}</td><td>${esc(why)}</td></tr>`;
        })
        .join("")
    : "";
  const summary = c
    ? `${c.passed} of ${c.ran} checks matched · ${c.flags.filter((f) => f.kind === "conflict").length} gaps over 10% · ${c.missing.length} missing facts`
    : "Not checked yet: no numbers have been read from this deck.";
  return PAGE(
    `${o.name} audit report`,
    `<h1>${esc(o.name)}: verification report</h1><p class="sub">${esc(summary)}</p>
<div class="note">${esc(o.note)}</div>
<h2>Sources on file</h2><p>${o.sources.map(esc).join(" · ") || "None"}</p>
${c ? `<h2>Checks</h2><table><tr><th>Check</th><th>Result</th><th>Detail</th></tr>${rows}</table>` : ""}
${c && c.missing.length ? `<h2>Missing facts</h2><p>${esc(c.missing.join(", "))}. Ask the founder.</p>` : ""}
<p class="foot">Checks are plain code (lib/checks.ts): a gap is flagged when two sources differ by more than 10%. People decide.</p>`,
  );
}

/** Splits CSV text into cells, honouring quoted values. */
export function csvRows(csv: string): string[][] {
  const out: string[][] = [];
  for (const line of csv.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q && ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        q = !q;
      } else if (ch === "," && !q) {
        row.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    out.push(row);
  }
  return out;
}
