// Automated Live Production & Security Regression Audit Script
// Verifies landing page CTA hierarchy, public founder intake, strict API authentication, and zero leaked VC sessions.

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

  // 1. Landing Page HTML & CTA Hierarchy
  const homeRes = await fetch(`${BASE}/`, { cache: "no-store" });
  const homeHtml = await homeRes.text();
  check("GET / returns 200", homeRes.status === 200, `status ${homeRes.status}`);
  check("Landing page has 'Partner Sign In' in navbar", homeHtml.includes("Partner Sign In"));
  check("Landing page has 'Explore the Platform' button", homeHtml.includes("Explore the Platform"));
  check("Landing page has 'Submit a Pitch' hero CTA", homeHtml.includes("Submit a Pitch"));
  check("Landing page removed top-nav 'Request Access' text link", !homeHtml.includes(">Request Access<"));

  const logoRes = await fetch(`${BASE}/logo.png`, { cache: "no-store" });
  check("GET /logo.png returns 200", logoRes.status === 200, `status ${logoRes.status}`);

  const ogRes = await fetch(`${BASE}/og-card.png`, { cache: "no-store" });
  check("GET /og-card.png returns 200", ogRes.status === 200, `status ${ogRes.status}`);

  // 2. Public Founder Pitch Page (/pitch) & Signed Upload URL
  const pitchRes = await fetch(`${BASE}/pitch`, { cache: "no-store" });
  const pitchHtml = await pitchRes.text();
  check("GET /pitch returns 200", pitchRes.status === 200, `status ${pitchRes.status}`);
  check("/pitch has founder-specific metadata title", pitchHtml.includes("Submit Your Pitch Deck"));
  check("/pitch renders valid form shell", pitchHtml.includes("Submit your pitch") || pitchHtml.includes("Loading pitch form"));

  const uploadUrlRes = await fetch(`${BASE}/api/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "smoke-test.pdf", fileType: "deck_pdf", dealSlug: "smoke-test" }),
  });
  const uploadUrlData = (await uploadUrlRes.json().catch(() => null)) as { ok?: boolean; direct?: boolean } | null;
  check("POST /api/upload-url issues signed Supabase PDF upload URL", uploadUrlRes.ok && uploadUrlData?.ok === true, `direct=${String(uploadUrlData?.direct)}`);

  // 3. Login Page (/login) — strictly Google Sign-In, zero public magic link or test accounts
  const loginRes = await fetch(`${BASE}/login`, { cache: "no-store" });
  const loginHtml = await loginRes.text();
  check("GET /login returns 200", loginRes.status === 200, `status ${loginRes.status}`);
  check("/login hides public Magic Link & Test Accounts", !loginHtml.includes("Send Magic Link") && !loginHtml.includes("1-Click Quick Partner Access"));

  const magicRes = await fetch(`${BASE}/api/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "attacker@example.com" }),
  });
  check("POST /api/auth/magic-link blocks unauthenticated public calls (403)", magicRes.status === 403, `status ${magicRes.status}`);

  // 4. Auth status & Protected Routes
  const meRes = await fetch(`${BASE}/api/auth/me`, { cache: "no-store" });
  const meData = (await meRes.json().catch(() => null)) as { enabled?: boolean; user?: unknown } | null;
  check("GET /api/auth/me reports enabled=true and user=null for public visitor", meRes.ok && meData?.enabled === true && meData?.user === null, JSON.stringify(meData));

  const drRes = await fetch(`${BASE}/founder/dataroom`, { cache: "no-store", redirect: "manual" });
  check("GET /founder/dataroom redirects unauthenticated visitor (307)", drRes.status === 307 || drRes.status === 302, `status ${drRes.status}`);

  const drApiRes = await fetch(`${BASE}/api/founder/dataroom`, { cache: "no-store" });
  check("GET /api/founder/dataroom blocks unauthenticated callers (401)", drApiRes.status === 401, `status ${drApiRes.status}`);

  // 5. Strict VC API Lockdown — zero public leakage or destructive access
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

  // 6. Access Request Honeypot / No-Cookie Check
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
