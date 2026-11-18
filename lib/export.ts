"use client";

/**
 * Automated LP Reporting & One-Click Export Engine.
 * Supports RFC-4180 Excel-safe CSV exports and publication-grade Print-to-PDF HTML memos
 * for Deal Pipeline, Individual IC Diligence Memos, and Quarterly LP Portfolio Reports.
 */

import { sanitizeCsvCell } from "@/lib/file-security";

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(sanitizeCsvCell).join(","),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(",")),
  ];
  // UTF-8 BOM ensures Excel opens currency symbols (₹, $, —) cleanly
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

function printViaHiddenIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  };

  iframe.onload = () => {
    try {
      const frameWin = iframe.contentWindow;
      if (frameWin) {
        frameWin.focus();
        frameWin.print();
      }
    } finally {
      cleanup();
    }
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

export function openPrintableReport(title: string, subtitle: string, bodyHtml: string): boolean {
  const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} | Aarka</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 36px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: #0f172a; background: #ffffff; line-height: 1.5; }
    .container { max-width: 860px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; }
    h1 { margin: 4px 0 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .sub { margin: 4px 0 0; font-size: 13px; color: #475569; }
    .meta { text-align: right; font-size: 11px; color: #64748b; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 24px 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
    .kpi-val { font-size: 17px; font-weight: 700; margin-top: 3px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 7px 8px; background: #f8fafc; }
    td { border-bottom: 1px solid #f1f5f9; padding: 7px 8px; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; background: #f1f5f9; color: #334155; }
    .badge-red { background: #fef2f2; color: #b91c1c; }
    .badge-green { background: #ecfdf5; color: #047857; }
    .badge-amber { background: #fffbeb; color: #b45309; }
    .toolbar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }
    .btn { background: #0f172a; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-sec { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { .toolbar { display: none; } body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Save / Print PDF</button>
    <button class="btn-sec" onclick="window.close()">Close</button>
  </div>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand">Aarka · Institutional Investment Intelligence</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="sub">${escapeHtml(subtitle)}</p>
      </div>
      <div class="meta">
        <div><strong>Generated:</strong> ${escapeHtml(now)}</div>
        <div>Confidential · Partner Report</div>
      </div>
    </div>
    ${bodyHtml}
    <div class="footer">
      <span>Aarka · Investment Committee &amp; LP Reporting</span>
      <span>Confidential · Do Not Distribute Externally</span>
    </div>
  </div>
  <script>
    if (window.self === window.top) {
      window.addEventListener("load", function () {
        setTimeout(function () { window.print(); }, 250);
      });
    }
  </script>
</body>
</html>`;

  // Open via Blob URL (never pass 'noopener' which forces window.open to return null and blocks document access).
  // If a browser pop-up blocker still blocks the tab, fall back cleanly to a hidden print iframe.
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");
    if (win) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return true;
    }
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fall back to hidden iframe print below
  }

  printViaHiddenIframe(html);
  return true;
}

import type { DealResult } from "./types";

export interface ICMemoArgs {
  deal: DealResult;
  status?: string;
  leadPartner?: string;
}

export function exportICMemoPdf({ deal, status = "Under Review", leadPartner = "Investment Team" }: ICMemoArgs): boolean {
  const f = deal.form;
  const askStr = f.amountUsd ? `$${(f.amountUsd / 1_000_000).toFixed(2)}M` : "Not stated";
  const founderNames = f.founders?.map((x) => x.name).join(", ") || "Founders on file";
  const conflictCount = deal.flags.filter((x) => x.kind === "conflict").length;

  const scoreRows = deal.scores
    .map((s) => {
      const badgeClass =
        s.level === "Strong"
          ? "badge badge-green"
          : s.level === "Mixed"
            ? "badge badge-amber"
            : "badge badge-red";
      return `<tr>
        <td style="font-weight:600;">${escapeHtml(s.label)}</td>
        <td><span class="${badgeClass}">${escapeHtml(s.level)}</span></td>
        <td style="color:#475569;">${escapeHtml(s.reason)}</td>
      </tr>`;
    })
    .join("");

  const flagRows = deal.flags
    .map((fl) => {
      const isConflict = fl.kind === "conflict";
      const sourceDetails = fl.sources
        .map((s) => `${escapeHtml(s.label)}: <strong>${escapeHtml(s.value)}</strong>${s.page ? ` (Slide p.${s.page})` : ""}`)
        .join(" vs. ");
      return `<tr>
        <td><span class="badge ${isConflict ? "badge-red" : "badge-amber"}">${escapeHtml(isConflict ? "Conflict" : "Missing")}</span></td>
        <td style="font-weight:600;">${escapeHtml(fl.title)}</td>
        <td style="color:#475569;">${escapeHtml(fl.detail)}<div style="margin-top:3px;font-size:11px;color:#64748b;">${sourceDetails}</div></td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#2563eb;">Investment Committee Diligence Pack</div>
          <h2 style="margin:4px 0 0;font-size:20px;border:none;padding:0;color:#0f172a;text-transform:none;letter-spacing:normal;">${escapeHtml(f.companyName)}</h2>
          <div style="font-size:12px;color:#475569;margin-top:2px;">
            ${escapeHtml(f.sector || "B2B Software")} &middot; ${escapeHtml(f.country || "Global")} &middot; Founders: ${escapeHtml(founderNames)}
          </div>
        </div>
        <div style="text-align:right;">
          <span class="badge ${deal.band === "Priority" ? "badge-green" : deal.band === "Review" ? "badge-amber" : "badge-red"}" style="font-size:12px;padding:4px 10px;">
            Band: ${escapeHtml(deal.band)}
          </span>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Workflow Status: <strong>${escapeHtml(status)}</strong></div>
        </div>
      </div>
    </div>

    <h2>1. Executive Summary &amp; Investment Thesis</h2>
    <p style="font-size:13px;line-height:1.6;color:#334155;">
      ${escapeHtml(deal.ai.summary || `${f.companyName} is a ${f.sector} startup raising ${askStr} in Seed financing.`)}
    </p>

    <div class="grid">
      <div class="kpi">
        <div class="kpi-label">Round Target</div>
        <div class="kpi-val">${escapeHtml(askStr)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Screener Recommendation</div>
        <div class="kpi-val" style="color:${deal.band === "Priority" ? "#047857" : deal.band === "Review" ? "#b45309" : "#b91c1c"};">${escapeHtml(deal.band)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Math Gap Flags</div>
        <div class="kpi-val" style="color:${conflictCount > 0 ? "#b91c1c" : "#047857"};">${conflictCount} Detected</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Lead Partner</div>
        <div class="kpi-val" style="font-size:14px;padding-top:2px;">${escapeHtml(leadPartner)}</div>
      </div>
    </div>

    <h2>2. Deterministic Financial Cross-Check &amp; Math Gap Audit</h2>
    <p style="font-size:12px;color:#64748b;margin:0 0 8px;">
      Cross-checks compare founder pitch deck slide statements against raw monthly CSV rows. Discrepancies exceeding 10% are flagged deterministically.
    </p>
    ${deal.flags.length > 0 ? `<table>
      <thead>
        <tr>
          <th style="width:90px;">Type</th>
          <th style="width:180px;">Metric</th>
          <th>Diligence Detail &amp; Provenance</th>
        </tr>
      </thead>
      <tbody>${flagRows}</tbody>
    </table>` : `<p style="font-size:13px;color:#047857;">All stated slide claims corroborate with the provided monthly numbers sheet without math discrepancies.</p>`}

    <h2>3. Institutional Scorecard &amp; Rubric Assessment</h2>
    <table>
      <thead>
        <tr>
          <th style="width:140px;">Dimension</th>
          <th style="width:110px;">Rating</th>
          <th>Evidence &amp; Analysis</th>
        </tr>
      </thead>
      <tbody>${scoreRows}</tbody>
    </table>

    <h2>4. Investment Committee Sign-off &amp; Decision Record</h2>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#ffffff;margin-top:8px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:12px;">
        <div>
          <div style="color:#64748b;font-weight:600;text-transform:uppercase;font-size:10px;">IC Decision</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${escapeHtml(status)}</div>
        </div>
        <div>
          <div style="color:#64748b;font-weight:600;text-transform:uppercase;font-size:10px;">Review Date</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
        </div>
      </div>
      <div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px dashed #cbd5e1;padding-top:16px;">
        <div>
          <div style="border-bottom:1px solid #0f172a;width:180px;height:24px;"></div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Lead Partner Signature</div>
        </div>
        <div>
          <div style="border-bottom:1px solid #0f172a;width:180px;height:24px;"></div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Managing Partner Sign-off</div>
        </div>
      </div>
    </div>
  `;

  return openPrintableReport(
    `IC Diligence Memo: ${f.companyName}`,
    `${f.sector || "Startup"} Seed Round Review &middot; Aarka Fund I`,
    bodyHtml,
  );
}

export { escapeHtml };
