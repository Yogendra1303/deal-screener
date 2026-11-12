"use client";

// A pitch the AI hasn't read yet: what the founder sent, who has it, and what to ask for first.
// Nothing here is a judgement; the deck is only stored until it has been read.
import { useState } from "react";
import { BackLink, MetaChips, People } from "./company";
import { DecisionCard, FounderFitCard } from "./funnel";
import { AskList, FileName, RequestBuilder, useFounderAsks } from "./founder-links";
import { useLinks } from "./links-store";
import { useStore } from "./store";
import { Card, StatusSelect } from "./ui";
import { CheckSummary } from "./checks-ui";
import { DealDocs } from "./docs";
import { checkUploadCached } from "@/lib/upload";
import { useWorkspace } from "./workspace";
import { AIWorkbenchModal, type WorkbenchJob } from "./ai-workbench";
import { SignalsPanel } from "./signals-panel";
import { sampleById } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { sampleChannel } from "@/lib/funnel";
import { FIRST_LOOK, viaText } from "@/lib/links";
import { usd } from "@/lib/rules";
import { PARTNER } from "@/lib/team";

export function UnreadPitch({ id }: { id: string }) {
  const store = useStore();
  const links = useLinks();
  const w = useWorkspace();
  const [asking, setAsking] = useState(false);
  const [opening, setOpening] = useState(false);
  const sample = sampleById(id);
  const inb = links.getInbound(id);
  const asks = useFounderAsks().filter((a) => a.companyId === id);
  const form = inb?.form ?? sample?.form;
  if (!form) return null;
  const owner = links.ownerOf(id);
  const analyst = w.role === "Analyst";
  const via = inb ? viaText(inb) : sampleChannel(id) === "Partner email" ? "Emailed to the partner" : sampleChannel(id) === "Pitch email" ? "Emailed to the pitch address" : "Pitch form";
  const receivedAt = inb?.receivedAt ?? sample!.receivedAt;
  const pdf = inb?.files.find((f) => /\.pdf$/i.test(f.name));
  const job: WorkbenchJob = {
    kind: "extract",
    id,
    source: sample && !inb ? "sample" : "upload",
    receivedAt,
    form,
    fileName: pdf?.name ?? sample?.deckFile ?? inb?.manual?.deckFile ?? "deck.pdf",
    deckUrl: sample && !inb ? `/samples/${sample.deckFile}` : (pdf?.url ?? null),
    deckKey: pdf?.key ?? null,
    sheet: inb?.manual?.sheet ?? null,
  };

  return (
    <div className="space-y-5">
      <BackLink href="/deals" label="Pitches" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{form.companyName}</h1>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Pitch</span>
            {inb?.manual ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">Checked by code</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Not read yet</span>
            )}
          </div>
          {inb?.oneLiner && <p className="mt-1 text-slate-700">{inb.oneLiner} <span className="text-xs text-slate-400">(founder&apos;s words)</span></p>}
          <MetaChips items={[form.stage, form.amountUsd ? `Raising ${usd(form.amountUsd)}` : null, form.sector, form.country, `Received ${fmtDate(receivedAt)}`, via]} />
          {owner ? (
            <People owner={owner} partner={PARTNER.name} />
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              Nobody at the fund has picked this up yet.
              {analyst && (
                <button onClick={() => links.claim(id, w.me)} className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800">
                  I&apos;ll take it
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="deal-status" className="text-xs text-slate-500">
            Status
          </label>
          <StatusSelect id="deal-status" value={store.statusOf(id)} onChange={(s) => store.setStatus(id, s)} />
        </div>
      </div>

      <section className="space-y-2.5 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <DealDocs id={id} name={form.companyName} className="" />
        <CheckSummary cover={inb?.manual ? checkUploadCached(id, inb.form, inb.manual).cover : null} note={inb?.manual ? `Deck numbers typed by ${inb.manual.by}; the sheet was parsed and checked by code. No AI has read this deck.` : undefined} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {inb?.manual ? <TypedFit id={id} /> : <FounderFitCard id={id} sector={form.sector} />}
        <DecisionCard id={id} name={form.companyName} sector={form.sector} />
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">What the founder sent</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {inb
              ? inb.files.map((f) => (
                  <li key={f.name} className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="text-slate-400">▤</span>
                    <FileName f={f} className="min-w-0" />
                  </li>
                ))
              : [sample!.deckFile, sample!.sheetFile].filter(Boolean).map((f) => (
                  <li key={f} className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="text-slate-400">▤</span>
                    <FileName href={`/samples/${f}`} className="min-w-0" />
                  </li>
                ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {form.founders.map((f) => f.name).join(", ")}
            {form.email ? ` · ${form.email}` : ""}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">{inb?.manual ? "Checked by code, not read by the AI" : "Waiting for the AI to read it"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {inb?.manual
              ? `The deck's numbers were typed by ${inb.manual.by} and checked by code against the sheet and the form. No AI has read the deck, so there is no band or research yet. For a full AI reading:`
              : "The deck is stored but no AI has read it, so there is no band, no numbers check and no research yet. It gets read in one of two ways:"}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>With an API key, it is read automatically when it arrives.</li>
            <li>Without one, it can be read in a Claude chat on your own account, and the result is marked &quot;Read in Claude chat&quot;.</li>
          </ul>
          <div className="mt-3">
            <button onClick={() => setOpening(true)} className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Run AI deck extraction
            </button>
            <p className="mt-1.5 text-xs text-slate-500">
              {store.server?.hasKey ? "An API key is set, so this can run on the server. You can also use your own Claude or ChatGPT account." : "No API key on the server, so this runs on your own Claude or ChatGPT account: copy the prompt, paste the answer back."}
            </p>
          </div>
          {opening && job && <AIWorkbenchModal job={job} onClose={() => setOpening(false)} onDone={() => setOpening(false)} />}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Asked of the founder</h2>
            <p className="text-sm text-slate-600">The usual first-look pack. Ask for it now so the numbers are ready when the deck is read.</p>
          </div>
          {analyst && (owner === w.me || !owner) && (
            <button
              onClick={() => {
                if (!owner) links.claim(id, w.me);
                setAsking(true);
              }}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ask the founder
            </button>
          )}
        </div>
        <div className="mt-3">
          <AskList lines={asks} showWho />
        </div>
      </Card>

      <SignalsPanel id={id} name={form.companyName} />

      {asking && (
        <RequestBuilder
          target={{ companyId: id, companyName: form.companyName, side: "pitch", founder: form.founders[0]?.name ?? "", candidates: FIRST_LOOK }}
          onClose={() => setAsking(false)}
        />
      )}
    </div>
  );
}

/** Founder fit for an uploaded pitch, from the experience typed off the deck's team page. */
function TypedFit({ id }: { id: string }) {
  const links = useLinks();
  const inb = links.getInbound(id);
  if (!inb?.manual) return null;
  const fit = checkUploadCached(id, inb.form, inb.manual).fit;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Founder-market fit</h2>
        {fit && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{fit.level}</span>}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">Typed from the deck&apos;s team page by {inb.manual.by}. Experience only.</p>
      {fit ? (
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          {fit.working.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No founders were entered, so fit is not worked out.</p>
      )}
    </Card>
  );
}
