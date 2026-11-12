"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortfolio } from "@/components/portfolio-store";
import { useMyCompanies } from "@/components/scope";
import { ReminderButton } from "@/components/portfolio-actions";
import { monthDetail } from "@/components/portfolio-ui";
import { PortfolioHeader } from "@/components/portfolio-header";
import { Button, Card, cx } from "@/components/ui";
import { fmtMoney, fmtMonth } from "@/lib/format";
import {
  daysBetween,
  daysLate,
  dueDateFor,
  fmtShort,
  missingItems,
  monthStatus,
  stripMonths,
  type MonthStatus,
} from "@/lib/portfolio/health";
import { METRICS, type PortfolioCompany } from "@/lib/portfolio/types";

const TINT: Record<MonthStatus, string> = {
  "on time": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  late: "bg-amber-50 text-amber-900 ring-amber-300",
  missing: "bg-red-50 text-red-800 ring-red-300",
  excused: "bg-slate-100 text-slate-700 ring-slate-200",
  "not due": "bg-white text-slate-500 ring-slate-200",
  "before investment": "bg-slate-50 text-slate-400 ring-slate-100",
};

function cellText(c: PortfolioCompany, month: string, today: string): { main: string; sub?: string } {
  const status = monthStatus(c, month, today);
  const r = c.reports.find((x) => x.month === month);
  const got = r ? METRICS.filter((m) => r.numbers[m.key]).length : 0;
  const sub = r?.receivedAt && got < METRICS.length ? `${got} of ${METRICS.length} numbers` : undefined;
  switch (status) {
    case "on time":
      return { main: `On time`, sub: sub ?? fmtShort(r!.receivedAt!) };
    case "late":
      return { main: `${daysLate(r!, today)} days late`, sub };
    case "missing":
      return { main: "Missing", sub: `${daysLate(r!, today)} days overdue` };
    case "excused":
      return { main: "Agreed delay", sub: r?.receivedAt ? `sent ${fmtShort(r.receivedAt)}` : undefined };
    case "not due":
      return { main: "Not due", sub: `due ${fmtShort(dueDateFor(month))}` };
    default:
      return { main: "—" };
  }
}

export default function ReportingPage() {
  const p = usePortfolio();
  const cos = useMyCompanies();
  const months = stripMonths(p.today);
  const [pick, setPick] = useState<{ id: string; month: string } | null>(() =>
    cos.some((c) => c.id === "sehatflow") ? { id: "sehatflow", month: months.at(-2)! } : null,
  );

  const owed = useMemo(
    () =>
      cos
        .flatMap((c) => missingItems(c, p.today).map((m) => ({ c, m })))
        .sort((a, b) => b.m.overdueDays - a.m.overdueDays),
    [cos, p.today],
  );
  const unread = cos.flatMap((c) =>
    c.reports.filter((r) => r.receivedAt && !r.acknowledgedAt).map((r) => ({ c, r, waiting: daysBetween(r.receivedAt!, p.today) })),
  );
  const asks = cos.flatMap((c) => c.asks.filter((a) => !a.answeredAt).map((a) => ({ c, a, open: daysBetween(a.openedAt, p.today) })));

  const picked = pick ? p.get(pick.id) : undefined;
  // On a narrow screen, start the grid at the latest months.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div className="space-y-6">
      <PortfolioHeader />
      <p className="max-w-3xl text-sm text-slate-600">
        Each company&apos;s monthly report: the MIS file plus four numbers, due on the 15th of the next month. Click a square to
        see what arrived, what didn&apos;t, and to send a reminder.
      </p>

      <Card className="overflow-hidden">
        <div ref={scroller} className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500">
                <th className="sticky left-0 z-10 w-32 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left font-medium sm:w-40">Company</th>
                {months.map((m) => (
                  <th key={m} className="border-b border-slate-200 px-1.5 py-2.5 text-center font-medium">
                    {fmtMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cos.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 text-left font-medium">
                    <Link href={`/portfolio/${c.id}`} className="text-slate-900 hover:text-indigo-700">
                      {c.name}
                    </Link>
                    <div className="text-xs font-normal text-slate-500">{c.owner}</div>
                  </th>
                  {months.map((m) => {
                    const status = monthStatus(c, m, p.today);
                    const t = cellText(c, m, p.today);
                    const active = pick?.id === c.id && pick.month === m;
                    return (
                      <td key={m} className="border-b border-slate-100 px-1.5 py-2">
                        <button
                          disabled={status === "before investment"}
                          onClick={() => setPick({ id: c.id, month: m })}
                          aria-pressed={active}
                          title={`${c.name}, ${fmtMonth(m)}: ${monthDetail(c, m, p.today)}`}
                          className={cx(
                            "flex h-12 w-full flex-col items-center justify-center rounded-md px-1 text-center ring-1 ring-inset transition",
                            TINT[status],
                            status === "not due" && "border border-dashed border-slate-300 ring-0",
                            active && "outline-2 outline-offset-1 outline-indigo-500",
                            status !== "before investment" && "hover:brightness-95",
                          )}
                        >
                          <span className="text-xs font-semibold leading-tight">{t.main}</span>
                          {t.sub && <span className="text-[11px] leading-tight opacity-80">{t.sub}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {picked && pick && <MonthPanel c={picked} month={pick.month} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Owed by companies</h2>
          <p className="mt-0.5 text-xs text-slate-500">Reports, numbers and documents past their due date, most overdue first.</p>
          {owed.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {owed.map(({ c, m }) => (
                <li key={m.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <Link href={`/portfolio/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                        {c.name}
                      </Link>
                      <span className="text-slate-600"> · {m.what}</span>
                    </div>
                    <p className="text-xs text-slate-500">{m.detail}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-red-700">{m.overdueDays} days overdue</span>
                      {m.reminders.length > 0 && ` · reminded ${m.reminders.map(fmtShort).join(", ")}`}
                    </p>
                  </div>
                  <ReminderButton itemKey={m.key} sentToday={m.reminders.includes(p.today)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nothing overdue.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Waiting on the fund</h2>
          <p className="mt-0.5 text-xs text-slate-500">Reports nobody has read yet, and founder asks with no answer. These count against the fund.</p>
          {unread.length || asks.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {unread.map(({ c, r, waiting }) => (
                <li key={`${c.id}-${r.month}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/portfolio/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                      {c.name}
                    </Link>
                    <span className="text-slate-600"> · {fmtMonth(r.month)} report not read</span>
                    <p className={cx("text-xs", waiting > 7 ? "font-medium text-amber-800" : "text-slate-500")}>
                      Arrived {fmtShort(r.receivedAt!)}, waiting {waiting} days
                    </p>
                  </div>
                  <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => p.acknowledge(c.id, r.month)}>
                    Mark as read
                  </Button>
                </li>
              ))}
              {asks.map(({ c, a, open }) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/portfolio/${c.id}?tab=activity`} className="font-medium text-slate-900 hover:text-indigo-700">
                      {c.name}
                    </Link>
                    <span className="text-slate-600"> · asked: {a.topic}</span>
                    <p className="text-xs text-slate-500">“{a.text}”</p>
                    <p className={cx("text-xs", open > 14 ? "font-medium text-amber-800" : "text-slate-500")}>Open {open} days</p>
                  </div>
                  <Link href={`/portfolio/${c.id}?tab=activity`} className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                    Answer →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nothing waiting on the fund.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function MonthPanel({ c, month }: { c: PortfolioCompany; month: string }) {
  const p = usePortfolio();
  const r = c.reports.find((x) => x.month === month);
  const status = monthStatus(c, month, p.today);
  const key = `${c.id}:${month}`;
  const missingNums = r?.receivedAt ? METRICS.filter((m) => !r.numbers[m.key]) : [];
  const owes = status === "missing" || missingNums.length > 0;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {c.name} · {fmtMonth(month)} report
          </h2>
          <p className="text-sm text-slate-600">
            {monthDetail(c, month, p.today)}. Due {fmtShort(dueDateFor(month))}.
          </p>
          {r?.excused && <p className="mt-1 text-sm text-slate-700">{r.excused}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {owes && <ReminderButton itemKey={key} sentToday={(r?.reminders ?? []).includes(p.today)} />}
          {r?.receivedAt && !r.acknowledgedAt && (
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => p.acknowledge(c.id, month)}>
              Mark as read
            </Button>
          )}
          <Link href={`/portfolio/${c.id}?tab=numbers`} className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-slate-100">
            Open company →
          </Link>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 rounded-lg bg-slate-50 p-3 lg:col-span-1">
          <div className="text-xs text-slate-500">MIS file</div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-900" title={r?.fileName}>
            {r?.fileName ?? (status === "not due" ? "Not due yet" : "Not sent")}
          </div>
        </div>
        {METRICS.map((m) => {
          const n = r?.numbers[m.key];
          return (
            <div key={m.key} className={cx("rounded-lg p-3", n ? "bg-slate-50" : r?.receivedAt ? "bg-red-50" : "bg-slate-50")}>
              <div className="text-xs text-slate-500">{m.label}</div>
              <div className={cx("mt-0.5 text-sm font-medium tabular-nums", n ? "text-slate-900" : "text-red-700")}>
                {n ? (m.money ? fmtMoney(n.value, c.currency) : n.value.toLocaleString("en-US")) : r?.receivedAt ? "Not sent" : "—"}
              </div>
              {n && <div className="text-[11px] text-slate-500">MIS page {n.page}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {r?.acknowledgedAt
          ? `Read by the fund on ${fmtShort(r.acknowledgedAt)}.`
          : r?.receivedAt
            ? "Not read by the fund yet."
            : ""}{" "}
        {(r?.reminders ?? []).length > 0 && `Reminders sent: ${r!.reminders!.map(fmtShort).join(", ")}.`}
      </p>
    </Card>
  );
}
