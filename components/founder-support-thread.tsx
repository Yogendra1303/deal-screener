"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SUPPORT_CATEGORIES,
  type OfficeHourBooking,
  type SupportCategory,
  type SupportTicket,
} from "@/lib/support";

interface Props {
  dealId: string;
  companyName: string;
  token?: string | null;
  founderName?: string | null;
}

export function FounderSupportThread({ dealId, companyName, token, founderName }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bookings, setBookings] = useState<OfficeHourBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<SupportCategory>("Pitch & Deck Feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ dealId });
      if (token) qs.set("token", token);
      const res = await fetch(`/api/founder/support?${qs.toString()}`, {
        headers: token ? { "x-pitch-token": token } : undefined,
      });
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
      // ignore network blips
    } finally {
      setLoading(false);
    }
  }, [dealId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/founder/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-pitch-token": token } : {}),
        },
        body: JSON.stringify({
          action: "create_ticket",
          dealId,
          token: token || undefined,
          senderName: founderName || `${companyName} Founder`,
          category,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tickets?: SupportTicket[];
        bookings?: OfficeHourBooking[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not submit your request.");
      if (Array.isArray(json.tickets)) setTickets(json.tickets);
      if (Array.isArray(json.bookings)) setBookings(json.bookings);
      setSubject("");
      setMessage("");
      setNotice("Sent directly to the Aarka Founder Support Desk. Our team typically responds within 48 hours.");
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Could not send request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(ticketId: string) {
    const body = (replyDrafts[ticketId] || "").trim();
    if (!body) return;
    setReplyingId(ticketId);
    setErr(null);
    try {
      const res = await fetch("/api/founder/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-pitch-token": token } : {}),
        },
        body: JSON.stringify({
          action: "reply_ticket",
          dealId,
          token: token || undefined,
          ticketId,
          senderName: founderName || `${companyName} Founder`,
          message: body,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tickets?: SupportTicket[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not send reply.");
      if (Array.isArray(json.tickets)) setTickets(json.tickets);
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
      setNotice("Reply delivered to Aarka.");
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Could not send reply.");
    } finally {
      setReplyingId(null);
    }
  }

  return (
    <section id="support" className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Two-Way Founder Support Desk
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">
            Ask Aarka for Help or Reply to Diligence Questions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Need help with hiring, customer intros, deck feedback, pricing, or Office Hours? Send a note directly to our partners or respond to open threads below.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          48h First-Reply SLA
        </span>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}
      {err && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
          {err}
        </div>
      )}

      {/* Scheduled Office Hours Strip */}
      {bookings.length > 0 && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Scheduled Partner Office Hours
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-indigo-100">
                <div>
                  <span className="font-semibold text-slate-900">{b.topic}</span>
                  <span className="text-slate-500"> · with {b.partnerName}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-indigo-700">
                  {b.slotLabel} ({b.status})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* New Request Form */}
        <form onSubmit={submitAsk} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
          <h3 className="text-sm font-semibold text-slate-900">Start a New Request</h3>
          <div>
            <label className="mb-1 block font-medium text-slate-700">How can Aarka help?</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              {SUPPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Looking for Founding Staff Engineer or enterprise pilot intro"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Details &amp; Context</label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share specifics so our partners can act right away (role specs, target customer profile, or deck question)."
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Sending to Aarka…" : "Send Request to Aarka Team"}
          </button>
        </form>

        {/* Live Threaded Conversations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Active Conversations ({tickets.length})
            </h3>
            <button
              type="button"
              onClick={() => void load()}
              className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
              Loading threads…
            </p>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              No messages yet. Use the form on the left anytime you need help with hiring, intros, deck feedback, or diligence questions.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        {t.category}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{t.subject}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.status === "Resolved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-2.5">
                    {t.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg px-3 py-2 ${
                          m.senderRole === "fund"
                            ? "border border-indigo-100 bg-indigo-50/60"
                            : "border border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                          <span className={m.senderRole === "fund" ? "text-indigo-700" : "text-slate-700"}>
                            {m.senderName} ({m.senderRole === "fund" ? "Aarka Team" : "You"})
                          </span>
                          <span>{m.createdAt.slice(0, 10)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                          {m.body}
                        </p>
                      </div>
                    ))}
                  </div>

                  {t.outcome && (
                    <p className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
                      Resolution: {t.outcome}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={replyDrafts[t.id] || ""}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      placeholder="Write a reply to the Aarka team..."
                      className="h-8 flex-1 rounded-md border border-slate-200 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={replyingId === t.id || !(replyDrafts[t.id] || "").trim()}
                      onClick={() => void sendReply(t.id)}
                      className="cursor-pointer rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      {replyingId === t.id ? "Sending…" : "Reply"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
