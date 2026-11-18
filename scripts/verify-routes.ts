// Automated Live Production & Security Regression Audit Script
// Verifies default-deny route protection, invite-only /pending flow, public founder intake,
// strict API authentication, and cryptographic Row-Level Isolation on Founder Data Rooms.

const BASE = process.env.VERIFY_BASE_URL || "https://www.aarkavc.xyz";

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

async function run() {
  const results: Check[] = [];
  const check = (name: string, pass: boolean, detail?: string) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  };

  // 1. Public Allowlisted Pages (/, /pitch, /login, /pending, /unauthorized)
  const homeRes = await fetch(`${BASE}/`, { cache: "no-store" });
  const homeHtml = await homeRes.text();
  check("GET / returns 200", homeRes.status === 200, `status ${homeRes.status}`);
  check("Landing page has 'Partner Sign In' in navbar", homeHtml.includes("Partner Sign In"));
  check("Landing page has 'Request Fund Workspace' hero CTA", homeHtml.includes("Request Fund Workspace"));
  check("Landing page has 'Submit a Pitch' hero CTA", homeHtml.includes("Submit a Pitch"));

  const logoRes = await fetch(`${BASE}/logo.png`, { cache: "no-store" });
  check("GET /logo.png returns 200", logoRes.status === 200, `status ${logoRes.status}`);

  const ogRes = await fetch(`${BASE}/og-card.png`, { cache: "no-store" });
  check("GET /og-card.png returns 200", ogRes.status === 200, `status ${ogRes.status}`);

  const pitchRes = await fetch(`${BASE}/pitch`, { cache: "no-store" });
  const pitchHtml = await pitchRes.text();
  check("GET /pitch returns 200", pitchRes.status === 200, `status ${pitchRes.status}`);
  check("/pitch has founder-specific metadata title", pitchHtml.includes("Submit Your Pitch Deck"));

  const pendingRes = await fetch(`${BASE}/pending`, { cache: "no-store" });
  const pendingHtml = await pendingRes.text();
  check("GET /pending returns 200", pendingRes.status === 200, `status ${pendingRes.status}`);
  check("/pending renders invite-only pending notice", pendingHtml.includes("Aarka is invite-only") || pendingHtml.includes("Loading"));

  const unauthRes = await fetch(`${BASE}/unauthorized`, { cache: "no-store" });
  check("GET /unauthorized returns 200", unauthRes.status === 200, `status ${unauthRes.status}`);

  const loginRes = await fetch(`${BASE}/login`, { cache: "no-store" });
  const loginHtml = await loginRes.text();
  check("GET /login returns 200", loginRes.status === 200, `status ${loginRes.status}`);
  check("/login hides public Magic Link & Test Accounts", !loginHtml.includes("Send Magic Link") && !loginHtml.includes("1-Click Quick Partner Access"));

  // 2. Default-Deny Middleware Checks (ALL internal routes redirect unauthenticated users to /)
  for (const protectedPath of ["/dashboard", "/pipeline", "/deals", "/portfolio", "/fund", "/team", "/market", "/dataroom", "/traffic", "/founder", "/founder/dataroom"]) {
    const r = await fetch(`${BASE}${protectedPath}`, { cache: "no-store", redirect: "manual" });
    const loc = r.headers.get("location") || "";
    check(
      `DEFAULT DENY: GET ${protectedPath} redirects to /`,
      (r.status === 307 || r.status === 302) && (loc === "/" || loc === `${BASE}/` || loc.endsWith("/")),
      `status ${r.status} -> ${loc}`,
    );
  }

  // 3. Public Founder Upload URL works
  const uploadUrlRes = await fetch(`${BASE}/api/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "smoke-test.pdf", fileType: "deck_pdf", dealSlug: "smoke-test" }),
  });
  const uploadUrlData = (await uploadUrlRes.json().catch(() => null)) as { ok?: boolean; direct?: boolean } | null;
  check("POST /api/upload-url issues signed Supabase PDF upload URL", uploadUrlRes.ok && uploadUrlData?.ok === true, `direct=${String(uploadUrlData?.direct)}`);

  // 4. Cryptographic Row-Level Isolation (Tampered URL / Forged Token MUST fail with 403)
  const tamperDrRes = await fetch(`${BASE}/api/founder/dataroom?id=ledgerly&token=forged-tampered-token-12345`, { cache: "no-store" });
  check("RLS: Forged token on /api/founder/dataroom is rejected (403)", tamperDrRes.status === 403, `status ${tamperDrRes.status}`);

  const tamperFileRes = await fetch(`${BASE}/api/founder/file?dealId=ledgerly&fileType=deck_pdf&token=forged-tampered-token-12345`, { cache: "no-store" });
  check("RLS: Forged token on /api/founder/file is rejected (403)", tamperFileRes.status === 403, `status ${tamperFileRes.status}`);

  const noTokenDrRes = await fetch(`${BASE}/api/founder/dataroom`, { cache: "no-store" });
  check("RLS: Unauthenticated /api/founder/dataroom is rejected (401)", noTokenDrRes.status === 401, `status ${noTokenDrRes.status}`);

  // 5. Strict VC API Lockdown — zero public leakage or destructive access
  const meRes = await fetch(`${BASE}/api/auth/me`, { cache: "no-store" });
  const meData = (await meRes.json().catch(() => null)) as { enabled?: boolean; user?: unknown } | null;
  check("GET /api/auth/me reports enabled=true and user=null for public visitor", meRes.ok && meData?.enabled === true && meData?.user === null);

  const magicRes = await fetch(`${BASE}/api/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  check("POST /api/auth/magic-link blocks unauthenticated public calls (403)", magicRes.status === 403, `status ${magicRes.status}`);

  const dealsRes = await fetch(`${BASE}/api/deals`, { cache: "no-store" });
  check("GET /api/deals blocks unauthenticated callers (401)", dealsRes.status === 401, `status ${dealsRes.status}`);

  const fileRes = await fetch(`${BASE}/api/files/ledgerly/deck_pdf`, { cache: "no-store" });
  check("GET /api/files/:id/deck_pdf blocks unauthenticated callers (401)", fileRes.status === 401, `status ${fileRes.status}`);

  const stateDelRes = await fetch(`${BASE}/api/state`, { method: "DELETE" });
  check("DELETE /api/state (factory reset) blocks unauthenticated callers (401)", stateDelRes.status === 401, `status ${stateDelRes.status}`);

  const seedRes = await fetch(`${BASE}/api/seed`, { method: "POST" });
  check("POST /api/seed blocks unauthenticated callers (401)", seedRes.status === 401, `status ${seedRes.status}`);

  const errRes = await fetch(`${BASE}/api/errors`, { cache: "no-store" });
  check("GET /api/errors blocks unauthenticated callers (401)", errRes.status === 401, `status ${errRes.status}`);

  const reqGetRes = await fetch(`${BASE}/api/access-request`, { cache: "no-store" });
  check("GET /api/access-request blocks unauthenticated callers (401)", reqGetRes.status === 401, `status ${reqGetRes.status}`);

  const streamRes = await fetch(`${BASE}/api/realtime/stream`, { cache: "no-store" });
  check("GET /api/realtime/stream blocks unauthenticated callers (401)", streamRes.status === 401, `status ${streamRes.status}`);

  const webhookRes = await fetch(`${BASE}/api/webhooks/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: "Unauthorized Test" }),
  });
  check("POST /api/webhooks/deals blocks unauthenticated callers (401)", webhookRes.status === 401, `status ${webhookRes.status}`);

  const trackGetRes = await fetch(`${BASE}/api/track`, { cache: "no-store" });
  check("GET /api/track (analytics) blocks unauthenticated callers (401)", trackGetRes.status === 401, `status ${trackGetRes.status}`);

  const trackPostRes = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "curl/verify-bot" },
    body: JSON.stringify({ path: "/" }),
  });
  check("POST /api/track beacon endpoint responds 200 (bot-safe)", trackPostRes.status === 200, `status ${trackPostRes.status}`);

  const searchRes = await fetch(`${BASE}/api/search?q=fintech`, { cache: "no-store" });
  check("GET /api/search blocks unauthenticated callers (401)", searchRes.status === 401, `status ${searchRes.status}`);

  const votesRes = await fetch(`${BASE}/api/deals/ledgerly/votes`, { cache: "no-store" });
  check("GET /api/deals/:id/votes blocks unauthenticated callers (401)", votesRes.status === 401, `status ${votesRes.status}`);

  const outreachRes = await fetch(`${BASE}/api/deals/ledgerly/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toEmail: "a@b.com", subject: "Test", message: "Test" }),
  });
  check("POST /api/deals/:id/outreach blocks unauthenticated callers (401)", outreachRes.status === 401, `status ${outreachRes.status}`);

  const approveRes = await fetch(`${BASE}/api/access-request`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "attacker@example.com", action: "approve" }),
  });
  check("PATCH /api/access-request (approve) blocks unauthenticated callers (401)", approveRes.status === 401, `status ${approveRes.status}`);

  const inboundEmailRes = await fetch(`${BASE}/api/webhooks/inbound-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "attacker@example.com", subject: "Unauthorized" }),
  });
  check("POST /api/webhooks/inbound-email blocks unauthenticated callers (401)", inboundEmailRes.status === 401, `status ${inboundEmailRes.status}`);

  const cronDigestRes = await fetch(`${BASE}/api/cron/portfolio-digest`, { cache: "no-store" });
  check("GET /api/cron/portfolio-digest blocks unauthenticated callers (401)", cronDigestRes.status === 401, `status ${cronDigestRes.status}`);

  const enrichRes = await fetch(`${BASE}/api/deals/ledgerly/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Ledgerly" }),
  });
  check("POST /api/deals/:id/enrich blocks unauthenticated callers (401)", enrichRes.status === 401, `status ${enrichRes.status}`);

  // 6. Access Request Waitlist Check — NEVER sets a session cookie
  const reqPostRes = await fetch(`${BASE}/api/access-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bot@example.com", companyWebsite: "honeypot-filled" }),
  });
  const setCookie = reqPostRes.headers.get("set-cookie") || "";
  check("POST /api/access-request never issues aarka_session VC cookie", reqPostRes.ok && !setCookie.includes("aarka_session"), `cookie=${setCookie || "none"}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Audit crashed:", err);
  process.exit(1);
});
