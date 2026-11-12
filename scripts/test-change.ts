// Zero-baseline change labels (audit section 6 and 7). Run with `npm test`.
import { describeChange } from "../lib/change";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)})`}`);
  if (!ok) failed++;
}

const c = (p: number, n: number) => describeChange(p, n);
check("change: 0→0 is No activity, never 0%", c(0, 0).kind === "none" && c(0, 0).text === "No activity", c(0, 0));
check("change: 0→1 is New activity, not a ratio", c(0, 1).text === "New · 0→1" && c(0, 1).value === null, c(0, 1));
check("change: 0→2 is New activity, not 2.0×", c(0, 2).text === "New · 0→2", c(0, 2));
check("change: 1→0 is −100%", c(1, 0).text === "−100%" && c(1, 0).kind === "down", c(1, 0));
check("change: 1→3 is +200%, with raw counts", c(1, 3).text === "+200%" && c(1, 3).counts === "3 vs 1", c(1, 3));
check("change: 3→8 is +167%, not 2.7×", c(3, 8).text === "+167%", c(3, 8));
check("change: equal non-zero counts are 0% and flat", c(4, 4).text === "0%" && c(4, 4).kind === "flat", c(4, 4));
check("change: never Infinity or NaN", [c(0, 5), c(0, 0), c(5, 0)].every((x) => !/Infinity|NaN/.test(x.text)));

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
