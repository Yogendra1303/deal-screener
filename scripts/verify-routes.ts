// Automated Live Production & Regression Audit Script
// Verifies landing page CTA hierarchy, public portals, API health, and error telemetry.

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

  // 2. Submit Pitch Page (/pitch)
  const pitchRes = await fetch(`${BASE}/pitch`, { cache: "no-store" });
  const pitchHtml = await pitchRes.text();
  check("GET /pitch returns 200", pitchRes.status === 200, `status ${pitchRes.status}`);
  check("/pitch renders valid page shell", pitchHtml.includes("Submit your pitch") || pitchHtml.includes("Loading pitch form"));

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

  // 4. Founder Data Room (/founder/dataroom)
  const drRes = await fetch(`${BASE}/founder/dataroom`, { cache: "no-store" });
  check("GET /founder/dataroom returns 200", drRes.status === 200, `status ${drRes.status}`);

  // 5. Core APIs
  const dealsRes = await fetch(`${BASE}/api/deals`, { cache: "no-store" });
  const dealsData = (await dealsRes.json().catch(() => null)) as { deals?: unknown[] } | null;
  check("GET /api/deals returns live Supabase deals", dealsRes.ok && (dealsData?.deals?.length ?? 0) > 0, `${dealsData?.deals?.length ?? 0} deals`);

  const errRes = await fetch(`${BASE}/api/errors`, { cache: "no-store" });
  const errData = (await errRes.json().catch(() => null)) as { ok?: boolean; count?: number } | null;
  check("GET /api/errors telemetry endpoint online", errRes.ok && errData?.ok === true, `${errData?.count ?? 0} logged`);

  const reqRes = await fetch(`${BASE}/api/access-request`, { cache: "no-store" });
  const reqData = (await reqRes.json().catch(() => null)) as { count?: number } | null;
  check("GET /api/access-request returns stored requests", reqRes.ok && typeof reqData?.count === "number", `${reqData?.count ?? 0} requests`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Audit crashed:", err);
  process.exit(1);
});
