"use client";

// The partner's view of the pipeline: where pitches come from, how far each has got, who is working
// on what, how long founders wait on us, and what the team has asked founders. Counted by code, and
// every number opens the pitches or lines behind it.
import Link from "next/link";
import { useMemo } from "react";
import { NumButton, usePanels, usePitches, type Entry, type Group, type PitchCardData, type TileSpec } from "./cards";
import { AskList, useFounderAsks } from "./founder-links";
import { useLinks } from "./links-store";
import { Avatar } from "./shell";
import { useStore } from "./store";
import { cx } from "./ui";
import { sampleChannel } from "@/lib/funnel";
import { sampleById } from "@/lib/data";
import { fmtDay } from "@/lib/dates";
import { REPLY_PROMISE_DAYS, itemStatus, requestSummary, type FounderRequest } from "@/lib/links";
import { daysBetween } from "@/lib/portfolio/health";
import { usd } from "@/lib/rules";
import { ANALYSTS } from "@/lib/team";

function pitchGroup(c: PitchCardData): Group {
  return { id: c.id, name: c.name, kind: "Pitch", href: c.href, owner: c.owner, status: c.screened ? c.band : "Not read yet" };
}

function pitchEntry(c: PitchCardData, today: string, extra?: string): Entry {
  const days = daysBetween(c.receivedAt.slice(0, 10), today);
  return {
    key: c.id,
    group: pitchGroup(c),
    title: `${c.stage}${c.amountUsd ? `, raising ${usd(c.amountUsd)}` : ""} · ${c.sector}`,
    detail: c.line,
    meta: `Received ${fmtDay(c.receivedAt.slice(0, 10))} (${days} ${days === 1 ? "day" : "days"} ago)${extra ? ` · ${extra}` : ""}`,
    tone: !c.owner ? "watch" : "info",
    href: c.href,
    cta: "Open pitch",
  };
}

function lineEntries(reqs: FounderRequest[], today: string, keep: (st: ReturnType<typeof itemStatus>, r: FounderRequest, itemId: string) => boolean): Entry[] {
  const out: Entry[] = [];
  for (const r of reqs)
    for (const i of r.items) {
      const st = itemStatus(r, i.id, today);
      if (!keep(st, r, i.id)) continue;
      const a = r.answers[i.id];
      out.push({
        key: `${r.id}:${i.id}`,
        group: { id: r.companyId, name: r.companyName, kind: r.side === "pitch" ? "Pitch" : "Portfolio", href: `/dataroom/${r.companyId}`, owner: r.from },
        title: i.label,
        detail:
          st === "Sent"
            ? `Sent ${fmtDay(a!.at)}: ${a!.files.map((f) => f.name).join(", ")}${r.checked[i.id] ? ` · checked by ${r.checked[i.id].by.split(" ")[0]}` : " · not checked yet"}`
            : st === "Overdue"
              ? `${daysBetween(r.due, today)} days late (asked ${fmtDay(r.sentAt)}, due ${fmtDay(r.due)})`
              : st === "Waiting"
                ? `Asked ${fmtDay(r.sentAt)}, due ${fmtDay(r.due)}`
                : st === "Later"
                  ? `Founder will send it by ${a?.by ? fmtDay(a.by) : "a later date"}`
                  : `Founder doesn't have it${a?.note ? `: “${a.note}”` : ""}`,
        tone: st === "Overdue" ? "urgent" : st === "Sent" ? (r.checked[i.id] ? "good" : "info") : "watch",
        href: `/dataroom/${r.companyId}`,
        cta: "Open room",
      });
    }
  return out;
}

export function PipelineSection() {
  const store = useStore();
  const links = useLinks();
  const cards = usePitches(() => true);
  const asks = useFounderAsks();
  const panels = usePanels();
  const today = links.today;

  const data = useMemo(() => {
    const source = (id: string) => {
      const inb = links.getInbound(id);
      if (inb) return inb.via === "Website" ? "Website link" : inb.via === "Referral" ? "Analysts' links" : inb.via === "Email" ? "Pitch email" : "Added by analysts";
      if (sampleById(id)) return sampleChannel(id) === "Pitch form" ? "Pitch form" : sampleChannel(id) === "Partner email" ? "Partner's inbox" : "Pitch email";
      return "Added by analysts";
    };
    const live = cards.filter((c) => store.statusOf(c.id) !== "Passed");
    const asked = new Set(links.requests.map((r) => r.companyId));
    const steps: { key: string; label: string; list: PitchCardData[]; hint: string }[] = [
      { key: "received", label: "Received", list: cards, hint: "Every pitch in the system, passed ones included." },
      { key: "read", label: "Read by AI", list: cards.filter((c) => c.screened), hint: "The deck has been turned into the standard record, with a page for every number." },
      { key: "owned", label: "Has an analyst", list: live.filter((c) => c.owner), hint: "Live pitches someone has picked up." },
      { key: "asked", label: "Documents asked", list: live.filter((c) => asked.has(c.id)), hint: "Live pitches where an analyst sent the founder a request link." },
      { key: "meeting", label: "Meeting set", list: cards.filter((c) => store.statusOf(c.id) === "Meeting set"), hint: "Status set to Meeting set by an analyst or partner." },
    ];
    const sources = new Map<string, PitchCardData[]>();
    for (const c of cards) sources.set(source(c.id), [...(sources.get(source(c.id)) ?? []), c]);
    const waitingOnUs = live
      .filter((c) => store.statusOf(c.id) === "New" && (!c.owner || !c.screened))
      .map((c) => ({ c, days: daysBetween(c.receivedAt.slice(0, 10), today) }))
      .sort((a, b) => b.days - a.days);
    const team = ANALYSTS.map((a) => {
      const reqs = links.requests.filter((r) => r.from === a.name);
      const sums = reqs.map((r) => requestSummary(r, today));
      return {
        name: a.name,
        reqs,
        pitches: live.filter((c) => c.owner === a.name),
        asked: sums.reduce((s, r) => s + r.asked, 0),
        back: sums.reduce((s, r) => s + r.answered, 0),
        late: sums.reduce((s, r) => s + (r.overdueDays ? r.waiting : 0), 0),
        toCheck: sums.reduce((s, r) => s + r.unchecked, 0),
      };
    });
    return { steps, sources: [...sources.entries()].sort((a, b) => b[1].length - a[1].length), waitingOnUs, team, passed: cards.length - live.length, nobody: live.filter((c) => !c.owner) };
  }, [cards, links, store, today]);

  const specs: TileSpec[] = [
    ...data.steps.map(
      (s): TileSpec => ({
        key: `step:${s.key}`,
        title: `Pipeline: ${s.label.toLowerCase()}`,
        count: s.list.length,
        tone: "info",
        icon: "pitch",
        explain: s.hint,
        clear: "No pitches at this step.",
        how: "Counted by code from each pitch's status, owner, AI reading and request links. Passed pitches leave every step except Received.",
        entries: s.list.map((c) => pitchEntry(c, today)),
      }),
    ),
    ...data.sources.map(
      ([k, list]): TileSpec => ({
        key: `src:${k}`,
        title: `Came in by ${k.toLowerCase()}`,
        count: list.length,
        tone: "info",
        icon: "pitch",
        explain: "Where these pitches first reached the fund.",
        clear: "None.",
        how: "Each pitch keeps the route it arrived by: the pitch form, the website link, an analyst's own link, an email to the pitch address, or an analyst's upload.",
        entries: list.map((c) => pitchEntry(c, today)),
      }),
    ),
    {
      key: "nobody",
      title: "Not picked up by anyone",
      count: data.nobody.length,
      tone: "watch",
      icon: "team",
      explain: "Live pitches no analyst has taken. Analysts see these on their home and can take one in a click.",
      clear: "Every live pitch has an analyst.",
      next: "Mention it at the team meeting, or ask an analyst to take it.",
      how: "Live pitches (not passed) with no owner.",
      entries: data.nobody.map((c) => pitchEntry(c, today, "nobody on it")),
    },
    ...data.team.flatMap((t): TileSpec[] => {
      const first = t.name.split(" ")[0];
      return [
        {
          key: `${t.name}:pitches`,
          title: `${first}'s pitches`,
          count: t.pitches.length,
          tone: "info",
          icon: "pitch",
          explain: `Live pitches ${first} looks after.`,
          clear: "None right now.",
          how: "Pitches whose owner is this analyst and whose status isn't Passed.",
          entries: t.pitches.map((c) => pitchEntry(c, today)),
        },
        {
          key: `${t.name}:links`,
          title: `What ${first} asked founders`,
          count: t.asked,
          tone: "info",
          icon: "ask",
          explain: `Every line on the request links ${first} sent, with where it stands.`,
          clear: "No requests sent yet.",
          how: "One line per item on each request link. A line is back when the founder sent a file or said 'later' or 'don't have'.",
          entries: lineEntries(t.reqs, today, () => true),
        },
        {
          key: `${t.name}:back`,
          title: `Back from founders: ${first}`,
          count: t.back,
          tone: "good",
          icon: "files",
          explain: "Lines founders answered: a file, 'later' with a date, or 'don't have'.",
          clear: "Nothing back yet.",
          how: "Request lines with an answer of any kind.",
          entries: lineEntries(t.reqs, today, (st) => st === "Sent" || st === "Later" || st === "Don't have"),
        },
        {
          key: `${t.name}:late`,
          title: `Late from founders: ${first}`,
          count: t.late,
          tone: "urgent",
          icon: "report",
          explain: "Lines past the reply-by date with no answer.",
          clear: "Nothing late.",
          next: `${first} can send the same link again with a one-line nudge from their data room.`,
          how: "Request lines with no answer where today is after the reply-by date the analyst set.",
          entries: lineEntries(t.reqs, today, (st) => st === "Overdue"),
        },
        {
          key: `${t.name}:check`,
          title: `Files ${first} hasn't checked`,
          count: t.toCheck,
          tone: "info",
          icon: "read",
          explain: "Files founders sent that nobody has marked checked.",
          clear: "Every file has been checked.",
          how: "Request lines answered with a file and not marked checked.",
          entries: lineEntries(t.reqs, today, (st, r, id) => st === "Sent" && !r.checked[id]),
        },
      ];
    }),
  ];

  const max = Math.max(1, data.steps[0].list.length);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Pitches and diligence</h2>
          <p className="text-sm text-slate-500">How far each pitch has got, who is on it, and what the team asked founders. Click any number to see what is behind it.</p>
        </div>
        <Link href="/dataroom" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Open the data room →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Pipeline</h3>
          <ul className="mt-3 space-y-1.5">
            {data.steps.map((s) => (
              <li key={s.key}>
                <button onClick={() => panels.open(`step:${s.key}`)} title={s.hint} className="group block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                  <span className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-700 group-hover:text-slate-900">{s.label}</span>
                    <span className="font-semibold tabular-nums text-slate-900 group-hover:text-indigo-700">{s.list.length}</span>
                  </span>
                  <span className="mt-1 block h-2 rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-slate-600 group-hover:bg-slate-900" style={{ width: `${(s.list.length / max) * 100}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2 text-xs text-slate-500">
            {data.passed} passed ·{" "}
            <button onClick={() => panels.open("nobody")} className={cx("font-medium underline-offset-2 hover:underline", data.nobody.length ? "text-amber-700" : "text-slate-500")}>
              {data.nobody.length} not picked up by anyone yet
            </button>
          </p>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">Where pitches come from</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.sources.map(([k, list]) => (
                <button key={k} onClick={() => panels.open(`src:${k}`)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-800">
                  {k} <span className="font-semibold text-slate-900">{list.length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Founders waiting on us</h3>
          <p className="text-xs text-slate-500">New pitches not read or not picked up. The fund promises a reply within {REPLY_PROMISE_DAYS} days.</p>
          {data.waitingOnUs.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.waitingOnUs.slice(0, 6).map(({ c, days }) => (
                <li key={c.id}>
                  <Link href={c.href} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-slate-50">
                    <span className="min-w-0 truncate font-medium text-slate-900">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="text-slate-500">{!c.owner ? "Nobody on it" : "Not read yet"}</span>
                      <span className={cx("rounded-full px-2 py-0.5 font-semibold tabular-nums", days > REPLY_PROMISE_DAYS ? "bg-red-50 text-red-700" : days > 7 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600")}>
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {data.waitingOnUs.length > 6 && <li className="pt-2 text-xs text-slate-500">and {data.waitingOnUs.length - 6} more</li>}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No founder is waiting on us.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Who is doing what</h3>
          <p className="text-xs text-slate-500">Click a number to open the list behind it.</p>
          <div className="-mx-1 mt-3 overflow-x-auto px-1">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Analyst</th>
                  <th className="pb-2 text-right font-medium">Pitches</th>
                  <th className="pb-2 text-right font-medium">Asked</th>
                  <th className="pb-2 text-right font-medium">Back</th>
                  <th className="pb-2 text-right font-medium">Late</th>
                  <th className="pb-2 text-right font-medium">To check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.team.map((t) => (
                  <tr key={t.name}>
                    <td className="py-2">
                      <Link href={`/team?who=${t.name.split(" ")[0].toLowerCase()}`} className="flex items-center gap-2 font-medium text-slate-900 hover:text-indigo-700">
                        <Avatar name={t.name} size="xs" />
                        {t.name.split(" ")[0]}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right">
                      <NumButton n={t.pitches.length} label={`${t.name.split(" ")[0]}'s pitches`} onClick={() => panels.open(`${t.name}:pitches`)} />
                    </td>
                    <td className="py-1.5 text-right">
                      <NumButton n={t.asked} label={`What ${t.name.split(" ")[0]} asked founders`} onClick={() => panels.open(`${t.name}:links`)} />
                    </td>
                    <td className="py-1.5 text-right">
                      <NumButton n={t.back} label="Back from founders" onClick={() => panels.open(`${t.name}:back`)} />
                    </td>
                    <td className="py-1.5 text-right">
                      <NumButton n={t.late} tone={t.late ? "bad" : "plain"} label="Late from founders" onClick={() => panels.open(`${t.name}:late`)} />
                    </td>
                    <td className="py-1.5 text-right">
                      <NumButton n={t.toCheck} tone={t.toCheck ? "new" : "plain"} label="Files not checked" onClick={() => panels.open(`${t.name}:check`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Asked: lines on the request links they sent. Back: lines founders answered. To check: files nobody has checked yet.</p>
        </div>

        <div className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">What the team asked founders</h3>
          <p className="text-xs text-slate-500">Document requests and questions on monthly reports, newest first.</p>
          <div className="mt-2">
            <AskList lines={asks} limit={6} />
          </div>
        </div>
      </div>
      {panels.render(specs)}
    </section>
  );
}
