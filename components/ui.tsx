"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STATUSES, type Band, type DealResult, type DealStatus, type Level, type Score } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Atlassian Confluence / Linear lozenge colour tokens. */
export type ToneKey = "alert" | "review" | "clear" | "neutral";
export const TONE: Record<ToneKey, string> = {
  alert: "bg-rose-100 text-rose-800 border-rose-200/60",
  review: "bg-amber-100 text-amber-800 border-amber-200/60",
  clear: "bg-emerald-100 text-emerald-800 border-emerald-200/60",
  neutral: "bg-slate-100 text-slate-600 border-slate-200/60",
};

/** Atlassian-style status lozenge. */
export function Tag({ tone = "neutral", children, className, title }: { tone?: ToneKey; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Secondary label above or beside a data point. */
export const LABEL = "text-xs font-medium uppercase tracking-wider text-slate-600 leading-tight";

/** A row of data points, each anchored by a micro-label. */
export function KeyStrip({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="bg-white px-4 py-2.5">
          <dt className={LABEL}>{k}</dt>
          <dd className="mt-1 truncate text-sm font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">{v}</dd>
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
        "inline-flex items-center gap-1.5 rounded-sm font-bold uppercase tracking-wide whitespace-nowrap leading-tight",
        size === "lg" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[11px]",
        BAND_STYLE[band],
      )}
      title={overruled ? "Set by an analyst" : "Set by the rules"}
    >
      {band}
      {overruled && <span className="text-[10px] uppercase tracking-wide opacity-75">analyst</span>}
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
  Reviewing: TONE.review,
  "Meeting set": TONE.clear,
  "On hold": TONE.review,
  Passed: TONE.neutral,
};

export function StatusPill({ status }: { status: DealStatus }) {
  return (
    <span className={cx("inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight", STATUS_STYLE[status])}>
      {status}
    </span>
  );
}

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
}

/** Floating popover dropdown control used across the app. */
export function DropdownSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  prefix,
  id,
  ariaLabel,
  className,
  buttonClassName,
  align = "left",
  size = "md",
  theme = "light",
  required,
}: {
  value: T;
  onChange: (v: T) => void;
  options: (T | DropdownOption<T>)[];
  placeholder?: string;
  prefix?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  size?: "xs" | "sm" | "md";
  theme?: "light" | "dark";
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const normalized: DropdownOption<T>[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);

  const computeCoords = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    const minW = Math.max(r.width, 188);
    const rawLeft = align === "right" ? r.right - minW : r.left;
    const left = Math.max(8, Math.min(window.innerWidth - minW - 8, rawLeft));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const estH = Math.min(264, normalized.length * 34 + 12);
    if (spaceBelow < Math.min(estH, 180) && spaceAbove > spaceBelow) {
      const maxH = Math.min(264, Math.max(120, spaceAbove));
      const top = Math.max(8, r.top - Math.min(estH, maxH) - 4);
      return { top, left, width: minW, maxH };
    }
    const maxH = Math.min(264, Math.max(120, spaceBelow));
    return { top: r.bottom + 4, left, width: minW, maxH };
  };

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const next = computeCoords();
      if (next) setCoords(next);
    };
    updatePosition();
    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, normalized.length]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      const next = computeCoords();
      if (next) setCoords(next);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const dark = theme === "dark";
  const menu =
    open && coords ? (
      <ul
        ref={menuRef}
        role="listbox"
        aria-label={ariaLabel}
        style={{ top: coords.top, left: coords.left, minWidth: coords.width, maxHeight: coords.maxH }}
        className={cx(
          "fixed z-[9999] overflow-y-auto rounded-lg border py-1 shadow-xl",
          dark
            ? "border-white/15 bg-zinc-900 shadow-black/50"
            : "border-slate-200 bg-white shadow-slate-900/15",
        )}
      >
        {normalized.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <li
              key={opt.value}
              role="option"
              aria-selected={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setOpen(false);
              }}
              className={cx(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
                dark
                  ? isSelected
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  : isSelected
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{opt.label}</span>
              {isSelected && (
                <svg viewBox="0 0 24 24" className={cx("h-3.5 w-3.5 shrink-0", dark ? "text-blue-400" : "text-blue-600")} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={ref} className={cx("relative inline-block text-left", className)} onClick={(e) => e.stopPropagation()}>
      {required && <input type="text" tabIndex={-1} aria-hidden value={value} onChange={() => {}} required className="sr-only" />}
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cx(
          "inline-flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-md border font-medium leading-tight shadow-2xs transition-colors",
          dark
            ? open
              ? "border-blue-500 bg-zinc-900/90 text-zinc-100 ring-2 ring-blue-500/20"
              : "border-white/10 bg-zinc-900/80 text-zinc-200 hover:border-white/20 hover:bg-zinc-900"
            : open
              ? "border-blue-500 bg-white text-slate-700 ring-2 ring-blue-500/15"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          size === "xs"
            ? "h-7 px-2 text-[11px]"
            : size === "sm"
              ? "h-8 px-2.5 text-xs"
              : "px-3 py-1.5 text-sm",
          buttonClassName,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          {prefix && <span className={cx("shrink-0", dark ? "text-zinc-400" : "text-slate-400")}>{prefix}</span>}
          <span className={cx("truncate", selected ? (dark ? "text-white" : "text-slate-900") : dark ? "text-zinc-400" : "text-slate-500")}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={cx("h-3.5 w-3.5 shrink-0 transition-transform", dark ? "text-zinc-400" : "text-slate-400", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}

export function StatusSelect({ value, onChange, id }: { value: DealStatus; onChange: (s: DealStatus) => void; id?: string }) {
  return <DropdownSelect id={id} ariaLabel="Status" value={value} onChange={onChange} options={[...STATUSES]} align="right" />;
}

/** One short line on what needs checking: conflicts first, then missing facts. */
export function IssuesChip({ deal }: { deal: DealResult }) {
  const conflicts = deal.flags.filter((f) => f.kind === "conflict").length;
  const missing = deal.flags.some((f) => f.kind === "missing");
  if (conflicts)
    return (
      <span className={cx("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight", TONE.alert)}>
        <span aria-hidden>!</span> {conflicts} {conflicts > 1 ? "issues" : "issue"} to check
      </span>
    );
  if (missing)
    return (
      <span className={cx("inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight", TONE.neutral)}>
        Key facts missing
      </span>
    );
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight", TONE.clear)}>
      <span aria-hidden>✓</span> Numbers check out
    </span>
  );
}

const LEVEL_DOT: Record<Level, string> = {
  Strong: "bg-emerald-600",
  Mixed: "bg-amber-600",
  Weak: "bg-rose-600",
  "Not enough info": "bg-slate-400",
};

const LEVEL_STYLE: Record<Level, string> = {
  Strong: "bg-emerald-100 text-emerald-800",
  Mixed: "bg-amber-100 text-amber-800",
  Weak: "bg-rose-100 text-rose-800",
  "Not enough info": "bg-slate-100 text-slate-600",
};

export function levelText(score: Pick<Score, "key" | "level">): string {
  if (score.key === "fit") return score.level === "Strong" ? "Fits" : "Outside";
  return score.level;
}

export function LevelChip({ score }: { score: Pick<Score, "key" | "level"> }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap leading-tight",
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
  return <div className={cx("rounded-lg border border-slate-200 bg-white shadow-xs", className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold leading-tight text-slate-900">{children}</h2>
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
      className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-500"
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
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium leading-tight shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-blue-600 hover:text-blue-700">
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
        "rounded-md border px-4 py-3 text-sm leading-snug",
        tone === "info" && "border-slate-200 bg-slate-100 text-slate-900",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      {children}
    </div>
  );
}
