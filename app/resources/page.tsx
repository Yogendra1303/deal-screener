"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePortfolio, type RunningPlay } from "@/components/portfolio-store";
import { useMyCompanies } from "@/components/scope";
import { Avatar } from "@/components/shell";
import { useStore } from "@/components/store";
import { Button, Card, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { fmtDay } from "@/lib/dates";
import { latestRunway } from "@/lib/portfolio/attention";
import { RESOURCES } from "@/lib/portfolio/data";
import { daysBetween, fmtShort, missingItems } from "@/lib/portfolio/health";
import type { PortfolioCompany, Resource } from "@/lib/portfolio/types";
import { portfolioFacts } from "@/lib/provenance";
import {
  buildMisCsvTemplate,
  OFFICE_HOUR_SLOTS,
  SUPPORT_CATEGORIES,
  TOOLKIT_DETAILS,
  triggerTextDownload,
  type OfficeHourBooking,
  type SupportCategory,
  type SupportTicket,
} from "@/lib/support";
import { TEAM } from "@/lib/team";

type SupportTab = "desk" | "plays" | "network" | "toolkit";
type DeskFilter = "all" | "open" | "portfolio" | "pitch" | "hiring" | "intros" | "resolved";

interface PlayDef {
  name: string;
  when: string;
  steps: string[];
  who: string;
  doneWhen: string;
  category: SupportCategory;
  match: (c: PortfolioCompany, today: string) => string | null;
}

const PLAYS: PlayDef[] = [
  {
    name: "Cash plan",
    when: "Less than 9 months of cash left",
    steps: [
      "Model three scenarios: raise bridge, trim burn, or hybrid",
      "Shortlist and introduce 5 bridge/extension investors",
      "Lock a firm calendar date for the burn/raise decision",
    ],
    who: "Partner and analyst",
    doneWhen: "Bridge signed, or next MIS confirms runway above 12 months",
    category: "Investor / Bridge Intro",
    match: (c, t) => {
      const rw = latestRunway(c, t);
      return rw && rw.months < 9 ? `${rw.months.toFixed(1)} months of cash` : null;
    },
  },
  {
    name: "Revenue review",
    when: "Revenue 20% or more below the deck's plan",
    steps: [
      "Audit active sales pipeline and conversion drop-offs with founder",
      "Review enterprise pricing tiers and top churn drivers",
      "Deliver 3 warm target customer introductions from Aarka network",
    ],
    who: "Analyst & platform team",
    doneWhen: "Monthly recognized revenue returns within 10% of plan",
    category: "Customer Intro",
    match: (c, t) => {
      const f = portfolioFacts(c, t).find((x) => x.key === "plan");
      const v = f ? parseFloat(f.value.replace("−", "-")) : NaN;
      return !isNaN(v) && v <= -20 ? `${f!.value} against plan` : null;
    },
  },
  {
    name: "Reporting reset",
    when: "A monthly MIS or doc request is more than 30 days late",
    steps: [
      "Call the founder directly to unblock reporting friction",
      "Share Aarka's 5-minute Monthly MIS CSV template",
      "Confirm a recurring 15th-of-month calendar cadence",
    ],
    who: "Partner or analyst",
    doneWhen: "Two consecutive monthly MIS reports arrive on time",
    category: "Missing Deck Details",
    match: (c, t) => {
      const late = missingItems(c, t).filter((m) => !m.key.endsWith(":question") && m.overdueDays > 30);
      return late.length ? `${late.length} ${late.length === 1 ? "item" : "items"} over 30 days late` : null;
    },
  },
  {
    name: "Fundraise prep",
    when: "Company plans to raise a follow-on round in the next 6 months",
    steps: [
      "Audit the Data Room against Series A institutional checklist",
      "Build ranked target lead-investor list with warm intro paths",
      "Run two Partner mock pitch & Q&A office-hours sessions",
    ],
    who: "Lead partner",
    doneWhen: "Lead term sheet signed and closed",
    category: "Pitch & Deck Feedback",
    match: (c) => (c.nextRound ? `${c.nextRound.round} in ${c.nextRound.when}` : null),
  },
  {
    name: "Founder ask",
    when: "A portfolio founder ask has remained open over 14 days",
    steps: [
      "Reply within 48 hours with concrete next step and owner",
      "Route request to the right operator, recruiter, or buyer in network",
      "Close the ask with a verified outcome and founder confirmation",
    ],
    who: "Platform desk & partner",
    doneWhen: "Ask resolved with documented outcome",
    category: "Customer Intro",
    match: (c, t) => {
      const old = c.asks.filter((a) => !a.answeredAt && daysBetween(a.openedAt, t) > 14);
      return old.length ? `${old.length} ask${old.length === 1 ? "" : "s"} open over 14 days` : null;
    },
  },
  {
    name: "Hiring & talent sprint",
    when: "Active scaling company preparing for next milestone",
    steps: [
      "Define crisp scorecard for founding engineer or GTM lead role",
      "Broadcast role across Aarka operator bench and referral network",
      "Calibrate top 3 shortlisted candidates in a Partner review",
    ],
    who: "Platform & talent bench",
    doneWhen: "Key leadership or engineering offer accepted",
    category: "Hiring & Talent",
    match: (c) => (c.nextRound ? `Scaling ahead of ${c.nextRound.round}` : null),
  },
];

const REPORT_TEMPLATE = {
  numbers: [
    ["Revenue for the month", "Recognized or invoiced revenue only. Never GMV or bookings."],
    ["Net burn", "Cash out minus cash in for the month."],
    ["Cash in the bank", "Verified closing cash balance on month-end."],
    ["Paying customers", "Active customers who paid during the month."],
    ["Customers lost", "Paying logos churned during the month."],
  ],
  words: [
    "Highlights: strongest product, customer, or hiring win this month",
    "Lowlights: what missed target and the corrective plan underway",
    "Customers won and lost, plus pricing or competitive feedback",
    "How Aarka can help this month (hiring, warm intro, or office hours)",
  ],
};

const KINDS: Resource["kind"][] = ["Template", "Playbook", "Office hours", "Partner perk"];
const KIND_STYLE: Record<Resource["kind"], string> = {
  Template: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Playbook: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Office hours": "bg-blue-50 text-blue-700 ring-blue-200",
  "Partner perk": "bg-amber-50 text-amber-800 ring-amber-200",
};

interface CompanyOption {
  id: string;
  name: string;
  side: "portfolio" | "pitch";
  meta: string;
  email?: string;
}

export default function ResourcesPage() {
  const p = usePortfolio();
  const store = useStore();
  const w = useWorkspace();
  const cos = useMyCompanies();

  const [tab, setTab] = useState<SupportTab>("desk");
  const [deskFilter, setDeskFilter] = useState<DeskFilter>("all");
  const [deskQuery, setDeskQuery] = useState("");
  const [toolkitKind, setToolkitKind] = useState<Resource["kind"] | "all">("all");

  // Live backend state from /api/support
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookings, setBookings] = useState<OfficeHourBooking[]>([]);
  const [loadingDesk, setLoadingDesk] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Modals & drawers
  const [composePrefill, setComposePrefill] = useState<{
    companyId?: string;
    side?: "portfolio" | "pitch";
    category?: SupportCategory;
    subject?: string;
    message?: string;
  } | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);

  // Inline reply state for tickets & legacy portfolio asks
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyEmailFlag, setReplyEmailFlag] = useState<Record<string, boolean>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [resolvingAskId, setResolvingAskId] = useState<string | null>(null);
  const [askOutcomeDraft, setAskOutcomeDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const loadSupport = useCallback(async () => {
    setLoadingDesk(true);
    try {
      const res = await fetch("/api/support");
      const json = (await res.json()) as {
        ok?: boolean;
        tickets?: SupportTicket[];
        bookings?: OfficeHourBooking[];
      };
      if (res.ok && json.ok) {
        setTickets(Array.isArray(json.tickets) ? json.tickets : []);
        setBookings(Array.isArray(json.bookings) ? json.bookings : []);
      }
    } catch {
      // ignore network failure in offline preview
    } finally {
      setLoadingDesk(false);
    }
  }, []);

  useEffect(() => {
    void loadSupport();
  }, [loadSupport]);

  // Unified list of ALL Portfolio Companies + Active Pitch Deals so Partners can support anyone!
  const companyOptions = useMemo<CompanyOption[]>(() => {
    const port: CompanyOption[] = cos.map((c) => ({
      id: c.id,
      name: c.name,
      side: "portfolio",
      meta: `Portfolio · ${c.sector} · ${c.country}`,
    }));
    const seen = new Set(port.map((x) => x.id));
    const pitches: CompanyOption[] = [];
    for (const d of store.deals) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      pitches.push({
        id: d.id,
        name: d.form.companyName,
        side: "pitch",
        meta: `Pitch · ${d.form.stage} · ${d.form.sector}`,
        email: d.form.email || undefined,
      });
    }
    for (const u of store.unprocessed) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      pitches.push({
        id: u.id,
        name: u.form.companyName,
        side: "pitch",
        meta: `Queued Pitch · ${u.form.stage} · ${u.form.sector}`,
        email: u.form.email || undefined,
      });
    }
    return [...port, ...pitches];
  }, [cos, store.deals, store.unprocessed]);

  // Running & matched signal plays
  const runningPlays = useMemo(
    () => p.plays.filter((pl) => cos.some((c) => c.id === pl.companyId)),
    [p.plays, cos],
  );
  const openRunningPlays = useMemo(() => runningPlays.filter((pl) => !pl.closedAt), [runningPlays]);
  const isRunning = (companyId: string, playName: string) =>
    openRunningPlays.some((pl) => pl.companyId === companyId && pl.play === playName);

  const totalSignalHits = useMemo(
    () =>
      PLAYS.reduce(
        (acc, play) => acc + cos.filter((c) => Boolean(play.match(c, p.today))).length,
        0,
      ),
    [cos, p.today],
  );

  // Portfolio company asks from portfolio-store
  const portfolioAsks = useMemo(
    () =>
      cos
        .flatMap((c) => c.asks.map((a) => ({ c, a })))
        .sort((x, y) => Number(Boolean(x.a.answeredAt)) - Number(Boolean(y.a.answeredAt)) || y.a.openedAt.localeCompare(x.a.openedAt)),
    [cos],
  );

  // KPI Counters
  const openDeskTickets = tickets.filter((t) => t.status !== "Resolved").length;
  const openPortfolioAsks = portfolioAsks.filter((x) => !x.a.answeredAt).length;
  const overduePortfolioAsks = portfolioAsks.filter(
    (x) => !x.a.answeredAt && daysBetween(x.a.openedAt, p.today) > 14,
  ).length;
  const totalOpenAsks = openDeskTickets + openPortfolioAsks;
  const scheduledHours = bookings.filter((b) => b.status === "Scheduled").length;

  // Filtered Desk Tickets & Portfolio Asks
  const filteredTickets = useMemo(() => {
    const q = deskQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (deskFilter === "open" && t.status === "Resolved") return false;
      if (deskFilter === "resolved" && t.status !== "Resolved") return false;
      if (deskFilter === "portfolio" && t.side !== "portfolio") return false;
      if (deskFilter === "pitch" && t.side !== "pitch") return false;
      if (deskFilter === "hiring" && t.category !== "Hiring & Talent") return false;
      if (
        deskFilter === "intros" &&
        t.category !== "Customer Intro" &&
        t.category !== "Investor / Bridge Intro"
      )
        return false;
      if (q && !`${t.companyName} ${t.subject} ${t.category} ${t.owner}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, deskFilter, deskQuery]);

  const filteredPortfolioAsks = useMemo(() => {
    if (deskFilter === "pitch") return [];
    const q = deskQuery.trim().toLowerCase();
    return portfolioAsks.filter(({ c, a }) => {
      if (deskFilter === "open" && a.answeredAt) return false;
      if (deskFilter === "resolved" && !a.answeredAt) return false;
      if (deskFilter === "hiring" && a.topic !== "Hiring & Talent") return false;
      if (deskFilter === "intros" && !a.topic.startsWith("Intro")) return false;
      if (q && !`${c.name} ${a.topic} ${a.text}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [portfolioAsks, deskFilter, deskQuery]);

  const shownResources = useMemo(
    () => RESOURCES.filter((r) => toolkitKind === "all" || r.kind === toolkitKind),
    [toolkitKind],
  );

  async function handleReplyTicket(ticketId: string, resolveNow = false) {
    const text = (replyDrafts[ticketId] || "").trim();
    if (!text && !resolveNow) return;
    setSubmittingReplyId(ticketId);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply_ticket",
          ticketId,
          message: text || "Marked resolved by the Aarka team.",
          status: resolveNow ? "Resolved" : "In Progress",
          outcome: resolveNow ? text || "Resolved via Founder Support Desk" : undefined,
          sendEmail: Boolean(replyEmailFlag[ticketId]),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        tickets?: SupportTicket[];
        deliveryNote?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not update ticket.");
      if (Array.isArray(json.tickets)) setTickets(json.tickets);
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
      showToast(json.deliveryNote || (resolveNow ? "Ticket resolved." : "Reply posted to thread."));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update thread.");
    } finally {
      setSubmittingReplyId(null);
    }
  }

  async function handleCompleteBooking(bookingId: string) {
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_office_hours", bookingId }),
      });
      const json = (await res.json()) as { ok?: boolean; bookings?: OfficeHourBooking[] };
      if (res.ok && json.ok && Array.isArray(json.bookings)) {
        setBookings(json.bookings);
        showToast("Office Hours session marked completed.");
      }
    } catch {
      // ignore
    }
  }

  function copyLink(id: string, url: string) {
    void navigator.clipboard?.writeText(url);
    setCopiedId(id);
    showToast("Private founder reply link copied to clipboard.");
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Portfolio Platform &amp; Two-Way Founder Desk
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            Founder support
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connect directly with pitching and portfolio founders for hiring, warm customer intros, pitch clarifications, signal-triggered support plays, and Partner Office Hours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBookingModalOpen(true)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Book Office Hours
          </button>
          <button
            type="button"
            onClick={() => setComposePrefill({ category: "Hiring & Talent" })}
            className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
          >
            + Reach Out / New Ticket
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Live Interactive KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setTab("desk")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "desk" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Open Founder Asks</span>
            {overduePortfolioAsks > 0 ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                {overduePortfolioAsks} &gt;14d
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {totalOpenAsks}
            <span className="text-sm font-normal text-slate-400"> open</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Two-way Pitch &amp; Portfolio desk →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("plays")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "plays" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Signal-Triggered Plays</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
              {openRunningPlays.length} running
            </span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {totalSignalHits}
            <span className="text-sm font-normal text-slate-400"> signals</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Launch runway, revenue &amp; hiring plays →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("network")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "network" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Office Hours &amp; Network</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">48h SLA</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {scheduledHours}
            <span className="text-sm font-normal text-slate-400"> booked</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Partner sessions, hiring &amp; MIS links →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("toolkit")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "toolkit" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Working Toolkit</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Downloadable</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {RESOURCES.length}
            <span className="text-sm font-normal text-slate-400"> assets</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            CSVs, playbooks &amp; claimable perks →
          </p>
        </button>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold" role="tablist">
          {(
            [
              ["desk", `01 · Founder Help Desk (${totalOpenAsks} open)`],
              ["plays", `02 · Signal-Triggered Plays (${totalSignalHits})`],
              ["network", "03 · Office Hours & Hiring"],
              ["toolkit", `04 · Working Toolkit (${RESOURCES.length})`],
            ] as [SupportTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx(
                "cursor-pointer rounded-lg px-3.5 py-1.5 transition",
                tab === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            triggerTextDownload("aarka-monthly-mis-template.csv", buildMisCsvTemplate(), "text/csv;charset=utf-8");
            showToast("Downloaded aarka-monthly-mis-template.csv");
          }}
          className="cursor-pointer text-xs font-semibold text-indigo-700 hover:underline"
        >
          Download MIS CSV Template ↓
        </button>
      </div>

      {/* TAB 1: TWO-WAY YC-STYLE FOUNDER HELP DESK */}
      {tab === "desk" && (
        <div className="space-y-4">
          {/* Quick YC-Style Action Strip */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Ask Pitch Founder for Details",
                desc: "Clarify missing deck metrics, burn, or customer cohorts with a private reply link.",
                category: "Missing Deck Details" as SupportCategory,
                side: "pitch" as const,
                badge: "Pitch Deals",
              },
              {
                title: "Portfolio Hiring & Talent Help",
                desc: "Launch a hiring sprint or source founding engineers & GTM leads across our bench.",
                category: "Hiring & Talent" as SupportCategory,
                side: "portfolio" as const,
                badge: "Talent",
              },
              {
                title: "Warm Customer / Buyer Intro",
                desc: "Connect a founder directly to enterprise buyers and pilot partners in our network.",
                category: "Customer Intro" as SupportCategory,
                side: "portfolio" as const,
                badge: "GTM",
              },
              {
                title: "Investor / Bridge Intro",
                desc: "Coordinate follow-on Series A or bridge investor introductions and mock pitch prep.",
                category: "Investor / Bridge Intro" as SupportCategory,
                side: "portfolio" as const,
                badge: "Fundraise",
              },
            ].map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() =>
                  setComposePrefill({
                    category: card.category,
                    side: card.side,
                    subject: card.title,
                  })
                }
                className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                    {card.badge}
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 group-hover:underline">Start →</span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-900 group-hover:text-indigo-700">{card.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.desc}</p>
              </button>
            ))}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["open", "Open"],
                  ["portfolio", "Portfolio"],
                  ["pitch", "Pitch Founders"],
                  ["hiring", "Hiring & Talent"],
                  ["intros", "Intros"],
                  ["resolved", "Resolved"],
                ] as [DeskFilter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDeskFilter(k)}
                  className={cx(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                    deskFilter === k
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={deskQuery}
                onChange={(e) => setDeskQuery(e.target.value)}
                placeholder="Search company, topic, or ask..."
                className="h-8 w-56 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void loadSupport()}
                className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Sync
              </button>
            </div>
          </div>

          {/* Live Two-Way Threaded Tickets (from /api/support) */}
          <div className="space-y-3">
            {loadingDesk ? (
              <Card className="p-6 text-center text-xs text-slate-500">Loading two-way support threads…</Card>
            ) : filteredTickets.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Live Two-Way Founder Threads ({filteredTickets.length})
                  </h2>
                  <span className="text-[11px] text-slate-400">Synced with Private Founder Data Rooms &amp; Email</span>
                </div>
                {filteredTickets.map((t) => {
                  const isOpen = t.status !== "Resolved";
                  return (
                    <article
                      key={t.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                                t.side === "pitch"
                                  ? "bg-blue-50 text-blue-700 ring-blue-200"
                                  : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                              )}
                            >
                              {t.side === "pitch" ? "Pitch Founder" : "Portfolio"}
                            </span>
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                              {t.category}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {t.direction === "founder_to_fund" ? "Founder Asked" : "Fund Initiated"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <Link
                              href={t.side === "pitch" ? `/deals/${t.companyId}` : `/portfolio/${t.companyId}`}
                              className="text-sm font-bold text-slate-900 hover:text-indigo-700"
                            >
                              {t.companyName}
                            </Link>
                            <span className="text-sm font-medium text-slate-700">· {t.subject}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Owner: {t.owner} · Opened {fmtDay(t.createdAt.slice(0, 10))}
                            {t.founderEmail ? ` · ${t.founderEmail}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {t.replyUrl && (
                            <button
                              type="button"
                              onClick={() => copyLink(t.id, t.replyUrl!)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                            >
                              {copiedId === t.id ? "✓ Link Copied" : "Copy Founder Reply Link"}
                            </button>
                          )}
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
                              t.status === "Resolved"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : t.status === "In Progress"
                                  ? "bg-blue-50 text-blue-700 ring-blue-200"
                                  : "bg-amber-50 text-amber-800 ring-amber-200",
                            )}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>

                      {/* Message History */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        {t.messages.map((m) => (
                          <div
                            key={m.id}
                            className={cx(
                              "rounded-xl px-3.5 py-2.5 text-xs",
                              m.senderRole === "founder"
                                ? "border border-amber-200/80 bg-amber-50/40"
                                : "border border-slate-200/80 bg-slate-50/80",
                            )}
                          >
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                              <span className={m.senderRole === "founder" ? "text-amber-900" : "text-indigo-700"}>
                                {m.senderName} ({m.senderRole === "founder" ? "Founder" : "Aarka Team"})
                              </span>
                              <span>{fmtDay(m.createdAt.slice(0, 10))}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{m.body}</p>
                          </div>
                        ))}
                      </div>

                      {t.outcome && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
                          <strong>Outcome:</strong> {t.outcome}
                        </div>
                      )}

                      {/* Live Reply & Resolve Controls */}
                      {isOpen && (
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={replyDrafts[t.id] || ""}
                              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder="Write a reply, intro update, or resolution note..."
                              className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={submittingReplyId === t.id || !(replyDrafts[t.id] || "").trim()}
                              onClick={() => void handleReplyTicket(t.id, false)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Post Reply
                            </button>
                            <button
                              type="button"
                              disabled={submittingReplyId === t.id}
                              onClick={() => void handleReplyTicket(t.id, true)}
                              className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                            >
                              Resolve
                            </button>
                          </div>
                          {t.founderEmail && (
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500">
                              <input
                                type="checkbox"
                                checked={Boolean(replyEmailFlag[t.id])}
                                onChange={(e) =>
                                  setReplyEmailFlag((prev) => ({ ...prev, [t.id]: e.target.checked }))
                                }
                                className="h-3.5 w-3.5 accent-indigo-600"
                              />
                              Also email reply to {t.founderEmail} with private reply link
                            </label>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {/* Portfolio Company Asks (from portfolio-store, 100% actionable) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Portfolio Founder Asks ({filteredPortfolioAsks.length})
                </h2>
                <span className="text-[11px] text-slate-400">
                  Synced directly with /portfolio/[id] &amp; /founder/[id]
                </span>
              </div>

              {filteredPortfolioAsks.length === 0 ? (
                <Card className="p-6 text-center text-xs text-slate-500">
                  No portfolio founder asks match your current filter. Click &ldquo;+ Reach Out / New Ticket&rdquo; above to start a thread with any pitch or portfolio founder.
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredPortfolioAsks.map(({ c, a }) => {
                    const days = daysBetween(a.openedAt, a.answeredAt ?? p.today);
                    const overdue = !a.answeredAt && days > 14;
                    const isResolving = resolvingAskId === a.id;
                    return (
                      <article
                        key={a.id}
                        className={cx(
                          "flex flex-col rounded-2xl border bg-white p-4 shadow-2xs",
                          overdue ? "border-amber-300" : "border-slate-200",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/portfolio/${c.id}?tab=activity`}
                              className="text-sm font-bold text-slate-900 hover:text-indigo-700"
                            >
                              {c.name}
                            </Link>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {a.topic}
                            </span>
                          </div>
                          <span
                            className={cx(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                              a.answeredAt
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : overdue
                                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                                  : "bg-blue-50 text-blue-700 ring-blue-200",
                            )}
                          >
                            {a.answeredAt ? `Resolved in ${days}d` : `Open ${days}d`}
                          </span>
                        </div>

                        <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-700">&ldquo;{a.text}&rdquo;</p>

                        {a.outcome && (
                          <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
                            Outcome: {a.outcome}
                          </p>
                        )}

                        <div className="mt-3 border-t border-slate-100 pt-3">
                          {isResolving ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const out = askOutcomeDraft.trim();
                                if (!out) return;
                                p.answerAsk(a.id, out);
                                p.addNote(c.id, w.me, `Resolved founder ask (${a.topic}): ${out}`);
                                setResolvingAskId(null);
                                setAskOutcomeDraft("");
                                showToast(`Resolved ${c.name}'s ask and synced to portfolio log.`);
                              }}
                              className="space-y-2"
                            >
                              <input
                                type="text"
                                required
                                value={askOutcomeDraft}
                                onChange={(e) => setAskOutcomeDraft(e.target.value)}
                                placeholder="Log intro made, resource sent, or outcome..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setResolvingAskId(null)}
                                  className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="cursor-pointer rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  Mark Resolved
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-400">
                                Asked {fmtShort(a.openedAt)} · Owner: {c.owner.split(" ")[0]}
                              </span>
                              <div className="flex items-center gap-2">
                                <Link href={`/founder/${c.id}`} className="font-semibold text-slate-500 hover:text-slate-900">
                                  Founder View
                                </Link>
                                {!a.answeredAt && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResolvingAskId(a.id);
                                        setAskOutcomeDraft("");
                                      }}
                                      className="cursor-pointer rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white hover:bg-slate-800"
                                    >
                                      Reply &amp; Resolve
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIGNAL-TRIGGERED SUPPORT PLAYS (PARTNER + ANALYST EXECUTABLE) */}
      {tab === "plays" && (
        <div className="space-y-6">
          <RunningPlaysPanel
            plays={runningPlays}
            onMessageFounder={(companyId, companyName, playDef) => {
              setComposePrefill({
                companyId,
                side: "portfolio",
                category: playDef.category,
                subject: `${playDef.name} Support Plan`,
                message: `Hi team,\n\nWe kicked off our ${playDef.name} support play for ${companyName}. Here are the 3 immediate steps we can tackle together:\n1. ${playDef.steps[0]}\n2. ${playDef.steps[1]}\n3. ${playDef.steps[2]}\n\nLet us know the best slot for a quick working call this week.`,
              });
            }}
          />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Active Signal Playbooks</h2>
                <p className="text-xs text-slate-500">
                  Matched deterministically from monthly MIS reports, runway radar, and open asks. Both Partners and Analysts can start and track plays.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PLAYS.map((play) => {
                const hits = cos.map((c) => ({ c, why: play.match(c, p.today) })).filter((x) => x.why);
                return (
                  <article
                    key={play.name}
                    className={cx(
                      "flex flex-col rounded-2xl border bg-white p-5 shadow-2xs",
                      hits.length ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{play.name}</h3>
                      {hits.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                          {hits.length} matched
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Clear
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Trigger: {play.when}</p>

                    <ol className="mt-3 space-y-1.5 text-xs text-slate-700">
                      {play.steps.map((st, i) => (
                        <li key={st} className="flex gap-2">
                          <span className="w-4 shrink-0 font-mono text-[11px] font-bold text-indigo-600">{i + 1}.</span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ol>

                    <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px]">
                      <div>
                        <dt className="font-semibold text-slate-400">Owner</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{play.who}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-400">Exit Target</dt>
                        <dd className="mt-0.5 font-medium text-slate-800">{play.doneWhen}</dd>
                      </div>
                    </dl>

                    <div className="mt-auto pt-4">
                      {hits.length > 0 ? (
                        <ul className="space-y-2 border-t border-slate-100 pt-3">
                          {hits.map(({ c, why }) => {
                            const active = isRunning(c.id, play.name);
                            return (
                              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0">
                                  <Link href={`/portfolio/${c.id}`} className="font-semibold text-indigo-700 hover:underline">
                                    {c.name}
                                  </Link>
                                  <span className="block truncate text-[11px] text-slate-500">{why}</span>
                                </div>
                                {active ? (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                    Running
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      p.startPlay(c.id, play.name, w.me);
                                      showToast(`Started "${play.name}" play for ${c.name}.`);
                                    }}
                                    className="shrink-0 cursor-pointer rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                                  >
                                    Start Play
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                          No portfolio company triggers this play today.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: OFFICE HOURS, HIRING NETWORK & FOUNDER MIS PORTAL */}
      {tab === "network" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Partner Office Hours Schedule */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Partner Office Hours</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  30-minute working sessions for both portfolio founders and active pitch finalists on hiring, GTM, pricing, or Series A prep.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                + Schedule Session
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                No Office Hours booked yet. Schedule a 30-minute Partner session with any Pitch or Portfolio founder.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={b.side === "pitch" ? `/deals/${b.companyId}` : `/portfolio/${b.companyId}`}
                            className="font-bold text-slate-900 hover:text-indigo-700"
                          >
                            {b.companyName}
                          </Link>
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {b.slotLabel}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-slate-700">{b.topic}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Partner: {b.partnerName}</p>
                        {b.notes && <p className="mt-1 text-[11px] text-slate-600">{b.notes}</p>}
                      </div>
                      {b.status === "Scheduled" ? (
                        <button
                          type="button"
                          onClick={() => void handleCompleteBooking(b.id)}
                          className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Mark Done
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          Completed
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Quick Live Founder Portals */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Open Live Founder Portals
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Preview or test any portfolio founder&apos;s private MIS reporting &amp; support view directly.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/founder/${c.id}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-300 hover:text-indigo-700"
                  >
                    {c.name} Portal →
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Monthly MIS Blueprint + Downloadable CSV */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Monthly Founder MIS Standard</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Five numbers + four lines by the 15th. Feeds Runway Radar, Plan Variance, and Fund Analytics automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerTextDownload("aarka-monthly-mis-template.csv", buildMisCsvTemplate(), "text/csv;charset=utf-8");
                  showToast("Downloaded aarka-monthly-mis-template.csv");
                }}
                className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Download CSV Template ↓
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Five Numbers</p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {REPORT_TEMPLATE.numbers.map(([title, desc]) => (
                    <li key={title} className="py-2">
                      <p className="text-xs font-semibold text-slate-900">{title}</p>
                      <p className="text-[11px] text-slate-500">{desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Four Lines in Words</p>
                <ul className="mt-2 space-y-2">
                  {REPORT_TEMPLATE.words.map((line) => (
                    <li key={line} className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: WORKING TOOLKIT, DOWNLOADABLE TEMPLATES & CLAIMABLE PERKS */}
      {tab === "toolkit" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {(["all", ...KINDS] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={toolkitKind === k}
                  onClick={() => setToolkitKind(k)}
                  className={cx(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                    toolkitKind === k
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {k === "all" ? "Everything" : k === "Office hours" ? k : `${k}s`}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              Click any resource to download, read checklist, or send directly to a founder.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shownResources.map((r) => {
              const detail = TOOLKIT_DETAILS[r.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveResource(r)}
                  className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                        KIND_STYLE[r.kind],
                      )}
                    >
                      {r.kind}
                    </span>
                    <span className="font-mono text-[10px] font-medium text-slate-400">{r.format}</span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                    {r.title}
                  </h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{r.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="font-semibold text-indigo-600 group-hover:underline">
                      {detail?.actionLabel ?? "Open Resource"} →
                    </span>
                    <span className="text-[11px] text-slate-400">Send to founder</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* COMPOSE NEW SUPPORT TICKET / FOUNDER OUTREACH MODAL */}
      {composePrefill && (
        <ComposeTicketModal
          companies={companyOptions}
          defaultOwner={w.me}
          prefill={composePrefill}
          onClose={() => setComposePrefill(null)}
          onCreated={(nextTickets, note) => {
            setTickets(nextTickets);
            setComposePrefill(null);
            setTab("desk");
            showToast(note);
          }}
        />
      )}

      {/* BOOK PARTNER OFFICE HOURS MODAL */}
      {bookingModalOpen && (
        <BookOfficeHoursModal
          companies={companyOptions}
          defaultPartner={w.me}
          onClose={() => setBookingModalOpen(false)}
          onBooked={(nextBookings) => {
            setBookings(nextBookings);
            setBookingModalOpen(false);
            setTab("network");
            showToast("Partner Office Hours session scheduled.");
          }}
        />
      )}

      {/* INTERACTIVE RESOURCE / PLAYBOOK / PERK MODAL */}
      {activeResource && (
        <ResourceModal
          resource={activeResource}
          onClose={() => setActiveResource(null)}
          onDownload={(name, content, mime) => {
            triggerTextDownload(name, content, mime);
            showToast(`Downloaded ${name}`);
          }}
          onSendToFounder={(r) => {
            setActiveResource(null);
            const detail = TOOLKIT_DETAILS[r.id];
            const cat: SupportCategory =
              r.kind === "Partner perk"
                ? "Partner Perks & Credits"
                : r.kind === "Office hours"
                  ? "Office Hours"
                  : "Pitch & Deck Feedback";
            setComposePrefill({
              category: cat,
              subject: `${r.title}`,
              message: `Sharing Aarka's "${r.title}" resource:\n\n${detail?.summary ?? r.description}\n\nKey checklist items:\n${(detail?.checklist ?? []).map((item, idx) => `${idx + 1}. ${item}`).join("\n")}\n\nReply directly in this thread if you want our team to walk through this with you.`,
            });
          }}
          onBookHours={() => {
            setActiveResource(null);
            setBookingModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

function RunningPlaysPanel({
  plays,
  onMessageFounder,
}: {
  plays: RunningPlay[];
  onMessageFounder: (companyId: string, companyName: string, playDef: PlayDef) => void;
}) {
  const p = usePortfolio();
  const [closing, setClosing] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const open = plays.filter((pl) => !pl.closedAt);
  const closed = plays.filter((pl) => pl.closedAt);

  if (open.length === 0 && closed.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-xs text-slate-600">
        No support plays active right now. Click <strong>Start Play</strong> on any matched company below to track steps, coordinate with the founder, and close with an outcome.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Active Running Plays ({open.length})</h2>
        <span className="text-xs text-slate-500">Live progress synced across Partners &amp; Analysts</span>
      </div>

      {open.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {open.map((pl) => {
            const c = p.get(pl.companyId);
            const def = PLAYS.find((x) => x.name === pl.play);
            if (!c || !def) return null;
            const signal = def.match(c, p.today);
            const pct = Math.round((pl.done.length / def.steps.length) * 100);
            return (
              <article key={pl.id} className="rounded-2xl border border-indigo-200/80 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {def.name}:{" "}
                      <Link href={`/portfolio/${c.id}`} className="text-indigo-700 hover:underline">
                        {c.name}
                      </Link>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Avatar name={pl.owner} size="xs" /> {pl.owner.split(" ")[0]} · started {fmtDay(pl.startedAt)} · check {fmtDay(pl.checkOn)}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                      signal
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                    )}
                  >
                    {signal ? `Active: ${signal}` : "Signal Cleared"}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>Playbook Progress</span>
                    <span className="font-mono font-bold text-indigo-700">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <ol className="space-y-1.5">
                  {def.steps.map((st, i) => (
                    <li key={st}>
                      <label className="flex cursor-pointer items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={pl.done.includes(i)}
                          onChange={() => p.togglePlayStep(pl.id, i)}
                          className="mt-0.5 h-4 w-4 accent-emerald-600"
                        />
                        <span className={pl.done.includes(i) ? "text-slate-400 line-through" : "text-slate-800"}>
                          {st}
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>

                {closing === pl.id ? (
                  <form
                    className="flex flex-wrap gap-2 border-t border-slate-100 pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!outcome.trim()) return;
                      p.closePlay(pl.id, outcome.trim());
                      setClosing(null);
                      setOutcome("");
                    }}
                  >
                    <input
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      placeholder="Outcome (e.g. $500K insider bridge closed)"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    <button type="submit" className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                      Save &amp; Close
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onMessageFounder(c.id, c.name, def)}
                      className="cursor-pointer font-semibold text-indigo-700 hover:underline"
                    >
                      Send Checklist to Founder →
                    </button>
                    <button
                      type="button"
                      onClick={() => setClosing(pl.id)}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close with Outcome
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
          <p className="font-bold uppercase tracking-wider text-slate-500">Completed Plays ({closed.length})</p>
          <ul className="mt-2 space-y-1 text-slate-700">
            {closed.map((pl) => (
              <li key={pl.id}>
                <strong className="text-slate-900">{pl.play}</strong> on {p.get(pl.companyId)?.name} (closed {fmtDay(pl.closedAt!)}): {pl.outcome}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ComposeTicketModal({
  companies,
  defaultOwner,
  prefill,
  onClose,
  onCreated,
}: {
  companies: CompanyOption[];
  defaultOwner: string;
  prefill: {
    companyId?: string;
    side?: "portfolio" | "pitch";
    category?: SupportCategory;
    subject?: string;
    message?: string;
  };
  onClose: () => void;
  onCreated: (tickets: SupportTicket[], deliveryNote: string) => void;
}) {
  const initialCompany =
    companies.find((c) => c.id === prefill.companyId) ??
    companies.find((c) => (prefill.side ? c.side === prefill.side : true)) ??
    companies[0];

  const [companyId, setCompanyId] = useState(initialCompany?.id ?? "");
  const [category, setCategory] = useState<SupportCategory>(prefill.category ?? "Hiring & Talent");
  const [direction, setDirection] = useState<"fund_to_founder" | "founder_to_fund">("fund_to_founder");
  const [subject, setSubject] = useState(prefill.subject ?? "");
  const [message, setMessage] = useState(prefill.message ?? "");
  const [founderEmail, setFounderEmail] = useState(initialCompany?.email ?? "");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = companies.find((c) => c.id === companyId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !subject.trim() || !message.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_ticket",
          companyId: selected.id,
          companyName: selected.name,
          side: selected.side,
          category,
          direction,
          subject: subject.trim(),
          message: message.trim(),
          owner: defaultOwner,
          founderEmail: founderEmail.trim() || selected.email || undefined,
          sendEmail,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tickets?: SupportTicket[];
        deliveryNote?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not create support thread.");
      onCreated(json.tickets ?? [], json.deliveryNote || "Support thread created.");
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Could not create ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Start Two-Way Founder Support Thread</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Reach out to any Pitch or Portfolio founder, or log an inbound founder help request.
            </p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Company (Portfolio or Pitch)</span>
              <select
                value={companyId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCompanyId(id);
                  const found = companies.find((c) => c.id === id);
                  if (found?.email) setFounderEmail(found.email);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.side === "portfolio" ? "Portfolio" : "Pitch"})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Support Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ["fund_to_founder", "Fund Reaching Out to Founder"],
                ["founder_to_fund", "Log Inbound Founder Ask"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDirection(k)}
                className={cx(
                  "flex-1 cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition",
                  direction === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Founder Email (Optional for direct email + private reply link)</span>
            <input
              type="email"
              value={founderEmail}
              onChange={(e) => setFounderEmail(e.target.value)}
              placeholder="founder@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Subject</span>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Clarifying Q3 MRR + Founding Backend Engineer Intro"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Message / Details</span>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask specific questions about the pitch deck or offer concrete hiring / intro help..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          {direction === "fund_to_founder" && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-3.5 w-3.5 accent-indigo-600"
              />
              Email founder (if email provided) with their private two-way reply link
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating Thread…" : "Create & Send Thread"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BookOfficeHoursModal({
  companies,
  defaultPartner,
  onClose,
  onBooked,
}: {
  companies: CompanyOption[];
  defaultPartner: string;
  onClose: () => void;
  onBooked: (bookings: OfficeHourBooking[]) => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [partnerName, setPartnerName] = useState(defaultPartner);
  const [slotLabel, setSlotLabel] = useState(OFFICE_HOUR_SLOTS[0]);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = companies.find((c) => c.id === companyId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !topic.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book_office_hours",
          companyId: selected.id,
          companyName: selected.name,
          side: selected.side,
          partnerName,
          slotLabel,
          topic: topic.trim(),
          notes: notes.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; bookings?: OfficeHourBooking[] };
      if (res.ok && json.ok) onBooked(json.bookings ?? []);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Schedule Partner Office Hours</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              30-minute working session synced to the founder&apos;s portal and Aarka calendar log.
            </p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Company</span>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.side === "portfolio" ? "Portfolio" : "Pitch"})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Partner / Lead</span>
              <select
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
              >
                {[defaultPartner, ...TEAM.map((m) => m.name).filter((n) => n !== defaultPartner)].map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Time Slot</span>
              <select
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
              >
                {OFFICE_HOUR_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Session Topic</span>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Series A narrative review & enterprise pricing"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Prep Notes (Optional)</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key numbers or questions to review..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Booking…" : "Confirm Slot"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResourceModal({
  resource,
  onClose,
  onDownload,
  onSendToFounder,
  onBookHours,
}: {
  resource: Resource;
  onClose: () => void;
  onDownload: (filename: string, content: string, mime?: string) => void;
  onSendToFounder: (r: Resource) => void;
  onBookHours: () => void;
}) {
  const detail = TOOLKIT_DETAILS[resource.id];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span
              className={cx(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                KIND_STYLE[resource.kind],
              )}
            >
              {resource.kind} · {resource.format}
            </span>
            <h3 className="mt-1.5 text-base font-bold text-slate-900">{resource.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">{detail?.summary ?? resource.description}</p>

        {detail && detail.checklist.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Actionable Checklist</p>
            <ul className="mt-2 space-y-2 text-xs text-slate-700">
              {detail.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 font-bold text-emerald-600">✓</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {detail?.buildDownload && detail.downloadName && (
            <button
              type="button"
              onClick={() => onDownload(detail.downloadName!, detail.buildDownload!(), detail.downloadMime)}
              className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              {detail.actionLabel} ↓
            </button>
          )}
          {resource.kind === "Office hours" && (
            <button
              type="button"
              onClick={onBookHours}
              className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Schedule Slot
            </button>
          )}
          <button
            type="button"
            onClick={() => onSendToFounder(resource)}
            className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {resource.kind === "Partner perk" ? "Claim / Request for Company →" : "Send to Founder Thread →"}
          </button>
        </div>
      </div>
    </div>
  );
}
