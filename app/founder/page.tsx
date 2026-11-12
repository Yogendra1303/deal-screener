"use client";

// The founder portal's front door. A founder the fund already knows signs in with a one-time link sent
// to their email; a new founder sends a pitch instead. Founders never see the fund's dashboard.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setFounderSession, useFounderAccess } from "@/components/founder-access";
import { useLinks } from "@/components/links-store";
import { Card } from "@/components/ui";
import { FUND_NAME, PITCH_INBOX } from "@/lib/links";

const DEMO = [
  { email: "ananya@ledgerly.example", what: "Ledgerly, a pitch. Riya asked for documents and an email is waiting to be filed." },
  { email: "rahul@mandiflow.example", what: "Mandiflow, a pitch. Arjun's request is late." },
  { email: "omar@sehatflow.example", what: "Sehatflow, a portfolio company owing reports." },
];

export default function FounderSignIn() {
  const router = useRouter();
  const links = useLinks();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const known = useFounderAccess(sent);

  useEffect(() => {
    // The fund's "open as the founder" button passes the address in the link.
    const e = new URLSearchParams(window.location.search).get("email");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e) setEmail(e);
  }, []);

  if (!links.ready) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <div>
          <p className="text-sm text-slate-500">{FUND_NAME} · founder portal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Share what we asked for, in one place</h1>
          <p className="mt-2 text-slate-600">
            Sign in with the email we already have for you. You&apos;ll see everything the fund has asked for, what you&apos;ve sent, and what&apos;s
            left. No password, nothing to install.
          </p>
        </div>

        {!sent ? (
          <Card className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSent(email.trim().toLowerCase());
              }}
              className="space-y-3"
            >
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Your work email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Email me a sign-in link</button>
            </form>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">Active founder accounts</p>
              <ul className="mt-1.5 space-y-1.5">
                {DEMO.map((d) => (
                  <li key={d.email}>
                    <button onClick={() => setEmail(d.email)} className="text-left text-sm">
                      <span className="font-mono text-indigo-700 hover:underline">{d.email}</span>
                      <span className="block text-xs text-slate-500">{d.what}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold text-slate-900">Check your email</h2>
              <p className="mt-1 text-sm text-slate-600">If {sent} is on file with {FUND_NAME}, a sign-in link is on its way. It works once, for 15 minutes.</p>
            </div>
            {known.length ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">One-time verification link</p>
                <p className="mt-2 text-sm text-slate-800">
                  <span className="font-medium">Sign in to {FUND_NAME}</span>
                  <br />
                  Hi {known[0].founder.split(" ")[0]}, here is your sign-in link for {known.map((k) => k.name).join(" and ")}.
                </p>
                <button
                  onClick={() => {
                    setFounderSession(sent);
                    router.push("/founder/home");
                  }}
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                Prototype note: no email would be sent, because this address isn&apos;t on file. A real portal shows the same &quot;check your email&quot;
                message either way, so nobody can test which founders the fund knows.
              </p>
            )}
            <button onClick={() => setSent(null)} className="text-sm text-slate-600 underline hover:text-slate-900">
              Use a different email
            </button>
          </Card>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">New to {FUND_NAME}?</h2>
          <p className="mt-1 text-sm text-slate-600">Send us your deck. It takes two minutes and a person reads every one.</p>
          <Link href="/founder/pitch" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Send your pitch
          </Link>
          <p className="mt-3 text-xs text-slate-500">Or email it to {PITCH_INBOX}.</p>
        </Card>
        <Card className="p-5 text-sm text-slate-600">
          <h2 className="font-semibold text-slate-900">Three ways to send us files</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Here, after signing in: everything we asked for, one upload box each.</li>
            <li>The link in our email: the same list, no sign-in.</li>
            <li>Email: each company has its own address with us. Files land with the right people.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">Whichever you use, we keep your files exactly as sent. Only the people working on your company see them.</p>
        </Card>
      </aside>
    </div>
  );
}
