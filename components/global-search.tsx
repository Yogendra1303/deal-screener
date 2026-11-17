"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import type { SearchHit } from "@/lib/search-index";

function fmtAsk(usd: number | null): string {
  if (!usd) return "";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(usd % 1_000_000 === 0 ? 0 : 1)}M`;
  return `$${Math.round(usd / 1_000)}K`;
}

export function GlobalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { hits?: SearchHit[] };
        setHits(Array.isArray(json.hits) ? json.hits : []);
        setActiveIdx(0);
        setOpen(true);
      } catch {
        // aborted or transient
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (open && hits[activeIdx]) {
      setOpen(false);
      router.push(hits[activeIdx].href);
      return;
    }
    setOpen(false);
    router.push(q ? `/deals?q=${encodeURIComponent(q)}` : "/deals");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative flex flex-1 max-w-lg items-center gap-2">
      <form onSubmit={onSubmit} className="relative flex-1">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          name="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          placeholder="Search companies, founders, burn, math gaps…"
          className="w-full rounded-md border border-slate-200 bg-slate-50/60 py-1.5 pr-3 pl-9 text-sm leading-tight text-slate-900 placeholder:text-slate-500 transition-colors focus:border-blue-600 focus:bg-white focus:outline-none"
        />

        {open && query.trim().length >= 2 && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>{loading ? "Searching pitches…" : `${hits.length} semantic matches`}</span>
              <span>↑↓ Navigate · Enter</span>
            </div>
            {hits.length === 0 && !loading ? (
              <p className="px-3.5 py-4 text-xs text-slate-500">
                No deals matched &ldquo;{query.trim()}&rdquo;. Press Enter to search all pitches.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {hits.map((h, i) => (
                  <li key={h.id}>
                    <Link
                      href={h.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "block px-3.5 py-2.5 transition-colors",
                        i === activeIdx ? "bg-blue-50/70" : "hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-slate-900">{h.companyName}</span>
                        <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                          {h.askAmount && <span className="font-mono text-slate-600">{fmtAsk(h.askAmount)}</span>}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                            {h.sector}
                          </span>
                        </div>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{h.snippet}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.matchedFields.slice(0, 3).map((mf) => (
                          <span key={mf} className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-medium text-blue-700">
                            {mf}
                          </span>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
      <Link
        href="/upload"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium leading-tight text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create pitch
      </Link>
    </div>
  );
}
