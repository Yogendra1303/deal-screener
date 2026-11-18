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

export { escapeHtml };
