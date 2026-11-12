"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMyCompanies } from "./scope";
import { useWorkspace } from "./workspace";
import { cx } from "./ui";
import { usd } from "@/lib/rules";

/** The Portfolio heading and its two views: the companies, and what's missing from them. */
export function PortfolioHeader() {
  const cos = useMyCompanies();
  const w = useWorkspace();
  const path = usePathname();
  const invested = cos.reduce((a, c) => a + c.investment.amountUsd, 0);
  const tabs = [
    { href: "/portfolio", label: "Companies", active: path === "/portfolio" },
    { href: "/portfolio/reporting", label: "What's missing", active: path.startsWith("/portfolio/reporting") },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{w.role === "Analyst" ? "My companies" : "Portfolio"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {w.role === "Analyst" ? `The ${cos.length} companies you look after` : `${cos.length} companies`} · {usd(invested)} invested · one line on
          each, so you know where to look first.
        </p>
      </div>
      <nav aria-label="Portfolio views" className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t.active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
