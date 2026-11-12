import Link from "next/link";
import { STATUSES, type Band, type DealResult, type DealStatus, type Level, type Score } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** The only colours a tag may use: status or severity. Everything else is slate. */
export type ToneKey = "alert" | "review" | "clear" | "neutral";
export const TONE: Record<ToneKey, string> = {
  alert: "bg-red-50 text-red-700 border-red-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  clear: "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

/** A flat tag with a hairline border, in one of the four tones. */
export function Tag({ tone = "neutral", children, className, title }: { tone?: ToneKey; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold tracking-tight whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

/** Micro-label above or beside a data point. */
export const LABEL = "text-[11px] font-medium uppercase tracking-wider text-slate-500";

/** A row of data points, each anchored by a micro-label. */
export function KeyStrip({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-200/70 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="bg-slate-50 px-3 py-2">
          <dt className={LABEL}>{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-semibold tracking-tight text-slate-900 tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const BAND_STYLE: Record<Band, string> = {
  Priority: TONE.clear,
  Review: TONE.review,
  "Outside focus": TONE.neutral,
};

export function BandBadge({ band, overruled, size = "sm" }: { band: Band; overruled?: boolean; size?: "sm" | "lg" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded border font-semibold tracking-tight whitespace-nowrap",
        size === "lg" ? "px-2.5 py-0.5 text-sm" : "px-1.5 py-px text-[11px]",
        BAND_STYLE[band],
      )}
      title={overruled ? "Set by an analyst" : "Set by the rules"}
    >
      {band}
      {overruled && <span className="text-[10px] uppercase tracking-wide opacity-70">analyst</span>}
    </span>
  );
}

/** What each band means, in the words a partner would use. */
export const BAND_MEANING: Record<Band, string> = {
  Priority: "Worth a meeting soon",
  Review: "Look closer before deciding",
  "Outside focus": "Doesn't match the fund's rules",
};

export const BAND_ACCENT: Record<Band, string> = {
  Priority: "bg-emerald-500",
  Review: "bg-amber-400",
  "Outside focus": "bg-slate-300",
};

const STATUS_STYLE: Record<DealStatus, string> = {
  New: TONE.neutral,
  Reviewing: TONE.neutral,
  "Meeting set": TONE.clear,
  "On hold": TONE.review,
  Passed: TONE.neutral,
};

export function StatusPill({ status }: { status: DealStatus }) {
  return (
    <span className={cx("inline-flex rounded border px-1.5 py-px text-[11px] font-semibold tracking-tight whitespace-nowrap", STATUS_STYLE[status])}>
      {status}
    </span>
  );
}

export function StatusSelect({ value, onChange, id }: { value: DealStatus; onChange: (s: DealStatus) => void; id?: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as DealStatus)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Status"
      className={cx("rounded border py-1 pl-2 pr-7 text-xs font-semibold", STATUS_STYLE[value])}
    >
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

/** One short line on what needs checking: conflicts first, then missing facts. */
export function IssuesChip({ deal }: { deal: DealResult }) {
  const conflicts = deal.flags.filter((f) => f.kind === "conflict").length;
  const missing = deal.flags.some((f) => f.kind === "missing");
  if (conflicts)
    return (
      <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold whitespace-nowrap", TONE.alert)}>
        <span aria-hidden>!</span> {conflicts} {conflicts > 1 ? "issues" : "issue"} to check
      </span>
    );
  if (missing)
    return (
      <span className={cx("inline-flex rounded border px-1.5 py-px text-[11px] font-semibold whitespace-nowrap", TONE.neutral)}>
        Key facts missing
      </span>
    );
  return (
    <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold whitespace-nowrap", TONE.clear)}>
      <span aria-hidden>✓</span> Numbers check out
    </span>
  );
}

const LEVEL_DOT: Record<Level, string> = {
  Strong: "bg-emerald-500",
  Mixed: "bg-amber-400",
  Weak: "bg-red-500",
  "Not enough info": "bg-slate-300",
};

const LEVEL_STYLE: Record<Level, string> = {
  Strong: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Mixed: "bg-amber-50 text-amber-700 ring-amber-200",
  Weak: "bg-red-50 text-red-700 ring-red-200",
  "Not enough info": "bg-slate-100 text-slate-700 ring-slate-200",
};

export function levelText(score: Pick<Score, "key" | "level">): string {
  if (score.key === "fit") return score.level === "Strong" ? "Fits" : "Outside";
  return score.level;
}

export function LevelChip({ score }: { score: Pick<Score, "key" | "level"> }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        LEVEL_STYLE[score.level],
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", LEVEL_DOT[score.level])} />
      {levelText(score)}
    </span>
  );
}

const SHORT: Record<Score["key"], string> = {
  fit: "Fit",
  traction: "Traction",
  consistency: "Consistency",
  team: "Team",
  completeness: "Complete",
};

export function ScoreDots({ scores }: { scores: Score[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {scores.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-1 text-xs text-slate-600"
          title={`${s.label}: ${levelText(s)}. ${s.reason}`}
        >
          <span className={cx("h-2 w-2 rounded-full", LEVEL_DOT[s.level])} />
          {SHORT[s.key]}
        </span>
      ))}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]", className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold text-slate-900">{children}</h2>
      {right}
    </div>
  );
}

export function PageLink({ url, page, quote }: { url: string | null; page?: number | null; quote?: string | null }) {
  if (!page) return <span className="text-slate-400">—</span>;
  const label = `p. ${page}`;
  if (!url)
    return (
      <span className="text-slate-500" title={quote ?? undefined}>
        {label}
      </span>
    );
  return (
    <a
      href={`${url}#page=${page}`}
      target="_blank"
      rel="noreferrer"
      title={quote ? `“${quote}”` : `Open the deck at page ${page}`}
      className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-500"
    >
      {label}
    </a>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-slate-900 text-white hover:bg-slate-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-indigo-700 hover:text-indigo-900">
      {children}
    </Link>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-lg px-4 py-3 text-sm ring-1 ring-inset",
        tone === "info" && "bg-slate-100 text-slate-800 ring-slate-200",
        tone === "warn" && "bg-amber-50 text-amber-900 ring-amber-200",
        tone === "error" && "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      {children}
    </div>
  );
}
