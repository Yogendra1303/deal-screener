"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { SourceDoc } from "@/lib/docs";
import { usePitches } from "./cards";
import { DocBadges, DocDrawer, useDocs } from "./docs";

const ALL = () => true;

/** Every live pitch with its source files: preview in a panel or download. */
export function PitchFiles() {
  const cards = usePitches(ALL);
  const docsFor = useDocs();
  const [open, setOpen] = useState<{ name: string; docs: SourceDoc[]; start: number } | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Pitch source files</h2>
          <p className="text-xs text-slate-500">The deck, monthly sheet, intake form, registry record and audit report behind each live pitch. Click a badge to preview or download.</p>
        </div>
        <Link href="/upload" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          + Upload Pitch
        </Link>
      </div>
      {cards.length ? (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3 font-semibold">Company</th>
              <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Sector · Stage</th>
              <th className="py-2 font-semibold">Files</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cards.map((c) => {
              const docs = docsFor(c.id);
              return (
                <tr key={c.id}>
                  <td className="py-2 pr-3">
                    <Link href={c.href} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="hidden py-2 pr-3 text-slate-600 sm:table-cell">
                    {c.sector} · {c.stage}
                  </td>
                  <td className="py-2">
                    <DocBadges docs={docs} onOpen={(i) => setOpen({ name: c.name, docs, start: i })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No pitches in this workspace yet.</p>
      )}
      <p className="mt-3 text-xs text-slate-500">Archived deals&apos; files open from each deal page and from the badges in the Checks column on Pitches.</p>
      {open && <DocDrawer name={open.name} docs={open.docs} start={open.start} onClose={close} />}
    </section>
  );
}
