// Display helpers shared by server and browser.

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", AED: "AED ", SAR: "SAR ", GBP: "£", EUR: "€" };

export function fmtMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null) return "—";
  const cur = (currency || "").toUpperCase();
  const sym = SYMBOLS[cur] ?? (cur ? `${cur} ` : "");
  const abs = Math.abs(amount);
  if (cur === "INR") {
    if (abs >= 10_000_000) return `${sym}${trim(amount / 10_000_000)} Cr`;
    if (abs >= 100_000) return `${sym}${trim(amount / 100_000)} L`;
    return `${sym}${amount.toLocaleString("en-IN")}`;
  }
  if (abs >= 1_000_000_000) return `${sym}${trim(amount / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sym}${trim(amount / 1_000_000)}M`;
  if (abs >= 1_000) return `${sym}${trim(amount / 1_000)}K`;
  return `${sym}${amount}`;
}

function trim(n: number): string {
  return (+n.toFixed(2)).toString();
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtMonth(ym: string | null | undefined): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MONTHS[m - 1]} ${y}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}
