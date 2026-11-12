// Builds the sample data: PDF decks, monthly sheets (CSV), form answers, sample registry and
// profile records, and the answer key. Run with `npm run make-samples`.
// Needs Playwright with Chromium (only for this script; the app itself doesn't use it).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { companies } from "./sample-companies.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public", "samples");
const dataDir = path.join(root, "data");
mkdirSync(pub, { recursive: true });
mkdirSync(path.join(dataDir, "fixtures"), { recursive: true });

const THEMES = {
  navy: {
    bg: "#ffffff", ink: "#0f172a", muted: "#64748b", primary: "#1e3a8a", accent: "#2563eb",
    tile: "#eff4ff", rule: "#dbe3f3", titleFont: "Inter", bodyFont: "Inter",
  },
  cream: {
    bg: "#faf6ef", ink: "#292524", muted: "#78716c", primary: "#9a3412", accent: "#c2410c",
    tile: "#f3e8d9", rule: "#e7d8c3", titleFont: "Caladea", bodyFont: "Inter",
  },
  slate: {
    bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8", primary: "#5eead4", accent: "#2dd4bf",
    tile: "#1e293b", rule: "#334155", titleFont: "Inter", bodyFont: "Inter",
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function chartSvg(chart, t) {
  const w = 520, h = 300, padL = 16, padB = 36, top = 40;
  const max = Math.max(...chart.values) * 1.15;
  const bw = (w - padL * 2) / chart.values.length;
  const bars = chart.values
    .map((v, i) => {
      const bh = ((h - padB - top) * v) / max;
      const x = padL + i * bw + bw * 0.18;
      const y = h - padB - bh;
      const label = chart.fmt.replace("{v}", String(v));
      return `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${bh}" rx="4" fill="${t.accent}"/>
        <text x="${x + bw * 0.32}" y="${y - 8}" text-anchor="middle" font-size="15" fill="${t.ink}">${esc(label)}</text>
        <text x="${x + bw * 0.32}" y="${h - 12}" text-anchor="middle" font-size="15" fill="${t.muted}">${esc(chart.labels[i])}</text>`;
    })
    .join("");
  return `<div class="chart"><div class="chart-title">${esc(chart.title)}</div>
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}
    <line x1="${padL}" x2="${w - padL}" y1="${h - padB}" y2="${h - padB}" stroke="${t.rule}"/></svg></div>`;
}

function tiles(stats) {
  return `<div class="tiles">${stats
    .map((s) => `<div class="tile"><div class="tile-value">${esc(s.value)}</div><div class="tile-label">${esc(s.label)}</div></div>`)
    .join("")}</div>`;
}

function slideHtml(s, t, company, n, total) {
  let body = "";
  switch (s.kind) {
    case "cover":
      body = `<div class="cover"><div class="cover-title">${esc(s.title)}</div>
        <div class="cover-tagline">${esc(s.tagline)}</div>
        <div class="cover-meta">${s.meta.map((m) => `<div>${esc(m)}</div>`).join("")}</div></div>`;
      break;
    case "bullets":
      body = `<h1>${esc(s.title)}</h1>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}
        <ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
      break;
    case "stats":
      body = `<h1>${esc(s.title)}</h1><div class="${s.chart ? "split" : ""}">${tiles(s.stats)}${s.chart ? chartSvg(s.chart, t) : ""}</div>`;
      break;
    case "table":
      body = `<h1>${esc(s.title)}</h1><table><thead><tr>${s.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${s.rows.map((r, i) => `<tr class="${i === 0 ? "us" : ""}">${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      break;
    case "team":
      body = `<h1>${esc(s.title)}</h1><div class="people">${s.people
        .map((p) => `<div class="person"><div class="avatar">${esc(p.name.split(" ").map((x) => x[0]).join(""))}</div>
          <div class="pname">${esc(p.name)}</div><div class="prole">${esc(p.role)}</div>
          ${p.lines.map((l) => `<div class="pline">${esc(l)}</div>`).join("")}</div>`)
        .join("")}</div>${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}`;
      break;
    case "round":
      body = `<h1>${esc(s.title)}</h1><p class="ask">${esc(s.ask)}</p><div class="split">
        <ul>${s.items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>${s.stats.length ? tiles(s.stats) : "<div></div>"}</div>`;
      break;
    case "contact":
      body = `<div class="cover"><div class="cover-title small">${esc(s.title)}</div>
        <div class="cover-meta">${s.lines.map((m) => `<div>${esc(m)}</div>`).join("")}</div></div>`;
      break;
  }
  return `<section class="slide">${body}<div class="footer"><span>${esc(company)}</span><span>${n} / ${total}</span></div></section>`;
}

function deckHtml(c) {
  const t = THEMES[c.theme];
  const total = c.slides.length;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 1280px 720px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${t.bg}; color: ${t.ink}; font-family: '${t.bodyFont}', sans-serif; }
    .slide { width: 1280px; height: 720px; padding: 64px 72px; position: relative; page-break-after: always; overflow: hidden; background: ${t.bg}; }
    .slide::before { content: ''; position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: ${t.primary}; }
    h1 { font-family: '${t.titleFont}', serif; font-size: 44px; color: ${t.primary}; margin-bottom: 32px; font-weight: 700; }
    .lead { font-size: 26px; margin-bottom: 24px; max-width: 1050px; line-height: 1.35; }
    ul { list-style: none; }
    li { font-size: 24px; line-height: 1.4; margin-bottom: 18px; padding-left: 28px; position: relative; max-width: 1050px; }
    li::before { content: ''; position: absolute; left: 0; top: 12px; width: 10px; height: 10px; border-radius: 50%; background: ${t.accent}; }
    .cover { height: 100%; display: flex; flex-direction: column; justify-content: center; }
    .cover-title { font-family: '${t.titleFont}', serif; font-size: 96px; font-weight: 800; color: ${t.primary}; }
    .cover-title.small { font-size: 72px; }
    .cover-tagline { font-size: 32px; margin-top: 16px; max-width: 900px; line-height: 1.3; }
    .cover-meta { margin-top: 48px; font-size: 22px; color: ${t.muted}; line-height: 1.6; }
    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-content: start; }
    .tile { background: ${t.tile}; border-radius: 14px; padding: 22px 24px; min-height: 120px; }
    .tile-value { font-size: 40px; font-weight: 800; color: ${t.primary}; }
    .tile-label { font-size: 18px; color: ${t.muted}; margin-top: 6px; line-height: 1.3; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
    .chart-title { font-size: 18px; color: ${t.muted}; margin-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; font-size: 21px; }
    th { text-align: left; color: ${t.muted}; font-weight: 600; padding: 12px 14px; border-bottom: 2px solid ${t.rule}; }
    td { padding: 14px; border-bottom: 1px solid ${t.rule}; }
    tr.us td { font-weight: 700; color: ${t.primary}; }
    .people { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .person { background: ${t.tile}; border-radius: 14px; padding: 28px; }
    .avatar { width: 64px; height: 64px; border-radius: 50%; background: ${t.primary}; color: ${t.bg}; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; margin-bottom: 16px; }
    .pname { font-size: 28px; font-weight: 700; }
    .prole { font-size: 20px; color: ${t.accent}; margin-bottom: 12px; }
    .pline { font-size: 19px; line-height: 1.45; color: ${t.ink}; }
    .note { margin-top: 28px; font-size: 22px; color: ${t.muted}; }
    .ask { font-size: 28px; margin-bottom: 28px; }
    .footer { position: absolute; left: 72px; right: 72px; bottom: 28px; display: flex; justify-content: space-between; font-size: 15px; color: ${t.muted}; }
  </style></head><body>${c.slides.map((s, i) => slideHtml(s, t, c.form.companyName, i + 1, total)).join("")}</body></html>`;
}

function csv(rows) {
  const header = "month,currency,revenue,customers,headcount,net_burn,cash";
  return [header, ...rows.map((r) => [r.month, r.currency, r.revenue, r.customers, r.headcount, r.net_burn, r.cash].join(","))].join("\n") + "\n";
}

const norm = (name) =>
  name
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llc|fz-llc|fzco|inc|technologies|technology)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

async function main() {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const index = [];
  const registry = {};
  const profiles = {};
  const answerKey = {};

  for (const c of companies) {
    await page.setContent(deckHtml(c), { waitUntil: "load" });
    await page.pdf({ path: path.join(pub, `${c.id}.pdf`), width: "1280px", height: "720px", printBackground: true });
    if (c.sheet) writeFileSync(path.join(pub, `${c.id}.csv`), csv(c.sheet));

    index.push({
      id: c.id,
      receivedAt: c.receivedAt,
      form: c.form,
      deckFile: `${c.id}.pdf`,
      sheetFile: c.sheet ? `${c.id}.csv` : null,
    });
    registry[norm(c.form.companyName)] = { ...c.registry, source: "Sample registry record (fictional)" };
    for (const p of c.profiles) profiles[norm(p.name)] = { ...p, source: "Sample profile (fictional)" };
    answerKey[c.id] = { issues: c.expected.issues, band: c.expected.band, planted: c.planted, gold: c.gold };
    console.log(`built ${c.id}: ${c.slides.length} slides${c.sheet ? " + sheet" : ""}`);
  }

  await browser.close();
  writeFileSync(path.join(dataDir, "samples.json"), JSON.stringify(index, null, 2) + "\n");
  writeFileSync(path.join(dataDir, "fixtures", "registry.json"), JSON.stringify(registry, null, 2) + "\n");
  writeFileSync(path.join(dataDir, "fixtures", "profiles.json"), JSON.stringify(profiles, null, 2) + "\n");
  writeFileSync(path.join(dataDir, "answer-key.json"), JSON.stringify(answerKey, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
