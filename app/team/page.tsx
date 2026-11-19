"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { QuestionItem } from "@/components/evidence";
import { AskList, useFounderAsks } from "@/components/founder-links";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { AnalystQueue, Dot, useAnalystLoad } from "@/components/queues";
import { Avatar } from "@/components/shell";
import { useStore } from "@/components/store";
import { Button, Card, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { addDays, fmtDay } from "@/lib/dates";
import { usd } from "@/lib/rules";
import { ANALYSTS, PARTNER } from "@/lib/team";

const slug = (name: string) => name.split(" ")[0].toLowerCase();

export default function TeamPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const w = useWorkspace();
  const p = usePortfolio();
  const store = useStore();
  const links = useLinks();

  const initial = use(searchParams).who;
  const [tab, setTab] = useState<string>(ANALYSTS.some((a) => slug(a.name) === initial) ? initial! : "all");
  const [askModalAnalyst, setAskModalAnalyst] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const who = new URLSearchParams(window.location.search).get("who");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (who && ANALYSTS.some((a) => slug(a.name) === who)) setTab(who);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const currentUserName = w.userName || w.me || PARTNER.name;
  const pinnedTitle = w.role === "Partner" ? "Primary Partner" : "Lead Analyst";
  const remainingAnalysts = ANALYSTS.filter((a) => a.name.toLowerCase() !== currentUserName.toLowerCase());
  const picked = ANALYSTS.find((a) => slug(a.name) === tab);

  const riyaLoad = useAnalystLoad("Riya Menon");
  const arjunLoad = useAnalystLoad("Arjun Bhat");

  const openAnalystSection = (analystName: string, sectionId?: string) => {
    setTab(slug(analystName));
    if (!sectionId) return;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    });
  };

  const partnerQuestions = useMemo(
    () =>
      w.role === "Partner"
        ? w.questions.filter((q) => !q.answer && (q.owner === currentUserName || q.owner === PARTNER.name))
        : [],
    [w.role, w.questions, currentUserName],
  );

  const unassignedPitches = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string; stage: string; sector: string; country: string; ask: number | null; receivedAt: string }[] = [];

    for (const d of store.deals) {
      if (links.ownerOf(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      list.push({
        id: d.id,
        name: d.form.companyName,
        stage: d.form.stage,
        sector: d.form.sector,
        country: d.form.country,
        ask: d.form.amountUsd,
        receivedAt: d.receivedAt.slice(0, 10),
      });
    }
    for (const u of store.unprocessed) {
      if (links.ownerOf(u.id) || seen.has(u.id)) continue;
      seen.add(u.id);
      list.push({
        id: u.id,
        name: u.form.companyName,
        stage: u.form.stage,
        sector: u.form.sector,
        country: u.form.country,
        ask: u.form.amountUsd,
        receivedAt: u.receivedAt.slice(0, 10),
      });
    }
    for (const i of links.inbound) {
      if (links.ownerOf(i.id) || seen.has(i.id)) continue;
      seen.add(i.id);
      list.push({
        id: i.id,
        name: i.form.companyName,
        stage: i.form.stage,
        sector: i.form.sector,
        country: i.form.country,
        ask: i.form.amountUsd,
        receivedAt: i.receivedAt.slice(0, 10),
      });
    }
    return list.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }, [store.deals, store.unprocessed, links]);

  const totals = useMemo(() => {
    const loads = [riyaLoad, arjunLoad];
    const openQuestions = loads.reduce((s, l) => s + l.owed.length, 0) + partnerQuestions.length;
    const overdueQuestions = loads.reduce((s, l) => s + l.overdue, 0);
    const unreadReports = loads.reduce((s, l) => s + l.toRead, 0);
    const totalChase = loads.reduce((s, l) => s + l.chase, 0);
    const totalConflicts = loads.reduce((s, l) => s + l.conflicts, 0);
    const busiestQuestionsAnalyst = [...loads].sort((a, b) => b.overdue - a.overdue || b.owed.length - a.owed.length)[0];
    const busiestOpsAnalyst = [...loads].sort((a, b) => b.conflicts + b.toRead - (a.conflicts + a.toRead))[0];
    return { openQuestions, overdueQuestions, unreadReports, totalChase, totalConflicts, busiestQuestionsAnalyst, busiestOpsAnalyst };
  }, [riyaLoad, arjunLoad, partnerQuestions.length]);

  const ownerChoices = useMemo(
    () => [currentUserName, ...ANALYSTS.map((a) => a.name).filter((n) => n !== currentUserName)],
    [currentUserName],
  );

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Fund Operations &amp; Workload Command
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track live analyst queues, assign incoming pitches, resolve math conflicts, and enforce MIS reporting SLAs across Aarka Fund I.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {w.role === "Partner" && (
            <button
              type="button"
              onClick={() => setAskModalAnalyst(picked?.name ?? remainingAnalysts[0]?.name ?? "Riya Menon")}
              className="cursor-pointer rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
            >
              + Ask Analyst Question
            </button>
          )}
          <Link
            href="/deals"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Open Pipeline →
          </Link>
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

      {/* 4 Live Interactive Team KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "all" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Active Team</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {1 + remainingAnalysts.length}
            <span className="text-sm font-normal text-slate-400"> members</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            1 Partner · {remainingAnalysts.length} Analysts · {p.companies.length} cos
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (partnerQuestions.length > 0 && tab === "all") {
              document.getElementById("partner-questions")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (totals.busiestQuestionsAnalyst) {
              openAnalystSection(totals.busiestQuestionsAnalyst.name, "questions");
            }
          }}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Open Questions</span>
            {totals.overdueQuestions > 0 && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                {totals.overdueQuestions} overdue
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {totals.openQuestions}
            <span className="text-sm font-normal text-slate-400"> waiting</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            {partnerQuestions.length > 0 ? `${partnerQuestions.length} waiting on you →` : "Inspect analyst answers →"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            const target = totals.busiestOpsAnalyst ?? remainingAnalysts[0];
            if (target) openAnalystSection(target.name, target.conflicts > 0 ? "fixes" : "reports");
          }}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>MIS &amp; Conflicts</span>
            {totals.totalConflicts > 0 && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                {totals.totalConflicts} conflicts
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {totals.unreadReports}
            <span className="text-sm font-normal text-slate-400"> unread</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-amber-700">
            {totals.totalChase} founders to chase →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("unassigned")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "unassigned" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Unassigned Pitches</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Assign</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {unassignedPitches.length}
            <span className="text-sm font-normal text-slate-400"> decks</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Assign owners in 1 click →
          </p>
        </button>
      </div>

      {/* Pinned Primary Partner Session Banner */}
      <Card className="border-indigo-200/80 bg-gradient-to-r from-indigo-50/40 via-white to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={currentUserName} size="md" image={w.userImage} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 sm:text-base">{currentUserName}</h2>
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                  {pinnedTitle}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active Session
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {w.userEmail || "Authenticated workspace member"} · Full fund oversight across {store.deals.length} screened pitches &amp; {p.companies.length} portfolio companies
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/fund"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              Fund Analytics
            </Link>
            <Link
              href="/resources"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              Founder Support Desk →
            </Link>
          </div>
        </div>
      </Card>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold" role="tablist">
          {(
            [
              ["all", "Everyone"],
              ...remainingAnalysts.map((a) => [slug(a.name), a.name] as [string, string]),
              ["unassigned", `Unassigned Queue (${unassignedPitches.length})`],
            ] as [string, string][]
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
      </div>

      {/* TAB CONTENT */}
      {tab === "unassigned" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Unassigned Pitch Queue</h2>
              <p className="text-xs text-slate-500">
                Assign any incoming pitch to an analyst or partner. Changes sync immediately across Pipeline, Home, and analyst queues.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500">
              {unassignedPitches.length} unassigned
            </span>
          </div>

          {unassignedPitches.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              Every pitch in the pipeline has an assigned owner.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/75">
              {unassignedPitches.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 transition-colors hover:bg-slate-50/70">
                  <div className="min-w-0">
                    <Link href={`/deals/${item.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.stage} · {item.sector} · {item.country}
                      {item.ask ? ` · ${usd(item.ask)}` : ""} · Received {fmtDay(item.receivedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dataroom/${item.id}`}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open Room
                    </Link>
                    <DropdownSelect
                      ariaLabel={`Assign owner for ${item.name}`}
                      value=""
                      placeholder="Assign owner…"
                      tone="warn"
                      onChange={(owner) => {
                        links.claim(item.id, owner);
                        showToast(`Assigned ${item.name} to ${owner}.`);
                      }}
                      options={ownerChoices}
                      size="sm"
                      align="right"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : picked ? (
        <div className="space-y-5">
          {/* Partner Live Supervision Banner (NO LONGER READ-ONLY FOR PARTNERS!) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Avatar name={picked.name} size="sm" />
              <div>
                <p className="font-semibold text-slate-900">
                  {w.role === "Partner"
                    ? `Managing ${picked.name}'s Queue (Partner Action Mode)`
                    : `Viewing ${picked.name}'s Queue`}
                </p>
                <p className="text-slate-600">
                  {w.role === "Partner"
                    ? "You can directly mark MIS reports read, send founder reminders, inspect math conflicts, or assign new questions below."
                    : "Showing active portfolio reports, open questions, and pending pitch reviews."}
                </p>
              </div>
            </div>
            {w.role === "Partner" && (
              <button
                type="button"
                onClick={() => setAskModalAnalyst(picked.name)}
                className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
              >
                + Ask {picked.name.split(" ")[0]} a Question
              </button>
            )}
          </div>

          <AnalystQueue who={picked.name} readOnly={w.role !== "Partner" && w.me !== picked.name} />
          <AskedFounders who={picked.name} />
        </div>
      ) : (
        <div className="space-y-5">
          {partnerQuestions.length > 0 && (
            <section id="partner-questions" className="scroll-mt-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">Questions waiting on you</h2>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      Action needed · {partnerQuestions.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Questions raised by analysts that need your Partner input. Click a question to reply with a source or open the deal.
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {partnerQuestions.map((q) => (
                  <QuestionItem key={q.id} q={q} showCompany />
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {remainingAnalysts.map((a) => (
              <AnalystCard
                key={a.name}
                name={a.name}
                canAsk={w.role === "Partner"}
                onOpen={() => setTab(slug(a.name))}
                onOpenSection={(sectionId) => openAnalystSection(a.name, sectionId)}
                onAsk={() => setAskModalAnalyst(a.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ask Analyst Question Modal */}
      {askModalAnalyst && (
        <AskAnalystModal
          defaultAnalyst={askModalAnalyst}
          askedBy={currentUserName}
          today={p.today}
          onClose={() => setAskModalAnalyst(null)}
          onSubmitted={(analystName, companyName) => {
            setAskModalAnalyst(null);
            showToast(`Question assigned to ${analystName} on ${companyName}.`);
          }}
        />
      )}
    </div>
  );
}

function AnalystCard({
  name,
  canAsk,
  onOpen,
  onOpenSection,
  onAsk,
}: {
  name: string;
  canAsk: boolean;
  onOpen: () => void;
  onOpenSection: (sectionId: string) => void;
  onAsk: () => void;
}) {
  const l = useAnalystLoad(name);
  const needsAttention = l.overdue > 0 || l.oldestUnreadDays > 7 || l.conflicts > 0 || l.asksOld > 0;
  const rows: { label: string; value: string; bad?: boolean; sectionId: string }[] = [
    { label: "Questions waiting", value: `${l.owed.length}${l.overdue ? `, ${l.overdue} overdue` : ""}`, bad: l.overdue > 0, sectionId: "questions" },
    { label: "Unread MIS reports", value: l.toRead ? `${l.toRead} (oldest ${l.oldestUnreadDays}d)` : "0", bad: l.oldestUnreadDays > 7, sectionId: "reports" },
    { label: "Founders to chase", value: String(l.chase), sectionId: "chase" },
    { label: "Founder asks >14d", value: String(l.asksOld), bad: l.asksOld > 0, sectionId: "asks" },
    { label: "Numbers to verify", value: `${l.fixes}${l.conflicts ? `, ${l.conflicts} in conflict` : ""}`, bad: l.conflicts > 0, sectionId: "fixes" },
    { label: "Assigned pitches", value: `${l.pitches}${l.pitchesNew ? `, ${l.pitchesNew} new` : ""}`, sectionId: "pitches" },
  ];

  return (
    <Card className="flex flex-col p-5 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="group flex cursor-pointer items-center gap-3 text-left">
          <Avatar name={name} size="md" />
          <div>
            <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-700">{name}</h2>
            <p className="text-xs text-slate-500">
              Analyst · {l.companies.length} portfolio cos · {l.pitches} pitches
            </p>
          </div>
        </button>
        <span
          className={cx(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
            needsAttention
              ? "bg-amber-50 text-amber-800 ring-amber-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200",
          )}
        >
          {needsAttention ? "SLA Attention" : "On Track"}
        </span>
      </div>

      {/* Compact Interactive 3-Metric Highlight Strip */}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 text-center">
        <button
          type="button"
          onClick={() => onOpenSection("questions")}
          className="cursor-pointer rounded-lg p-1.5 transition hover:bg-white hover:shadow-2xs hover:ring-1 hover:ring-slate-200"
        >
          <p className="text-[10px] font-semibold uppercase text-slate-400">Questions</p>
          <p className={cx("mt-0.5 font-mono text-base font-bold", l.overdue > 0 ? "text-rose-700" : "text-slate-900")}>
            {l.owed.length}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onOpenSection("reports")}
          className="cursor-pointer rounded-lg p-1.5 transition hover:bg-white hover:shadow-2xs hover:ring-1 hover:ring-slate-200"
        >
          <p className="text-[10px] font-semibold uppercase text-slate-400">Unread MIS</p>
          <p className={cx("mt-0.5 font-mono text-base font-bold", l.oldestUnreadDays > 7 ? "text-amber-700" : "text-slate-900")}>
            {l.toRead}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onOpenSection("fixes")}
          className="cursor-pointer rounded-lg p-1.5 transition hover:bg-white hover:shadow-2xs hover:ring-1 hover:ring-slate-200"
        >
          <p className="text-[10px] font-semibold uppercase text-slate-400">Conflicts</p>
          <p className={cx("mt-0.5 font-mono text-base font-bold", l.conflicts > 0 ? "text-rose-700" : "text-slate-900")}>
            {l.conflicts}
          </p>
        </button>
      </div>

      <div className="mt-3 divide-y divide-slate-100 text-xs">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onOpenSection(r.sectionId)}
            className="group -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
          >
            <span className="text-slate-600 group-hover:text-slate-900">{r.label}</span>
            <span className="flex items-center gap-1.5">
              <span className={cx("font-mono font-semibold tabular-nums", r.bad ? "text-rose-700" : "text-slate-900")}>
                {r.value}
              </span>
              <span aria-hidden className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600">
                →
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Portfolio</h3>
        <ul className="mt-2 space-y-1.5">
          {l.companies.map((c) => (
            <li key={c.id}>
              <Link
                href={`/portfolio/${c.id}`}
                className="group flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-xs transition-colors hover:border-indigo-200 hover:bg-white"
              >
                <span className="flex min-w-0 items-start gap-2">
                  {c.head ? <Dot level={c.head.level} small /> : <span className="w-1.5" />}
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-900 group-hover:text-indigo-700">{c.name}</span>
                    {c.head && <span className="text-slate-600">: {c.head.text}</span>}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-slate-300 group-hover:text-indigo-600">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Manage {name.split(" ")[0]}&apos;s Queue →
        </button>
        {canAsk && (
          <button
            type="button"
            onClick={onAsk}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ask Question
          </button>
        )}
      </div>
    </Card>
  );
}

function AskedFounders({ who }: { who: string }) {
  const lines = useFounderAsks(who);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <h2 className="text-sm font-bold text-slate-900">What {who.split(" ")[0]} asked founders</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Document requests sent through private founder links and questions logged on monthly MIS reports.
      </p>
      <div className="mt-3">
        <AskList lines={lines} showWho={false} limit={10} />
      </div>
    </section>
  );
}

function AskAnalystModal({
  defaultAnalyst,
  askedBy,
  today,
  onClose,
  onSubmitted,
}: {
  defaultAnalyst: string;
  askedBy: string;
  today: string;
  onClose: () => void;
  onSubmitted: (analyst: string, companyName: string) => void;
}) {
  const w = useWorkspace();
  const p = usePortfolio();
  const store = useStore();

  const companyOptions = useMemo(() => {
    const port = p.companies.map((c) => ({
      value: `portfolio:${c.id}`,
      label: `${c.name} (Portfolio)`,
      id: c.id,
      name: c.name,
      side: "portfolio" as const,
    }));
    const deal = store.deals.map((d) => ({
      value: `deal:${d.id}`,
      label: `${d.form.companyName} (Pitch)`,
      id: d.id,
      name: d.form.companyName,
      side: "deal" as const,
    }));
    return [...port, ...deal];
  }, [p.companies, store.deals]);

  const [owner, setOwner] = useState(defaultAnalyst);
  const [companyKey, setCompanyKey] = useState(companyOptions[0]?.value ?? "");
  const [dueDays, setDueDays] = useState("7");
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const effectiveCompanyKey = companyOptions.some((c) => c.value === companyKey)
    ? companyKey
    : (companyOptions[0]?.value ?? "");
  const pickedCompany = companyOptions.find((c) => c.value === effectiveCompanyKey);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-analyst-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 id="ask-analyst-modal-title" className="text-base font-bold text-slate-900">
              Assign Question to Analyst
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Adds a tracked, source-cited diligence question directly to the analyst&apos;s queue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pickedCompany || !text.trim()) return;
            w.ask({
              companyId: pickedCompany.id,
              companyName: pickedCompany.name,
              side: pickedCompany.side,
              text: text.trim(),
              askedBy,
              owner,
              due: addDays(today, Number(dueDays) || 7),
            });
            onSubmitted(owner, pickedCompany.name);
          }}
          className="space-y-3.5 text-xs"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="block space-y-1">
              <span className="block font-semibold text-slate-700">Analyst</span>
              <DropdownSelect
                ariaLabel="Analyst"
                value={owner}
                onChange={setOwner}
                options={ANALYSTS.map((a) => a.name)}
                size="sm"
                className="w-full"
              />
            </div>
            <div className="block space-y-1">
              <span className="block font-semibold text-slate-700">Due SLA</span>
              <DropdownSelect
                ariaLabel="Due SLA"
                value={dueDays}
                onChange={setDueDays}
                options={[
                  { value: "2", label: "In 2 days (Urgent)" },
                  { value: "5", label: "In 5 days" },
                  { value: "7", label: "In 7 days (Standard)" },
                  { value: "14", label: "In 14 days" },
                ]}
                size="sm"
                className="w-full"
              />
            </div>
          </div>

          <div className="block space-y-1">
            <span className="block font-semibold text-slate-700">Company</span>
            <DropdownSelect
              ariaLabel="Company"
              value={effectiveCompanyKey}
              onChange={setCompanyKey}
              options={companyOptions.map((c) => ({ value: c.value, label: c.label }))}
              size="sm"
              className="w-full"
            />
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Question</span>
            <textarea
              ref={textareaRef}
              rows={3}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Confirm whether Q3 revenue includes one-time setup fees before our partner call."
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15 focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || !pickedCompany}>
              Assign Question
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
