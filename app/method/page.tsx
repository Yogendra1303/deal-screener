"use client";

// How every number in Fund Hub is worked out, and how one action moves the others. The thresholds on
// this page are read from the same constants the code uses, so the page can't drift from the app.
import Link from "next/link";
import { useStore } from "@/components/store";
import { cx } from "@/components/ui";
import { GAP_TOLERANCE } from "@/lib/checks";
import { FX } from "@/lib/compare";
import { FOLDERS } from "@/lib/dataroom";
import { FIT_DEEP_YEARS, TEMP_SHARE } from "@/lib/funnel";
import { LOOK_NOW, LOOK_RECENT_DAYS } from "@/lib/flow";
import { NEVER_OPENED_DAYS } from "@/components/flow";
import { DD_MEANING } from "@/lib/diligence";
import { PITCH_INBOX, REPLY_PROMISE_DAYS, TEMPLATES } from "@/lib/links";
import { WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { HEALTH_RULES } from "@/lib/portfolio/health";
import { STATUS_MEANING } from "@/lib/provenance";
import { MISSING_FLAG_THRESHOLD, usd } from "@/lib/rules";

const FLOW: { step: string; who: string; what: string; href?: string; tone: string }[] = [
  { step: "1. Founder sends", who: "Founder", what: `Pitch link, ${PITCH_INBOX}, a request link, email to the company's address, the founder portal, or the monthly report link.`, href: "/founder", tone: "bg-slate-100 ring-slate-200" },
  { step: "2. Data room keeps it", who: "Code", what: "Stored exactly as received, with its route, sender and date. Filed into numbered folders.", href: "/dataroom", tone: "bg-slate-50 ring-slate-200" },
  { step: "3. Reading", who: "AI, or the founder", what: "The AI reads decks and sheets into one standard record, keeping the page of every number. Monthly numbers are typed by the founder.", href: "/sources", tone: "bg-slate-100 ring-violet-100" },
  { step: "4. Labels and checks", who: "Code", what: `Every number gets a label. Two sources more than ${GAP_TOLERANCE * 100}% apart become a Conflict. Nothing is corrected.`, href: "/compare", tone: "bg-amber-50 ring-amber-100" },
  { step: "5. Rules and counts", who: "Code", what: "Fund rules set the band; health rules set the company's word; tiles count what needs doing.", href: "/rules", tone: "bg-emerald-50 ring-emerald-100" },
  { step: "6. People decide", who: "Analyst, partner", what: "Mark checked, file, ask, set a status, overrule a band with a reason. Every change is kept.", href: "/", tone: "bg-slate-100 ring-slate-200" },
];

const LINKS: [string, string][] = [
  ["A founder uploads a file on a request link", "Data room: New from founders +1. The diligence line turns to Received. The analyst's From founders tile and the partner's To check go up by one."],
  ["The analyst marks it checked", "New from founders −1. The diligence line turns to Done. The founder sees “Seen by the fund”."],
  ["A founder emails a file to the company's address", "Data room: To file +1, with a folder suggested from the file name only."],
  ["The analyst files it and says what it answers", "To file −1. If it answers a request line, that line turns to Sent and checked. If it answers a document the fund asked a portfolio company for, Missing reports −1."],
  ["A founder sends the monthly report", "Missing reports −1, Reports to read +1. Revenue, burn and cash update, so cash left, health and Compare move."],
  ["The analyst marks the report read", "Reports to read −1. The fund's reply time on the company improves."],
  ["Someone sets a pitch's status", "Reviewing, Meeting set or Passed take it out of New pitches. Meeting set moves the pipeline bar. Passed takes it out of the data room."],
  ["An analyst takes an unclaimed pitch", "It leaves Not picked up and Founders waiting on us, and moves into that analyst's pitches and data room."],
  ["The partner changes a fund rule", "Every read pitch is re-banded at once. A pitch that becomes Priority shows in Decisions for you."],
  ["Someone passes or holds a pitch", "It needs a reason from the list, a line on why, and a trigger. It leaves New (a pass also leaves the data room), stays in the history under Passed or held, and shows in Look again when news arrives."],
  ["A tile is picked on Pitches", "The live pitches and the history both narrow to that tile. One tile at a time, so two filters never empty the list."],
  ["Someone overrules a band", "The new band shows with “overruled” and the reason. The rules' band is kept next to it."],
];

export default function MethodPage() {
  const store = useStore();
  const rules = store.rules;
  const calcs: { name: string; how: string; limits: string; where: string }[] = [
    {
      name: "Months of cash",
      how: "Cash in the bank ÷ that month's net burn, from the latest monthly report that has both.",
      limits: `Amber under ${WATCH_RUNWAY_MONTHS} months, red under ${HEALTH_RULES.runwayMonths}`,
      where: "Low on cash, Fund at a glance, company cards, Compare",
    },
    {
      name: "Monthly growth (3 months)",
      how: "(Latest revenue ÷ revenue three months earlier) to the power of 1/3, minus 1.",
      limits: `A single month moving more than ${HEALTH_RULES.moveShare * 100}% is flagged`,
      where: "Company numbers, Compare",
    },
    {
      name: "Burn multiple",
      how: "Net burn over the last three months ÷ new annual revenue added in them (revenue gained × 12). Lower is better.",
      limits: "Shown with its working; no threshold",
      where: "Company numbers, Compare",
    },
    {
      name: "Against plan",
      how: "Reported revenue compared with what the deck said the company would make that month.",
      limits: `Flagged when off by more than ${HEALTH_RULES.planShare * 100}%`,
      where: "Keep an eye on, Going well, Compare",
    },
    {
      name: "Report on time",
      how: `A month's report is due on day ${HEALTH_RULES.dueDay} of the next month. The last ${HEALTH_RULES.windowMonths} months are checked.`,
      limits: `Late after ${HEALTH_RULES.lateDays} days counts against health; nothing for ${HEALTH_RULES.quietDays} days is “gone quiet”; under ${HEALTH_RULES.completeMin * 100}% of what was asked in 3 months is flagged`,
      where: "Missing reports, Reporting on time, health",
    },
    {
      name: "The fund's own speed",
      how: "Days from a report arriving to someone marking it read; days a founder's ask stays open; days since the last note to the founder.",
      limits: `Read within ${HEALTH_RULES.ackDays} days, answer asks within ${HEALTH_RULES.askOpenDays}, write at least every ${HEALTH_RULES.noteDays} days. Founders answer the fund's questions within ${HEALTH_RULES.followUpDays}`,
      where: "Reports to read, Founder asks, Keep an eye on",
    },
    {
      name: "Conflict",
      how: "The same number from two sources (deck, the founder's form or sheet, monthly reports, public records) compared by code.",
      limits: `More than ${GAP_TOLERANCE * 100}% apart is a Conflict. A conflict never moves a pitch down; a person settles it`,
      where: "Numbers that don't match, Numbers to fix, every number's label",
    },
    {
      name: "Fit with fund focus",
      how: "The founder's form answers checked against the written fund rules.",
      limits: `Stages: ${rules.stages.join(", ")}. Countries: ${rules.countries.join(", ")}. Round ${usd(rules.minRoundUsd)} to ${usd(rules.maxRoundUsd)}`,
      where: "Pitch band, Fund rules",
    },
    {
      name: "Band",
      how: "Outside focus only if the fit check fails. Priority if the AI's traction reading is Strong and its team reading is Strong or Mixed. Everything else is Review.",
      limits: "The AI reads traction and team with reasons; code applies the rule. A person can overrule with a reason",
      where: "Pitches, Decisions for you, Compare",
    },
    {
      name: "Key facts missing",
      how: "Eight facts an analyst needs before a first call: revenue, growth, customers, team size, round size, year founded, burn, founders' past roles.",
      limits: `${MISSING_FLAG_THRESHOLD} or more missing marks the deck Weak on completeness`,
      where: "Pitch summary, diligence list",
    },
    {
      name: "Founder-market fit",
      how: `Each founder's past work is tagged same problem, nearby or unrelated. Deep: ${FIT_DEEP_YEARS}+ years in the same problem, or a company built before in the same space. Strong: one deep founder and a second with some fit. Mixed: one of those. Weak: neither.`,
      limits: "Experience only. School, age, gender and home town are never used. The tag is read from the team page; years and the level are counted by code",
      where: "Pitch summary, Founders tab, Pitches tiles",
    },
    {
      name: "Market temperature",
      how: "Decks the fund got in the last 3 months against the 3 before, and money raised in the sector over the last 90 days against the 90 before.",
      limits: `Both up by more than ${TEMP_SHARE * 100}%: heating up. More decks but money flat or down: crowding. Either down by more than ${TEMP_SHARE * 100}%: cooling. Sample market data`,
      where: "Home market map, Market, sector pages, pitch decision card",
    },
    {
      name: "Look again",
      how: "Every pass or hold saves one reason from a fixed list, a trigger and a check date. Points for news since: trigger met 3, raised elsewhere 3, pitched again 2, sector heating up 1, strong founder-market fit 1, check date passed 1.",
      limits: `Look again now: ${LOOK_NOW}+ points with the news in the last ${LOOK_RECENT_DAYS} days. A shut-down company drops out`,
      where: "Home tiles, Look again, Pitches, company record",
    },
    {
      name: "Raised since we passed and miss rate",
      how: "A Raised elsewhere signal dated after the fund's decision. Miss rate: of the companies passed for one reason, the share that later raised.",
      limits: "Reasons with fewer than 3 passes are left out. Funding data is a fictional sample",
      where: "Partner home: Raised since we passed",
    },
    {
      name: "Never opened",
      how: `A deck still New, with no owner, ${NEVER_OPENED_DAYS} or more days after it arrived.`,
      limits: "Counts live pitches and the history",
      where: "Home, Pitches (To read tab)",
    },
    {
      name: "One record per company",
      how: "A deck is matched to a company by its website domain. A second deck joins the same record as a Pitched again signal.",
      limits: "The 6 months of history are fictional: a small sample made from a fixed recipe of monthly counts per sector",
      where: "Pitches, company record",
    },
    {
      name: "Health word",
      how: "The first line of the company's attention list decides it: red is Needs help, amber is Watch, no report yet is Too early, otherwise Healthy.",
      limits: "Uses the cash, report and plan limits above",
      where: "Company cards, Portfolio health bar",
    },
    {
      name: "Currencies",
      how: "Compare converts to US dollars at fixed sample rates.",
      limits: Object.entries(FX)
        .filter(([k]) => k !== "USD")
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") + " to $1",
      where: "Compare, Fund at a glance",
    },
    {
      name: "Founders waiting on us",
      how: "New pitches that nobody has read or picked up, by days since they arrived.",
      limits: `The fund promises a reply within ${REPLY_PROMISE_DAYS} days; amber after 7, red after ${REPLY_PROMISE_DAYS}`,
      where: "Partner home",
    },
  ];

  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">How numbers work</h1>
        <p className="mt-1 text-slate-600">
          Where every number comes from, how it is worked out, and what moves it. The limits on this page are read from the same code that
          counts the tiles, so they always match. Any tile&apos;s panel also says how its own number is counted.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">From a founder&apos;s file to a decision</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((f) => (
            <li key={f.step} className={cx("rounded-2xl p-4 ring-1", f.tone)}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{f.step}</p>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{f.who}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{f.what}</p>
              {f.href && (
                <Link href={f.href} className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900">
                  Open →
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">The rule underneath:</span> the AI reads and explains; code does every sum and every
          comparison; people decide. The AI never changes a founder&apos;s number, and nothing is marked checked unless a second source agrees.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">What one action changes</h2>
        <p className="text-sm text-slate-500">Nothing is counted twice and nothing is left out: each action moves these counts and nothing else.</p>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {LINKS.map(([a, b]) => (
              <li key={a} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-6">
                <span className="font-medium text-slate-900">{a}</span>
                <span className="text-slate-600">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Every calculation</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Number</th>
                <th className="px-3 py-2.5 font-medium">How it is worked out</th>
                <th className="px-3 py-2.5 font-medium">Limits used</th>
                <th className="px-5 py-2.5 font-medium">Where it shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {calcs.map((c) => (
                <tr key={c.name}>
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-3 py-3 text-slate-700">{c.how}</td>
                  <td className="px-3 py-3 text-slate-600">{c.limits}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{c.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The health limits are starting points from common seed-fund practice, not tested on real data yet. Change them in one place
          (lib/portfolio/health.ts) and every tile, panel and this page follow.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Labels on every number</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(STATUS_MEANING).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Diligence lines</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {Object.entries(DD_MEANING).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Who sees what</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <span className="font-medium text-slate-900">Partner.</span>{" "}
              <span className="text-slate-600">The whole fund: every company, pitch, file and request, and what each analyst is carrying. Sets fund rules and makes decisions. Doesn&apos;t add pitches or send requests.</span>
            </li>
            <li>
              <span className="font-medium text-slate-900">Analyst.</span>{" "}
              <span className="text-slate-600">Only the portfolio companies and pitches they look after, plus new pitches nobody has picked up. Adds pitches, sends requests, checks and files what founders send.</span>
            </li>
            <li>
              <span className="font-medium text-slate-900">Founder.</span>{" "}
              <span className="text-slate-600">Never sees the dashboard. Sees only what the fund asked of their own company, on a link or after signing in to the founder portal with the email the fund holds.</span>
            </li>
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Data room folders</h3>
          <ol className="mt-2 space-y-1 text-sm text-slate-600">
            {FOLDERS.map((f) => (
              <li key={f.id}>
                <span className="font-medium text-slate-900">
                  {f.n}. {f.name}:
                </span>{" "}
                {f.holds}
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Ready-made request lists</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {TEMPLATES.map((t) => (
              <li key={t.key}>
                <span className="font-medium text-slate-900">{t.name}</span> ({t.items.length} items): {t.when.toLowerCase()}.
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
