"use client";

import { useEffect, useState } from "react";
import type { DealResult } from "@/lib/types";

export function FounderOutreachModal({
  isOpen,
  onClose,
  deal,
}: {
  isOpen: boolean;
  onClose: () => void;
  deal: DealResult;
}) {
  const defaultEmail = deal.form.email || "";
  const conflicts = deal.flags.filter((f) => f.kind === "conflict");
  const missing = deal.flags.filter((f) => f.kind === "missing");

  const defaultBody = (() => {
    const founderFirst = deal.form.founders?.[0]?.name?.split(/\s+/)[0] || "there";
    const lines: string[] = [
      `Hi ${founderFirst},`,
      "",
      `Thanks for sharing ${deal.form.companyName}'s pitch deck with the Aarka investment team. We reviewed your materials and would love to clarify a few details before moving to our next review step:`,
      "",
    ];
    if (conflicts.length > 0) {
      lines.push("Numbers to reconcile:");
      for (const c of conflicts.slice(0, 3)) {
        lines.push(`• ${c.title}: ${c.detail}`);
      }
      lines.push("");
    }
    if (missing.length > 0) {
      lines.push("Additional items needed:");
      for (const m of missing.slice(0, 3)) {
        lines.push(`• ${m.title}`);
      }
      lines.push("");
    }
    if (!conflicts.length && !missing.length) {
      lines.push("• Please share your latest monthly revenue, net burn, and cash balance (or upload a monthly CSV).");
      lines.push("• Let us know your availability for a 25-minute intro call this week.");
      lines.push("");
    }
    lines.push("You can upload files or update numbers directly in your private data room link below.");
    return lines.join("\n");
  })();

  const [toEmail, setToEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(`Aarka Diligence Follow-Up: ${deal.form.companyName}`);
  const [message, setMessage] = useState(defaultBody);
  const [includeDataRoomLink, setIncludeDataRoomLink] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<{ note: string; link?: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(deal.id)}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: toEmail.trim(),
          subject: subject.trim(),
          message: message.trim(),
          includeDataRoomLink,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        deliveryNote?: string;
        record?: { dataRoomUrl?: string };
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error || "Could not send follow-up.");
        return;
      }
      setSentNote({ note: json.deliveryNote || "Follow-up logged.", link: json.record?.dataRoomUrl });
    } catch {
      setError("Network error while sending follow-up.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Founder Diligence Follow-Up</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Auto-drafted from {deal.form.companyName}&apos;s automated math checks &amp; missing facts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {sentNote ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-600">
              ✓
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Follow-Up Dispatched</h3>
              <p className="mt-1 text-xs text-slate-600">{sentNote.note}</p>
            </div>
            {sentNote.link && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs">
                <p className="font-medium text-slate-700">Included Private Data Room Link:</p>
                <p className="mt-1 truncate font-mono text-[11px] text-blue-600">{sentNote.link}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSentNote(null);
                onClose();
              }}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-slate-900 px-5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="mt-4 space-y-3.5 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Founder Email *</span>
                <input
                  type="email"
                  required
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="founder@company.com"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Subject *</span>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-medium text-slate-700">Message</span>
              <textarea
                rows={8}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={includeDataRoomLink}
                onChange={(e) => setIncludeDataRoomLink(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Attach secure HMAC-signed Private Data Room upload link for this company</span>
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-9 cursor-pointer items-center rounded-md bg-blue-600 px-4 text-xs font-medium text-white shadow-xs hover:bg-blue-700 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send Follow-Up →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
