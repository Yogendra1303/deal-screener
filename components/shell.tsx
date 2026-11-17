"use client";

import { setMode, useMode } from "./mode";
import { GlobalSearchBar } from "./global-search";
import { DB_TEXT, hydrate, persist, useDbInfo } from "@/lib/db/client";
import { triggerDealSync } from "@/lib/deal-sync";
import { MODE_TEXT } from "@/lib/mode";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLinks } from "./links-store";
import { usePortfolio } from "./portfolio-store";
import { useStore } from "./store";
import { DropdownSelect, cx } from "./ui";
import { useWorkspace } from "./workspace";
import { attentionFor, latestRunway, needsAttention, WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { missingItems } from "@/lib/portfolio/health";
import { stateOf } from "@/lib/questions";
import { member, type Role } from "@/lib/team";
import { FUND_NAME, SEED_INBOUND } from "@/lib/links";
import { SAMPLES, SEED_RESULTS } from "@/lib/data";
import { fmtDay } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { usd } from "@/lib/rules";

const SEED_IDS = new Set<string>([
  ...Object.keys(SEED_RESULTS),
  ...SAMPLES.map((s) => s.id),
  ...SEED_INBOUND.map((i) => i.id),
]);

type IconName = "reset" | "week" | "team" | "deals" | "portfolio" | "fund" | "compare" | "sources" | "rules" | "test" | "library" | "room" | "method" | "market" | "traffic";

const PATHS: Record<IconName, string> = {
  week: "M8 2v3M16 2v3M3.5 9h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Zm3 9h3m-3 3h6",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c2 .8 3 2.6 3 5.3",
  deals: "M3.5 7.5h17M3.5 12h17M3.5 16.5h10M3.5 3.5h17v17h-17z",
  portfolio: "M4 20.5V10m5.33 10.5V4m5.34 16.5V13M20 20.5V7.5",
  fund: "M12 20.5v-8m-5 8v-4m10 4v-11M3.5 3.5v17h17M7 11l4-4 3 3 5-5",
  compare: "M3.5 4.5h17v15h-17zM3.5 9.5h17M3.5 14.5h17M9 4.5v15",
  sources: "M12 3.5c4.7 0 8.5 1.3 8.5 3s-3.8 3-8.5 3-8.5-1.3-8.5-3 3.8-3 8.5-3Zm-8.5 3v5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-5m-17 5v5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-5",
  rules: "M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4",
  test: "M9 3.5h6M10 3.5v5.2L4.6 18a1.7 1.7 0 0 0 1.5 2.5h11.8a1.7 1.7 0 0 0 1.5-2.5L14 8.7V3.5M7.5 14h9",
  room: "M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.3H19a1.5 1.5 0 0 1 1.5 1.5v8.7A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18zM8 13.5h8",
  library: "M5 4.5h4v15H5zM10 4.5h4v15h-4zM15.2 5.2l3.8-1 3.6 14.6-3.8 1z",
  method: "M5 3.5h14v17H5zM8.5 7.5h7M8.5 11h2m2.5 0h2.5M8.5 14.5h2m2.5 0h2.5M8.5 18h2m2.5 0h2.5",
  market: "M3.5 20.5h17M6 17v-4M10 17V8M14 17v-6M18 17V5",
  reset: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v3.7h3.7M12 8.5V12l2.5 1.5",
  traffic: "M3.5 12h4l2.5-6.5 4 13 2.5-6.5h4",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    ...(partner ? [{ href: "/fund", label: "Fund analytics", icon: "fund" as IconName, match: (p: string) => p.startsWith("/fund") }] : []),
    { href: "/dataroom", label: "Data room", icon: "room", match: (p) => p.startsWith("/dataroom"), count: "room" },
    { href: "/compare", label: "Compare", icon: "compare", match: (p) => p.startsWith("/compare") },
  ];
}

const SETTINGS: { href: string; label: string; icon: IconName; match: (p: string) => boolean; partnerOnly?: boolean }[] = [
  { href: "/method", label: "How numbers work", icon: "method", match: (p) => p.startsWith("/method") },
  { href: "/sources", label: "Where data comes from", icon: "sources", match: (p) => p.startsWith("/sources") },
  { href: "/rules", label: "Fund rules", icon: "rules", match: (p) => p.startsWith("/rules") },
  { href: "/resources", label: "Founder support", icon: "library", match: (p) => p.startsWith("/resources") },
  { href: "/workspace", label: "Workspace settings", icon: "reset", match: (p) => p.startsWith("/workspace") },
  { href: "/traffic", label: "Live site traffic", icon: "traffic", match: (p) => p.startsWith("/traffic"), partnerOnly: true },
];

export function Avatar({ name, size = "sm", image }: { name: string; size?: "xs" | "sm" | "md"; image?: string | null }) {
  const m = member(name);
  const [imgErr, setImgErr] = useState(false);
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (image && !imgErr) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        title={name}
        referrerPolicy="no-referrer"
        onError={() => setImgErr(true)}
        className={cx("shrink-0 rounded-full object-cover ring-1 ring-slate-200", dim)}
      />
    );
  }
  return (
    <span
      title={`${m.name}, ${m.role}`}
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold", m.tone, dim)}
    >
      {m.initials}
    </span>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aarka-logo.png" alt="Aarka" className="h-7 w-7 shrink-0 rounded-md object-cover shadow-xs" />
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900">Aarka</span>
        <span className="block text-[11px] font-medium text-slate-500">Fund I · Active Workspace</span>
      </span>
    </Link>
  );
}

export function RoleViewDropdown({ compact = false }: { compact?: boolean }) {
  const w = useWorkspace();
  return (
    <DropdownSelect<Role>
      ariaLabel="Role View"
      prefix="Role View:"
      value={w.role}
      onChange={(r) => w.setDemoRole(r)}
      options={["Partner", "Analyst"]}
      align="right"
      className={compact ? "text-xs" : ""}
    />
  );
}

function UserCard() {
  const w = useWorkspace();
  const router = useRouter();
  const displayName = w.userName || w.me;
  return (
    <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex items-start gap-2.5">
        <Avatar name={displayName} size="sm" image={w.userImage} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="whitespace-nowrap text-sm font-semibold leading-tight text-slate-900">{displayName}</span>
            <span
              className={cx(
                "inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide leading-tight",
                w.role === "Partner" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800",
              )}
            >
              {w.role}
            </span>
          </div>
          {w.userEmail && <div className="truncate text-xs leading-tight text-slate-500">{w.userEmail}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
        <DropdownSelect<Role>
          ariaLabel="Sidebar Role View"
          prefix="View:"
          value={w.role}
          onChange={(r) => w.setDemoRole(r)}
          options={["Partner", "Analyst"]}
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => {
            w.signOut();
            router.replace("/");
          }}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium leading-tight text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

interface NotificationEntry {
  id: string;
  kind: "pitch" | "portfolio" | "dataroom";
  isLiveSubmission?: boolean;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  sortDate: string;
  urgent?: boolean;
}

function NotificationMenu() {
  const store = useStore();
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pitch" | "portfolio">("all");
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let local: Record<string, boolean> | null = null;
    try {
      const saved = window.localStorage.getItem("ds.notif.read.v1");
      if (saved) {
        local = JSON.parse(saved) as Record<string, boolean>;
        setReadIds(local);
      }
    } catch {
      // ignore
    }
    void hydrate<Record<string, boolean>>(
      "ds.notif.read.v1",
      (remote) => setReadIds((prev) => ({ ...remote, ...prev })),
      local,
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = useMemo<NotificationEntry[]>(() => {
    if (!store.ready || !p.ready || !w.ready || !links.ready) return [];
    const list: NotificationEntry[] = [];
    const partner = w.role === "Partner";
    const pitchMine = (id: string) => {
      const o = links.ownerOf(id);
      return partner || !o || o === w.me;
    };
    const companyMine = (owner?: string) => partner || owner === w.me;

    // 1. Live submitted pitches & unscreened new pitches (only status === "New")
    for (const d of store.deals) {
      const isLive = !SEED_IDS.has(d.id);
      const isNew = store.statusOf(d.id) === "New";
      if (!isNew || (!isLive && !pitchMine(d.id))) continue;
      const founder = d.form.founders?.[0]?.name;
      const rec = d.receivedAt || "";
      list.push({
        id: `pitch-${d.id}`,
        kind: "pitch",
        isLiveSubmission: isLive,
        title: `${d.form.companyName}`,
        subtitle: `${founder ? `${founder} · ` : ""}${d.form.stage}${d.form.amountUsd ? ` · ${usd(d.form.amountUsd)}` : ""} · ${d.form.sector}`,
        meta: `Received ${fmtDay(rec.slice(0, 10))}`,
        href: `/deals/${d.id}`,
        sortDate: rec,
        urgent: isLive && isNew,
      });
    }

    for (const i of links.inbound) {
      if (!i?.id || store.deals.some((d) => d.id === i.id)) continue;
      const isLive = !SEED_IDS.has(i.id);
      const isNew = store.statusOf(i.id) === "New";
      if (!isNew || (!isLive && !pitchMine(i.id))) continue;
      const founder = i.form?.founders?.[0]?.name;
      const rec = i.receivedAt || "";
      list.push({
        id: `pitch-${i.id}`,
        kind: "pitch",
        isLiveSubmission: isLive,
        title: `${i.form?.companyName || "New Pitch"}`,
        subtitle: `${founder ? `${founder} · ` : ""}${i.form?.stage || "Seed"}${i.form?.amountUsd ? ` · ${usd(i.form.amountUsd)}` : ""} · ${i.form?.sector || "Technology"}`,
        meta: `Received ${fmtDay(rec.slice(0, 10))}`,
        href: `/deals/${i.id}`,
        sortDate: rec,
        urgent: isLive && isNew,
      });
    }

    for (const s of store.unprocessed) {
      if (store.statusOf(s.id) !== "New" || !pitchMine(s.id)) continue;
      list.push({
        id: `pitch-${s.id}`,
        kind: "pitch",
        isLiveSubmission: false,
        title: `${s.form.companyName}`,
        subtitle: `${s.form.stage}${s.form.amountUsd ? ` · ${usd(s.form.amountUsd)}` : ""} · ${s.form.sector}`,
        meta: `Received ${fmtDay(s.receivedAt.slice(0, 10))}`,
        href: `/deals/${s.id}`,
        sortDate: s.receivedAt,
      });
    }

    // 2. Portfolio alerts (runway & overdue MIS reports)
    for (const c of p.companies) {
      if (!companyMine(c.owner)) continue;
      const rw = latestRunway(c, p.today);
      if (rw && rw.months < WATCH_RUNWAY_MONTHS) {
        list.push({
          id: `port-runway-${c.id}`,
          kind: "portfolio",
          title: `${c.name} · Cash Runway Alert`,
          subtitle: `${rw.months.toFixed(1)} months of cash left at latest monthly burn`,
          meta: `Portfolio · ${c.sector}`,
          href: `/portfolio/${c.id}?tab=numbers`,
          sortDate: rw.report.receivedAt || p.today,
          urgent: rw.months < 6,
        });
      }
      const overdue = missingItems(c, p.today).filter((m) => !m.key.endsWith(":question"));
      if (overdue.length > 0) {
        const worst = overdue[0];
        list.push({
          id: `port-report-${c.id}`,
          kind: "portfolio",
          title: `${c.name} · ${worst.what}`,
          subtitle: worst.detail,
          meta: `${worst.overdueDays > 0 ? `${worst.overdueDays} days overdue` : "Due now"} · Portfolio`,
          href: `/portfolio/${c.id}?tab=reporting`,
          sortDate: p.today,
          urgent: worst.overdueDays > 30,
        });
      }
    }

    // 3. Unchecked founder files in Data room
    for (const r of links.requests) {
      const owner = r.side === "pitch" ? links.ownerOf(r.companyId) : p.get(r.companyId)?.owner;
      if (!companyMine(owner)) continue;
      for (const item of r.items) {
        const ans = r.answers[item.id];
        if (ans?.state === "Sent" && !r.checked[item.id]) {
          list.push({
            id: `room-${r.id}-${item.id}`,
            kind: "dataroom",
            title: `${r.companyName} · New Founder File`,
            subtitle: `Uploaded for "${item.label}"`,
            meta: `Received ${fmtDay(ans.at || p.today)} · Data room`,
            href: `/dataroom/${r.companyId}`,
            sortDate: ans.at || p.today,
          });
        }
      }
    }

    return list.sort(
      (a, b) =>
        Number(Boolean(b.isLiveSubmission)) - Number(Boolean(a.isLiveSubmission)) ||
        Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)) ||
        (b.sortDate ?? "").localeCompare(a.sortDate ?? ""),
    );
  }, [store, p, w, links]);

  const pathname = usePathname();
  const activeItems = useMemo(() => items.filter((i) => !readIds[i.id]), [items, readIds]);
  const unreadCount = activeItems.length;
  const liveUnreadCount = activeItems.filter((i) => i.isLiveSubmission).length;
  const filtered = activeItems.filter((i) =>
    filter === "all" ? true : filter === "pitch" ? i.kind === "pitch" : i.kind === "portfolio" || i.kind === "dataroom",
  );

  // Automatically dismiss notifications when the user visits the corresponding company/pitch route
  useEffect(() => {
    if (!pathname) return;
    const matched = activeItems.filter((item) => {
      const baseHref = item.href.split("?")[0];
      return baseHref && pathname === baseHref;
    });
    if (matched.length === 0) return;
    setReadIds((prev) => {
      const next = { ...prev };
      for (const m of matched) next[m.id] = true;
      persist("ds.notif.read.v1", next);
      return next;
    });
  }, [pathname, activeItems]);

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = { ...prev, [id]: true };
      persist("ds.notif.read.v1", next);
      return next;
    });
  }

  function markAllRead() {
    const next: Record<string, boolean> = { ...readIds };
    for (const i of items) next[i.id] = true;
    setReadIds(next);
    persist("ds.notif.read.v1", next);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications — New pitches & portfolio updates"
        className={cx(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900",
          open ? "border-blue-600 ring-2 ring-blue-500/20" : "border-slate-200",
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className={cx(
              "absolute -top-1 -right-1 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold leading-none text-white shadow-2xs",
              liveUnreadCount > 0 ? "bg-blue-600 ring-2 ring-white" : "bg-red-600 ring-2 ring-white",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void triggerDealSync()}
                title="Check for new pitches now"
                className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                ↻ Sync
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="cursor-pointer text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-1.5 text-xs">
            {(
              [
                ["all", "All", activeItems.length],
                ["pitch", "Pitches", activeItems.filter((i) => i.kind === "pitch").length],
                ["portfolio", "Portfolio", activeItems.filter((i) => i.kind !== "pitch").length],
              ] as const
            ).map(([k, label, cnt]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cx(
                  "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  filter === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <span>{label}</span>
                <span className={cx("text-[10px] tabular-nums", filter === k ? "text-slate-300" : "text-slate-400")}>{cnt}</span>
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">All caught up — no unread notifications.</div>
            ) : (
              filtered.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  className={cx(
                    "group relative flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100/80",
                    item.isLiveSubmission ? "bg-blue-50/60" : "bg-slate-50/40",
                  )}
                >
                  <span
                    className={cx(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      item.isLiveSubmission
                        ? "bg-blue-600 ring-2 ring-blue-200"
                        : item.urgent
                          ? "bg-red-500"
                          : "bg-blue-500",
                    )}
                  />
                  <Link
                    href={item.href}
                    onClick={() => {
                      markRead(item.id);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 focus:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-blue-600">{item.title}</span>
                      {item.isLiveSubmission ? (
                        <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          New Pitch
                        </span>
                      ) : (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                          {item.kind === "pitch" ? "Pitch" : item.kind === "portfolio" ? "Portfolio" : "Data room"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{item.subtitle}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.meta}</p>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Dismiss ${item.title}`}
                    title="Dismiss notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead(item.id);
                    }}
                    className="mt-0.5 shrink-0 cursor-pointer rounded p-1 text-slate-400 opacity-70 transition-colors hover:bg-slate-200/70 hover:text-slate-700 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] font-medium">
            <Link
              href="/deals?tab=read"
              onClick={() => setOpen(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              Open new pitches →
            </Link>
            <Link
              href="/portfolio"
              onClick={() => setOpen(false)}
              className="text-slate-600 hover:text-slate-900"
            >
              Portfolio updates →
            </Link>
          </div>
        </div>
      )}
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
  // Analysts also see new pitches nobody has picked up yet, plus all live inbound pitches.
  const pitchMine = (id: string) => {
    if (!SEED_IDS.has(id)) return true;
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
                  "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium leading-tight transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-blue-600"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon name={l.icon} />
                <span className="flex-1 truncate">{l.label}</span>
                {n > 0 && (
                  <span
                    title={l.count ? titles[l.count] : undefined}
                    className={cx(
                      "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide leading-tight tabular-nums",
                      active ? "bg-blue-100 text-blue-800" : l.count === "room" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600",
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
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
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
                    "relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium leading-tight transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-blue-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon name={l.icon} />
                  <span className="flex-1 truncate">{l.label}</span>
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
  const db = useDbInfo();
  return (
    <div className="space-y-1.5 border-t border-slate-200 pt-3 pb-16 text-[11px] leading-snug text-slate-500">
      <p className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="font-medium text-slate-700">
          {db ? DB_TEXT[db.driver].short : "Session active · Cloud sync ready"}
        </span>
      </p>
      <p>AI sorts and explains. People decide.</p>
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
  const isPublic =
    path.startsWith("/founder") ||
    path.startsWith("/login") ||
    path.startsWith("/pitch") ||
    path.startsWith("/pending") ||
    path.startsWith("/unauthorized") ||
    path.startsWith("/welcome");

  // Everything except the home landing, login and founder pages needs a signed-in person.
  useEffect(() => {
    if (w.ready && !w.session && !isPublic && path !== "/") router.replace("/");
  }, [w.ready, w.session, isPublic, path, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (path === "/founder" || path.startsWith("/founder/dataroom")) return <main className="min-h-full">{children}</main>;

  if (path.startsWith("/founder"))
    return (
      <div className="flex min-h-full flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aarka-logo.png" alt="Aarka" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
              <span className="text-[15px] font-semibold text-slate-900">{FUND_NAME}</span>
              <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">for founders</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </Link>
              <Link href="/founder" className="hidden text-xs font-medium text-slate-600 hover:text-slate-900 sm:inline">
                Founder portal
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 pt-8 pb-20 sm:px-6">{children}</main>
      </div>
    );

  if (
    path.startsWith("/login") ||
    path.startsWith("/pitch") ||
    path.startsWith("/pending") ||
    path.startsWith("/unauthorized") ||
    path.startsWith("/welcome") ||
    (path === "/" && !w.session)
  )
    return <main className="min-h-full">{children}</main>;

  if (!w.ready || !w.session)
    return (
      <div className="min-h-full bg-slate-50 lg:pl-72">
        <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="h-8 w-36 animate-pulse rounded-md bg-slate-100" />
          <div className="mt-5 h-24 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        </aside>
        <div className="h-14 border-b border-slate-200 bg-white px-6" />
        <div className="mx-auto max-w-6xl space-y-4 p-8">
          <div className="h-9 w-64 animate-pulse rounded-md bg-slate-200/70" />
          <div className="h-40 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" />
        </div>
      </div>
    );

  return (
    <div className="min-h-full lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Brand />
        </div>

        <div className="hidden max-w-xl flex-1 items-center gap-2 lg:flex">
          {path !== "/" && (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </button>
          )}
          <GlobalSearchBar />
        </div>

        <div className="flex items-center gap-2">
          {path !== "/" && (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </button>
          )}
          <div className="lg:hidden">
            <RoleViewDropdown compact />
          </div>
          <NotificationMenu />
          <Link
            href={`/pitch?ref=${encodeURIComponent(w.userName || w.me || "Analyst")}`}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium leading-tight text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 sm:inline-flex"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Share pitch link
          </Link>
          <div className="lg:hidden">
            <Avatar name={w.userName || w.me} size="sm" image={w.userImage} />
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-lg shadow-slate-200/50">
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
