"use client";

// The market as the fund's own inbox shows it: a key strip, the momentum map, decks by month, every sector as a row, and the heatmap.
// Counts and changes are worked out by code from the decks; money raised outside the fund is sample data.
import { ZeroState } from "@/components/mode";
import Link from "next/link";
import { SectorHeatmap, slugOf, useDealFlow } from "@/components/flow";
import { ChangeBar, MomentumMap, OutcomeColumns, SectorGrid, monthlyOutcomes, sectorFacts } from "@/components/market";
import { useStore } from "@/components/store";
import { LABEL } from "@/components/ui";
import { FLOW_NOTE } from "@/lib/flow";

export default function MarketPage() {
  const store = useStore();
  const { rows, market } = useDealFlow();
  if (!store.ready) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!rows.length)
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <ZeroState />
      </div>
    );
  const facts = sectorFacts(rows, market);
  const monthly = market[0].counts.map((_, i) => market.reduce((s, m) => s + m.counts[i], 0));
  const recent = monthly.slice(-3).reduce((a, b) => a + b, 0);
  const before = monthly.slice(-6, -3).reduce((a, b) => a + b, 0);
  const raised = market.reduce((s, m) => s + m.raised[0], 0);
  const raisedBefore = market.reduce((s, m) => s + m.raised[1], 0);
  const byTemp = (t: string) => market.filter((m) => m.temp === t).map((m) => m.sector);
  const heating = byTemp("Heating up");
  const crowding = byTemp("Crowding");
  const cooling = byTemp("Cooling");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
        <p className="mt-1 text-sm text-slate-500">What founders are pitching us, sector by sector, against where the money is going.</p>
      </div>

      <section className="grid gap-px overflow-hidden rounded-xl bg-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:grid-cols-3 lg:grid-cols-6">
        <Cell label="Decks, 6 months" hint="A company that pitched twice counts as two decks and one company.">
          <span className="font-mono">{monthly.reduce((a, b) => a + b, 0)}</span>
          <span className="ml-1.5 text-xs font-normal text-slate-500">· {facts.reduce((s, f) => s + f.companies, 0)} companies</span>
        </Cell>
        <Cell label="Decks, last 3 months">
          <ChangeLine n={recent} change={recent / Math.max(1, before) - 1} from={[before, recent]} />
        </Cell>
        <Cell label="Raised in market, 90d" hint="Tracked sector rounds over the last 90 days">
          <ChangeLine n={`$${(raised / 1000).toFixed(2)}B`} change={raised / raisedBefore - 1} />
        </Cell>
        {(
          [
            ["Heating up", heating, "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"],
            ["Crowding", crowding, "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"],
            ["Cooling", cooling, "border-red-200 bg-red-50 text-red-800 hover:border-red-300"],
          ] as const
        ).map(([label, list, tone]) => (
          <Cell key={label} label={`${label} · ${list.length}`}>
            <span className="mt-0.5 flex flex-wrap gap-1">
              {list.length ? (
                list.map((sct) => (
                  <Link key={sct} href={`/sectors/${slugOf(sct)}`} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>
                    {sct}
                  </Link>
                ))
              ) : (
                <span className="text-xs font-normal text-slate-400">None</span>
              )}
            </span>
          </Cell>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-5 xl:items-stretch">
        <div className="flex xl:col-span-3 [&>*]:w-full">
          <MomentumMap facts={facts} />
        </div>
        <div className="flex xl:col-span-2 [&>*]:w-full">
          <OutcomeColumns data={monthlyOutcomes(rows)} title="Every deck, by month" height={352} />
        </div>
      </div>

      <SectorGrid facts={facts} />

      <SectorHeatmap rows={rows} market={market} />

      <p className="text-xs text-slate-400">
        Change compares the last 3 months with the 3 before across tracked sector cohorts. {FLOW_NOTE}{" "}
        <Link href="/method" className="font-medium text-slate-700 underline-offset-2 hover:underline">
          How the numbers work
        </Link>
      </p>
    </div>
  );
}

function Cell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-3 py-2.5" title={hint}>
      <p className={LABEL}>{label}</p>
      <div className="mt-1 text-sm font-semibold tracking-tight tabular-nums text-slate-900">{children}</div>
    </div>
  );
}

function ChangeLine({ n, change, from }: { n: React.ReactNode; change: number; from?: [number, number] }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono">{n}</span>
      <ChangeBar value={change} max={1} className="[&>span:first-child]:hidden" from={from} />
    </span>
  );
}
