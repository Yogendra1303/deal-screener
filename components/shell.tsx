"use client";

import { setMode, useMode } from "./mode";
import { DB_TEXT, useDbInfo } from "@/lib/db/client";
import { MODE_TEXT } from "@/lib/mode";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLinks } from "./links-store";
import { usePortfolio } from "./portfolio-store";
import { useStore } from "./store";
import { cx } from "./ui";
import { useWorkspace } from "./workspace";
import { attentionFor, needsAttention } from "@/lib/portfolio/attention";
import { stateOf } from "@/lib/questions";
import { member, type Role } from "@/lib/team";
import { FUND_NAME } from "@/lib/links";
import { fmtDate } from "@/lib/format";

type IconName = "reset" | "week" | "team" | "deals" | "portfolio" | "compare" | "sources" | "rules" | "test" | "library" | "room" | "method" | "market";

const PATHS: Record<IconName, string> = {
  week: "M8 2v3M16 2v3M3.5 9h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Zm3 9h3m-3 3h6",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c2 .8 3 2.6 3 5.3",
  deals: "M3.5 7.5h17M3.5 12h17M3.5 16.5h10M3.5 3.5h17v17h-17z",
  portfolio: "M4 20.5V10m5.33 10.5V4m5.34 16.5V13M20 20.5V7.5",
  compare: "M3.5 4.5h17v15h-17zM3.5 9.5h17M3.5 14.5h17M9 4.5v15",
  sources: "M12 3.5c4.7 0 8.5 1.3 8.5 3s-3.8 3-8.5 3-8.5-1.3-8.5-3 3.8-3 8.5-3Zm-8.5 3v5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-5m-17 5v5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-5",
  rules: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4",
  test: "M9 3.5h6M10 3.5v5.2L4.6 18a1.7 1.7 0 0 0 1.5 2.5h11.8a1.7 1.7 0 0 0 1.5-2.5L14 8.7V3.5M7.5 14h9",
  room: "M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.3H19a1.5 1.5 0 0 1 1.5 1.5v8.7A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18zM8 13.5h8",
  library: "M5 4.5h4v15H5zM10 4.5h4v15h-4zM15.2 5.2l3.8-1 3.6 14.6-3.8 1z",
  method: "M5 3.5h14v17H5zM8.5 7.5h7M8.5 11h2m2.5 0h2.5M8.5 14.5h2m2.5 0h2.5M8.5 18h2m2.5 0h2.5",
  market: "M3.5 20.5h17M6 17v-4M10 17V8M14 17v-6M18 17V5",
  reset: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v3.7h3.7M12 8.5V12l2.5 1.5",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  count?: "week" | "deals" | "portfolio" | "room";
}

/** Partners get the whole fund and the team; analysts get their own work first. */
function mainNav(role: Role): NavItem[] {
  const partner = role === "Partner";
  return [
    { href: "/", label: "Home", icon: "week", match: (p) => p === "/", count: "week" },
    ...(partner ? [{ href: "/team", label: "Team", icon: "team" as IconName, match: (p: string) => p.startsWith("/team") }] : []),
    { href: "/deals", label: "Pitches", icon: "deals", match: (p) => p.startsWith("/deals") || p.startsWith("/new"), count: "deals" },
    { href: "/sectors", label: "Market", icon: "market", match: (p) => p.startsWith("/sectors") },
    { href: "/portfolio", label: "Portfolio", icon: "portfolio", match: (p) => p.startsWith("/portfolio"), count: "portfolio" },
    { href: "/dataroom", label: "Data room", icon: "room", match: (p) => p.startsWith("/dataroom"), count: "room" },
    { href: "/compare", label: "Compare", icon: "compare", match: (p) => p.startsWith("/compare") },
  ];
}

const SETTINGS: { href: string; label: string; icon: IconName; match: (p: string) => boolean; partnerOnly?: boolean }[] = [
  { href: "/method", label: "How numbers work", icon: "method", match: (p) => p.startsWith("/method") },
  { href: "/sources", label: "Where data comes from", icon: "sources", match: (p) => p.startsWith("/sources") },
  { href: "/rules", label: "Fund rules", icon: "rules", match: (p) => p.startsWith("/rules") },
  { href: "/results", label: "Screener test", icon: "test", match: (p) => p.startsWith("/results") },
  { href: "/resources", label: "Founder support", icon: "library", match: (p) => p.startsWith("/resources") },
  { href: "/workspace", label: "Workspace & Reset", icon: "reset", match: (p) => p.startsWith("/workspace") },
];

export function Avatar({ name, size = "sm" }: { name: string; size?: "xs" | "sm" | "md" }) {
  const m = member(name);
  return (
    <span
      title={`${m.name}, ${m.role}`}
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        m.tone,
        size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
      )}
    >
      {m.initials}
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">F</span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-slate-900">Fund Hub</span>
        <span className="block text-[11px] text-slate-500">Prototype · sample data</span>
      </span>
    </Link>
  );
}

export function RoleViewDropdown({ compact = false }: { compact?: boolean }) {
  const w = useWorkspace();
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
      <span className="text-slate-500">Role View:</span>
      <select
        aria-label="Role View"
        value={w.role}
        onChange={(e) => w.setDemoRole(e.target.value as Role)}
        className={cx("cursor-pointer bg-transparent font-semibold text-slate-900 focus:outline-hidden", compact ? "text-xs" : "text-xs sm:text-sm")}
      >
        <option value="Partner">Partner</option>
        <option value="Analyst">Analyst</option>
      </select>
    </label>
  );
}

function UserCard() {
  const w = useWorkspace();
  const router = useRouter();
  const displayName = w.userName || w.me;
  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={displayName} size="md" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
          <div className="truncate text-[11px] text-slate-500">{w.userEmail || w.role}</div>
        </div>
        <span
          className={cx(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            w.role === "Partner" ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200" : "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
          )}
        >
          {w.role}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
          <span className="text-[11px] text-slate-500">Role View:</span>
          <select
            aria-label="Sidebar Role View"
            value={w.role}
            onChange={(e) => w.setDemoRole(e.target.value as Role)}
            className="min-w-0 flex-1 cursor-pointer bg-transparent font-semibold text-slate-900 focus:outline-hidden"
          >
            <option value="Partner">Partner</option>
            <option value="Analyst">Analyst</option>
          </select>
        </label>
        <button
          onClick={() => {
            w.signOut();
            router.replace("/login");
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function useCounts() {
  const store = useStore();
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();
  if (!store.ready || !p.ready || !w.ready || !links.ready) return { week: 0, deals: 0, portfolio: 0, room: 0 };
  const mineOpen = w.questions.filter((q) => stateOf(q, p.today) !== "Answered" && q.owner === w.me).length;
  const partner = w.role === "Partner";
  const mine = (owner?: string) => partner || owner === w.me;
  // Analysts also see new pitches nobody has picked up yet.
  const pitchMine = (id: string) => {
    const o = links.ownerOf(id);
    return partner || !o || o === w.me;
  };
  const isNew = (id: string) => store.statusOf(id) === "New";
  return {
    week: mineOpen,
    deals:
      store.deals.filter((d) => isNew(d.id) && pitchMine(d.id)).length +
      store.unprocessed.filter((u) => isNew(u.id) && pitchMine(u.id)).length +
      links.inbound.filter((i) => isNew(i.id) && pitchMine(i.id) && !store.deals.some((d) => d.id === i.id)).length,
    portfolio: p.companies.filter((c) => mine(c.owner) && needsAttention(attentionFor(c, p.today))).length,
    room: links.requests
      .filter((r) => mine(r.side === "pitch" ? links.ownerOf(r.companyId) : p.get(r.companyId)?.owner))
      .reduce((n, r) => n + r.items.filter((i) => r.answers[i.id]?.state === "Sent" && !r.checked[i.id]).length, 0),
  };
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const counts = useCounts();
  const w = useWorkspace();
  const MAIN = mainNav(w.role);
  const titles = { week: "Open questions waiting on you", deals: "New pitches", portfolio: "Companies that need attention", room: "New files from founders, not checked yet" };
  return (
    <nav aria-label="Main" className="space-y-6">
      <ul className="space-y-0.5">
        {MAIN.map((l) => {
          const active = l.match(path);
          const n = l.count ? counts[l.count] : 0;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium",
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon name={l.icon} />
                <span className="flex-1">{l.label}</span>
                {n > 0 && (
                  <span
                    title={l.count ? titles[l.count] : undefined}
                    className={cx(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active ? "bg-white/20 text-white" : l.count === "room" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700",
                    )}
                  >
                    {n}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div>
        <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">More</p>
        <ul className="space-y-0.5">
          {SETTINGS.filter((l) => !l.partnerOnly || w.role === "Partner").map((l) => {
            const active = l.match(path);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm",
                    active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon name={l.icon} />
                  <span className="flex-1">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function SidebarFooter() {
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();
  const store = useStore();
  const db = useDbInfo();
  const [armed, setArmed] = useState(false);
  const changed = p.changed || w.questionsChanged || links.changed || store.changed;
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3 pb-16 text-[11px] leading-snug text-slate-500">
      <p>
        Demo date <span className="font-medium text-slate-700">{fmtDate(p.today)}</span>. Every company, person and number is fictional.
      </p>
      <p>AI sorts and explains. People decide.</p>
      {db && (
        <p title={DB_TEXT[db.driver].help}>
          Saves: <span className="font-medium text-slate-700">{DB_TEXT[db.driver].short}</span>
        </p>
      )}
      {armed ? (
        <div className="space-y-1.5 rounded-md border border-rose-200 bg-rose-50 p-2">
          <p className="text-rose-800">Delete every change {db?.driver === "none" ? "in this browser" : "for everyone"}? Sample data comes back as shipped.</p>
          <div className="flex gap-1.5">
            <button
              onClick={async () => {
                setArmed(false);
                await resetEverything({ store, p, w, links });
              }}
              className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
            >
              Yes, reset
            </button>
            <button onClick={() => setArmed(false)} className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700">
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setArmed(true)}
          className={cx("block w-full rounded-md border px-2.5 py-1.5 text-left font-semibold", changed ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-slate-100 bg-slate-50 text-slate-400")}
        >
          Reset to factory defaults
        </button>
      )}
    </div>
  );
}

/** Every store back to what ships with the app, in this browser and on the server. */
export async function resetEverything(s: { store: ReturnType<typeof useStore>; p: ReturnType<typeof usePortfolio>; w: ReturnType<typeof useWorkspace>; links: ReturnType<typeof useLinks> }) {
  s.p.reset();
  s.w.resetQuestions();
  s.links.reset();
  setMode("FULL_90");
  await s.store.resetAll();
  // The stores above saved their empty copies a moment ago; make sure none of them lands after the wipe.
  setTimeout(() => s.store.resetAll(), 1500);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      <div className="px-1">
        <Brand />
      </div>
      <UserCard />
      <div className="flex-1">
        <NavList onNavigate={onNavigate} />
      </div>
      <SidebarFooter />
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const w = useWorkspace();
  const [open, setOpen] = useState(false);
  const isPublic = path.startsWith("/founder") || path.startsWith("/login");

  // Everything except the home landing, login and founder pages needs a signed-in person.
  useEffect(() => {
    if (w.ready && !w.session && !isPublic && path !== "/") router.replace("/login");
  }, [w.ready, w.session, isPublic, path, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (path.startsWith("/founder"))
    return (
      <div className="flex min-h-full flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">F</span>
              <span className="text-[15px] font-semibold text-slate-900">{FUND_NAME}</span>
              <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">for founders</span>
            </span>
            <Link href="/founder" className="hidden text-xs text-slate-500 hover:text-slate-900 sm:inline">
              Founder portal · sample data
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 pt-8 pb-20 sm:px-6">{children}</main>
      </div>
    );

  if (path.startsWith("/login") || (path === "/" && w.ready && !w.session)) return <main className="min-h-full">{children}</main>;

  if (!w.ready || !w.session)
    return (
      <div className="grid min-h-full place-items-center text-sm text-slate-500">
        <span>Loading…</span>
      </div>
    );

  return (
    <div className="min-h-full lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 pt-6 pb-20 sm:px-6 lg:px-10 lg:pt-8">
        <ModeBar />
        {children}
      </main>
    </div>
  );
}


/** A slim line on every page when sample data is hidden, so nobody mistakes an empty screen for a bug. */
function ModeBar() {
  const mode = useMode();
  if (mode === "FULL_90") return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span>
        <span className="mr-2 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-700">{mode}</span>
        {MODE_TEXT[mode].help}
      </span>
      <Link href="/workspace" className="font-semibold text-slate-900 hover:underline">
        Change workspace
      </Link>
    </div>
  );
}
