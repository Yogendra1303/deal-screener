"use client";

// Where each number came from, and what the code checks found, in plain words.
// Used on deal pages (full callouts) and in deal tables (one compact cell).
import type { Coverage } from "@/lib/coverage";
import { cx } from "./ui";

export type SourceKey = "deck" | "sheet" | "form" | "email" | "registry" | "profile";

export const SOURCE: Record<SourceKey, { code: string; label: string; help: string }> = {
  deck: { code: "DECK", label: "Pitch deck PDF", help: "Numbers the founder states in the deck." },
  sheet: { code: "CSV", label: "Monthly CSV sheet", help: "The founder's month-by-month numbers, used to check the deck." },
  form: { code: "FORM", label: "Intake form", help: "What the founder typed into the pitch form: stage, round size, country." },
  email: { code: "MAIL", label: "Pitch email", help: "The email the deck arrived with." },
  registry: { code: "REG", label: "Company registry (sample)", help: "Incorporation date and directors. Sample data; no live registry is connected." },
  profile: { code: "PROF", label: "Founder profile (sample)", help: "Past roles from a profile record. Sample data; no live profile site is connected." },
};

/** The short codes shown in tables. An emailed pitch still has its intake details, so it shows FORM. */
export const TABLE_CODE: Partial<Record<SourceKey, "DECK" | "CSV" | "FORM" | "REG">> = { deck: "DECK", sheet: "CSV", form: "FORM", email: "FORM", registry: "REG" };


export interface SourceItem {
  key: SourceKey;
  /** The file or record it came from, when there is one. */
  file?: string | null;
  /** Expected but not on file. */
  absent?: boolean;
  href?: string | null;
}

export function SourcePills({ items, className }: { items: SourceItem[]; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap items-center gap-1.5", className)} aria-label="Sources">
      {items.map((s) => {
        const m = SOURCE[s.key];
        const body = (
          <>
            <CodeTag code={m.code} />
            {m.label}
            {s.file && <span className="max-w-[11rem] truncate font-mono text-[10px] font-normal text-slate-500">{s.file}</span>}
            {s.absent && <span className="font-normal">· not on file</span>}
          </>
        );
        const cls = cx(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
          s.absent ? "border-dashed border-slate-300 bg-white text-slate-400" : "border-slate-200 bg-slate-50 text-slate-700",
        );
        return (
          <li key={s.key} title={`${m.help}${s.absent ? " Not on file for this deal." : ""}`}>
            {s.href && !s.absent ? (
              <a href={s.href} target="_blank" rel="noreferrer" className={cx(cls, "hover:border-slate-300 hover:bg-white")}>
                {body}
              </a>
            ) : (
              <span className={cls}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A compact monochrome source label, used instead of icons: DECK, CSV, FORM, REG, AUDIT. */
export function CodeTag({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cx("inline-block rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tracking-wide text-slate-600", className)}>
      {code}
    </span>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Three plain-English boxes: what matched, what the checks flagged, and what is missing. */
export function CheckSummary({ cover, className, note }: { cover: Coverage | null; className?: string; note?: string }) {
  if (!cover)
    return (
      <div className={cx("rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600", className)}>
        <span className="font-semibold text-slate-900">Not checked yet.</span> The AI hasn&apos;t read this deck, so no numbers have been compared. Screen it to run the checks.
      </div>
    );
  const conflicts = cover.flags.filter((f) => f.kind === "conflict");
  const passed = cover.lines.filter((l) => l.passed);
  const skipped = cover.lines.filter((l) => !l.ran);
  return (
    <div className={cx("grid gap-2 md:grid-cols-3", className)}>
      <Box tone="clear" title={cover.ran ? `${cover.passed} of ${cover.ran} checks matched` : "No checks could run"}>
        {passed.length ? passed.map((l) => l.label).join(" · ") : "Nothing to compare yet."}
        {skipped.length > 0 && (
          <span className="mt-1 block text-slate-500" title={skipped.map((l) => `${l.label}: ${l.why}`).join("\n")}>
            Not run: {skipped.map((l) => l.label.split(":")[0].toLowerCase()).join(", ")}.
          </span>
        )}
      </Box>
      <Box tone={conflicts.length ? "alert" : "neutral"} title={conflicts.length ? `${plural(conflicts.length, "gap")} over 10% flagged` : "No gaps over 10%"}>
        {conflicts.length ? (
          <ul className="space-y-0.5">
            {conflicts.map((f) => (
              <li key={f.checkId + f.title}>{f.title}</li>
            ))}
          </ul>
        ) : (
          "Every number that could be compared agrees within 10%. Gap = (deck value − checked value) ÷ checked value."
        )}
      </Box>
      <Box tone={cover.missing.length ? "review" : "neutral"} title={cover.missing.length ? `${plural(cover.missing.length, "core fact")} missing` : "8 of 8 core facts stated"}>
        {cover.missing.length ? `Not in the submission: ${cover.missing.join(", ")}. Ask the founder.` : "The 8 screening facts only: revenue, growth, customers, team, round, founding year, burn, past roles. Diligence items such as valuation and customer concentration are on the Diligence tab."}
      </Box>
      {note && <p className="text-[11px] text-slate-500 md:col-span-3">{note}</p>}
    </div>
  );
}

const BOX: Record<"clear" | "alert" | "review" | "neutral", string> = {
  clear: "border-emerald-200 bg-emerald-50/60",
  alert: "border-red-200 bg-red-50/70",
  review: "border-amber-200 bg-amber-50/70",
  neutral: "border-slate-200 bg-slate-50",
};
const BOX_TITLE: Record<keyof typeof BOX, string> = { clear: "text-emerald-800", alert: "text-red-800", review: "text-amber-800", neutral: "text-slate-700" };

const DOT: Record<keyof typeof BOX, string> = { clear: "bg-emerald-600", alert: "bg-rose-600", review: "bg-amber-500", neutral: "bg-slate-400" };

export function Dot({ tone }: { tone: keyof typeof BOX }) {
  return <span aria-hidden className={cx("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} />;
}

function Box({ tone, title, children }: { tone: keyof typeof BOX; title: string; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-lg border px-3 py-2.5", BOX[tone])}>
      <p className={cx("flex items-center gap-1.5 text-sm font-semibold", BOX_TITLE[tone])}>
        <Dot tone={tone} />
        {title}
      </p>
      <div className="mt-1 text-xs leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

const STATUS = "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide leading-tight";
const STATUS_TONE = {
  alert: "bg-rose-100 text-rose-800",
  review: "bg-amber-100 text-amber-800",
  clear: "bg-emerald-100 text-emerald-800",
  neutral: "bg-slate-100 text-slate-600",
} as const;

export function StatusPill({ tone, children, title }: { tone: keyof typeof STATUS_TONE; children: React.ReactNode; title?: string }) {
  return (
    <span className={cx(STATUS, STATUS_TONE[tone])} title={title}>
      {children}
    </span>
  );
}

/** One table cell: a status pill (gaps, missing facts, matched or unscreened) and the source files as code badges on a single clean row. */
export function ChecksCell({ cover, sources, onOpen }: { cover: Coverage | null; sources?: SourceKey[]; onOpen?: (code: string) => void }) {
  const codes = [...new Set((sources ?? []).map((s) => TABLE_CODE[s]).filter(Boolean))] as string[];
  const NAME: Record<string, string> = { DECK: "Pitch deck", CSV: "Monthly sheet", FORM: "Intake form", REG: "Registry record" };
  const src = codes.length ? (
    <span className="inline-flex shrink-0 items-center gap-1" aria-label="Files on record">
      {codes.map((c) =>
        onOpen ? (
          <button
            key={c}
            type="button"
            title={`${NAME[c]}: click to preview or download`}
            aria-label={`${NAME[c]}: preview or download`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpen(c);
            }}
            className="inline-flex items-center rounded transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1"
          >
            <CodeTag code={c} className="hover:border-slate-400 hover:text-slate-900" />
          </button>
        ) : (
          <span key={c} title={NAME[c]} className="inline-flex items-center">
            <CodeTag code={c} />
          </span>
        ),
      )}
    </span>
  ) : null;
  if (!cover)
    return (
      <span className="inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
        <StatusPill tone="neutral" title="The AI hasn't read this deck yet, so nothing has been compared.">
          Unscreened
        </StatusPill>
        {src}
      </span>
    );
  const conflicts = cover.flags.filter((f) => f.kind === "conflict");
  const tip = [
    cover.ran ? `${cover.passed} of ${cover.ran} checks matched.` : "No checks could run.",
    ...conflicts.map((f) => `Gap: ${f.title}`),
    cover.missing.length ? `Missing: ${cover.missing.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className="inline-flex flex-nowrap items-center gap-1.5 whitespace-nowrap" title={tip}>
      <span className="inline-flex items-center gap-1">
        {conflicts.length > 0 ? (
          <StatusPill tone="alert">{plural(conflicts.length, "Math Gap")}</StatusPill>
        ) : cover.missing.length > 0 ? (
          <StatusPill tone="review">{plural(cover.missing.length, "Missing Fact")}</StatusPill>
        ) : (
          <StatusPill tone="clear">{cover.ran ? `${cover.passed}/${cover.ran} Matched` : "Clear"}</StatusPill>
        )}
        {conflicts.length > 0 && cover.missing.length > 0 && (
          <span className="inline-flex items-center whitespace-nowrap rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide leading-tight text-amber-800" title={`Also missing: ${cover.missing.join(", ")}`}>
            +{cover.missing.length} missing
          </span>
        )}
      </span>
      {src}
    </span>
  );
}
