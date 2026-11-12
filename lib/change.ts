// How a count moved between two periods, said honestly. Growth from zero is undefined, so it is never shown
// as a ratio or a percentage: 0 → 2 is "New activity", 0 → 0 is "No activity". Display only; no rule uses this.

export type ChangeKind = "new" | "none" | "up" | "down" | "flat";

export interface ChangeLabel {
  kind: ChangeKind;
  /** Short text for a table cell, e.g. "+167%", "New · 0→2", "No activity". */
  text: string;
  /** The raw counts behind it, e.g. "8 vs 3". */
  counts: string;
  /** Full sentence for screen readers and tooltips. */
  aria: string;
  /** current / previous − 1, or null when the previous period is zero. */
  value: number | null;
}

export function describeChange(previous: number, current: number, unit = "decks"): ChangeLabel {
  const counts = `${current} vs ${previous}`;
  if (previous === 0 && current === 0) return { kind: "none", text: "No activity", counts, aria: `No ${unit} in either period`, value: null };
  if (previous === 0) return { kind: "new", text: `New · 0→${current}`, counts, aria: `New activity: ${current} ${unit}, none in the period before`, value: null };
  const value = current / previous - 1;
  const pct = Math.round(value * 100);
  const kind: ChangeKind = Math.abs(value) < 0.05 ? "flat" : value > 0 ? "up" : "down";
  const text = `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;
  return { kind, text, counts, aria: `${text}: ${current} ${unit} against ${previous} in the period before`, value };
}
