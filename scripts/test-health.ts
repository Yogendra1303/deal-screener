// Tests the reporting health score and the portfolio flags on the fictional portfolio.
// Code only, no AI. Run with `npm test`.
import { PORTFOLIO, portfolioById } from "../lib/portfolio/data";
import {
  DEMO_DATE,
  companyHealth,
  dueDateFor,
  fundHealth,
  lastDueMonth,
  missingItems,
  monthStatus,
  nextReportMonth,
  portfolioFlags,
  stripMonths,
} from "../lib/portfolio/health";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const today = DEMO_DATE;
const c = (id: string) => portfolioById(id)!;

check("report due on the 15th of the next month", dueDateFor("2026-12") === "2027-01-15", dueDateFor("2026-12"));
check("last due month on 29 Oct is September", lastDueMonth(today) === "2026-09", lastDueMonth(today));
check("last due month on 10 Oct is August", lastDueMonth("2026-10-10") === "2026-08", lastDueMonth("2026-10-10"));
check("strip shows Apr to Oct", stripMonths(today).join(",") === "2026-04,2026-05,2026-06,2026-07,2026-08,2026-09,2026-10", stripMonths(today).join(","));

const expected: Record<string, [string, string]> = {
  kitebay: ["On track", "Responsive"],
  mandiwise: ["Slipping", "Responsive"],
  sehatflow: ["Gone quiet", "Slow"],
  brightcart: ["On track", "Slow"],
  voltnest: ["On track", "Responsive"],
  nestara: ["Too early", "Responsive"],
};
for (const co of PORTFOLIO) {
  const ch = companyHealth(co, today);
  const fh = fundHealth(co, today);
  const [wantC, wantF] = expected[co.id];
  check(`${co.name}: company ${wantC}`, ch.band === wantC, `${ch.band}: ${ch.reasons.join(" ")}`);
  check(`${co.name}: fund ${wantF}`, fh.band === wantF, `${fh.band}: ${fh.reasons.join(" ")}`);
}

check("Mandiwise reason names the late August report", companyHealth(c("mandiwise"), today).reasons.some((r) => r.includes("Aug") && r.includes("18 days")));
check("Voltnest August is excused", monthStatus(c("voltnest"), "2026-08", today) === "excused");
check("Sehatflow September is missing", monthStatus(c("sehatflow"), "2026-09", today) === "missing");
check("October is not due yet", monthStatus(c("kitebay"), "2026-10", today) === "not due");
check("Nestara April is before investment", monthStatus(c("nestara"), "2026-04", today) === "before investment");

const kinds = (id: string) => portfolioFlags(c(id), today).map((f) => f.kind).sort().join(",");
check("Kitebay: no flags", kinds("kitebay") === "", kinds("kitebay"));
check("Mandiwise: behind the deck's plan", kinds("mandiwise") === "plan", kinds("mandiwise"));
check("Sehatflow: short runway", kinds("sehatflow") === "runway", kinds("sehatflow"));
check("Voltnest: revenue jump and form vs MIS mismatch", kinds("voltnest") === "mismatch,move", kinds("voltnest"));

const sehatMissing = missingItems(c("sehatflow"), today).map((m) => m.what);
check("Sehatflow owes Aug, Sep and the Q2 board deck", sehatMissing.length === 4 && sehatMissing.includes("Q2 board deck"), sehatMissing.join(" | "));
check("Sehatflow's next report is August", nextReportMonth(c("sehatflow"), today) === "2026-08");
check("Kitebay's next report is October", nextReportMonth(c("kitebay"), today) === "2026-10");

// A report that arrives today moves Sehatflow off "Gone quiet".
const caughtUp = {
  ...c("sehatflow"),
  reports: c("sehatflow").reports.map((r) =>
    r.month === "2026-08" ? { ...r, receivedAt: today, fileName: "x.pdf", numbers: { revenue: { value: 1, page: 2 } } } : r,
  ),
};
check("a new report moves Sehatflow to Slipping", companyHealth(caughtUp, today).band === "Slipping", companyHealth(caughtUp, today).reasons.join(" "));

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
