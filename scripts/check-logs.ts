import fs from "node:fs";
import path from "node:path";

interface AuditRow {
  id?: string;
  created_at?: string;
  event_type: string;
  actor_email: string;
  details: Record<string, unknown> | null;
}

// 1. Parse .env.local if present
function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

// 2. Format details payload for clean table display
function formatDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "{}";
  try {
    const str = JSON.stringify(details);
    return str.length > 60 ? str.slice(0, 57) + "..." : str;
  } catch {
    return String(details);
  }
}

// 3. Render clean console table
function printAuditTable(rows: AuditRow[], sourceLabel: string) {
  console.log(`\n================================================================================`);
  console.log(`🔍 AUDIT LOGS — 5 Most Recent Events (Source: ${sourceLabel})`);
  console.log(`================================================================================`);

  if (!rows || rows.length === 0) {
    console.log(`\n  (No audit logs found yet in ${sourceLabel})\n`);
    console.log(`================================================================================\n`);
    return;
  }

  const formattedRows = rows.map((r, i) => ({
    "#": String(i + 1),
    Timestamp: r.created_at ? new Date(r.created_at).toLocaleString("en-US", { hour12: false }) : "N/A",
    "Event Type": r.event_type || "UNKNOWN",
    "Actor Email": r.actor_email || "N/A",
    Details: formatDetails(r.details),
  }));

  console.table(formattedRows);

  console.log(`Raw Records:`);
  rows.forEach((r, idx) => {
    console.log(`\n[${idx + 1}] ${r.event_type} at ${r.created_at ?? "unknown time"}`);
    console.log(`    Actor:   ${r.actor_email}`);
    console.log(`    Details: ${JSON.stringify(r.details, null, 2)}`);
  });
  console.log(`\n================================================================================\n`);
}

async function main() {
  const envLocal = loadEnvLocal();

  // Extract from CLI flags, process.env, or .env.local
  const args = process.argv.slice(2);
  let cliUrl = "";
  let cliKey = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) cliUrl = args[++i];
    if (args[i] === "--key" && args[i + 1]) cliKey = args[++i];
  }

  const sbUrl = (cliUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const sbKey = cliKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY || envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (sbUrl && sbKey) {
    console.log(`\nConnecting to Supabase at: ${sbUrl}`);
    const endpoint = `${sbUrl}/rest/v1/audit_logs?select=id,created_at,event_type,actor_email,details&order=created_at.desc&limit=5`;
    try {
      const res = await fetch(endpoint, {
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`\n❌ Supabase query failed (${res.status} ${res.statusText}):\n${text}`);
        process.exit(1);
      }

      const rows = (await res.json()) as AuditRow[];
      printAuditTable(rows, `Supabase (${sbUrl})`);
      return;
    } catch (err: unknown) {
      console.error(`\n❌ Error connecting to Supabase:`, err);
      process.exit(1);
    }
  }

  // If no Supabase credentials found, check local fallback files
  console.log(`\n⚠️  No Supabase credentials found in .env.local or environment.`);
  console.log(`   (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are unset).`);
  console.log(`\nChecking local runtime database for cached events...`);

  const localFiles = [
    path.join(process.cwd(), "data", "runtime-db.json"),
    path.join("/tmp", "deal-screener-runtime-db.json"),
  ];

  let localLogs: AuditRow[] = [];
  let foundFile = "";

  for (const f of localFiles) {
    if (fs.existsSync(f)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(f, "utf8")) as { audit_logs?: AuditRow[] };
        if (parsed.audit_logs && Array.isArray(parsed.audit_logs) && parsed.audit_logs.length > 0) {
          localLogs = parsed.audit_logs.slice(0, 5);
          foundFile = f;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (localLogs.length > 0) {
    printAuditTable(localLogs, `Local Store (${foundFile})`);
  } else {
    printAuditTable([], "Supabase / Local Store");
    console.log(`💡 To connect to your Supabase instance:`);
    console.log(`   1. Add to .env.local:`);
    console.log(`      NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co`);
    console.log(`      SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`);
    console.log(`   2. Or run:`);
    console.log(`      npx tsx scripts/check-logs.ts --url <SUPABASE_URL> --key <SUPABASE_KEY>\n`);
  }
}

void main();
