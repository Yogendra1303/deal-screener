"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Tabs } from "@/components/company";
import { AskList, useFounderAsks } from "@/components/founder-links";
import { AnalystQueue, Dot, useAnalystLoad } from "@/components/queues";
import { Avatar } from "@/components/shell";
import { Card, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { ANALYSTS } from "@/lib/team";

const slug = (name: string) => name.split(" ")[0].toLowerCase();

export default function TeamPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const w = useWorkspace();
  const initial = use(searchParams).who;
  const [tab, setTab] = useState<string>(ANALYSTS.some((a) => slug(a.name) === initial) ? initial! : "all");
  useEffect(() => {
    // The page is static, so read ?who= in the browser as well.
    const who = new URLSearchParams(window.location.search).get("who");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (who && ANALYSTS.some((a) => slug(a.name) === who)) setTab(who);
  }, []);

  const picked = ANALYSTS.find((a) => slug(a.name) === tab);
  const currentUserName = w.userName || w.me || "Fund Member";
  const pinnedTitle = w.role === "Partner" ? "Primary Partner" : "Lead Analyst";
  const remainingAnalysts = ANALYSTS.filter((a) => a.name.toLowerCase() !== currentUserName.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          What each analyst is carrying, worked out from the records: questions they owe you, reports they haven&apos;t read, founders
          they need to chase, and numbers still in conflict. Open an analyst to see exactly what they see.
        </p>
      </div>

      {/* Pinned active Google-authenticated user */}
      <Card className="border-blue-200/80 bg-gradient-to-r from-blue-50/50 via-white to-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={currentUserName} size="md" image={w.userImage} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{currentUserName}</h2>
                <span className="inline-flex items-center rounded-sm bg-blue-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-800">
                  {pinnedTitle}
                </span>
                <span className="inline-flex items-center rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Active Session
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {w.userEmail || "Authenticated workspace member"} · {w.role === "Partner" ? "Full fund pipeline, IC decisions & >10% math-gap audit" : "Assigned screening queue, deck verification & founder follow-ups"}
              </p>
            </div>
          </div>
          <Link
            href="/deals"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Open pipeline →
          </Link>
        </div>
      </Card>

      <Tabs
        label="Analysts"
        value={tab}
        onChange={setTab}
        tabs={[{ key: "all", label: "Everyone" }, ...remainingAnalysts.map((a) => ({ key: slug(a.name), label: a.name }))]}
      />
      {picked ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-indigo-900 ring-1 ring-inset ring-slate-200">
            You&apos;re seeing {picked.name}&apos;s queue as they see it. It&apos;s read only: they mark reports read and chase founders.
          </p>
          <AnalystQueue who={picked.name} readOnly />
          <AskedFounders who={picked.name} />
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team members</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {remainingAnalysts.map((a) => (
              <AnalystCard key={a.name} name={a.name} onOpen={() => setTab(slug(a.name))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalystCard({ name, onOpen }: { name: string; onOpen: () => void }) {
  const l = useAnalystLoad(name);
  const rows: { label: string; value: string; bad?: boolean }[] = [
    { label: "Questions they owe you", value: `${l.owed.length}${l.overdue ? `, ${l.overdue} overdue` : ""}`, bad: l.overdue > 0 },
    { label: "Reports not read yet", value: l.toRead ? `${l.toRead}, oldest ${l.oldestUnreadDays} days` : "0", bad: l.oldestUnreadDays > 7 },
    { label: "Founders to chase", value: String(l.chase) },
    { label: "Founder asks open over 14 days", value: String(l.asksOld), bad: l.asksOld > 0 },
    { label: "Numbers to fix", value: `${l.fixes}${l.conflicts ? `, ${l.conflicts} in conflict` : ""}`, bad: l.conflicts > 0 },
    { label: "Pitches", value: `${l.pitches}${l.pitchesNew ? `, ${l.pitchesNew} not reviewed` : ""}` },
  ];
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="md" />
        <div>
          <h2 className="font-semibold text-slate-900">{name}</h2>
          <p className="text-xs text-slate-500">Analyst · {l.companies.length} portfolio companies</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3 py-1.5">
            <dt className="text-slate-600">{r.label}</dt>
            <dd className={cx("font-medium tabular-nums", r.bad ? "text-red-700" : "text-slate-900")}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-4 text-xs font-medium text-slate-500">Their companies</h3>
      <ul className="mt-1.5 space-y-1.5">
        {l.companies.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            {c.head ? <Dot level={c.head.level} small /> : <span className="w-1.5" />}
            <span className="min-w-0">
              <Link href={`/portfolio/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                {c.name}
              </Link>
              {c.head && <span className="text-slate-600">: {c.head.text}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button onClick={onOpen} className="mt-4 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
        Open {name.split(" ")[0]}&apos;s queue
      </button>
    </Card>
  );
}

function AskedFounders({ who }: { who: string }) {
  const lines = useFounderAsks(who);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900">What {who.split(" ")[0]} asked founders</h2>
      <p className="text-xs text-slate-500">Document requests sent through founder links, and questions on monthly reports. Newest first.</p>
      <div className="mt-2">
        <AskList lines={lines} showWho={false} limit={10} />
      </div>
    </section>
  );
}
