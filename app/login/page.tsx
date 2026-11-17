"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cx } from "@/components/ui";

const PARTNERS = [
  { name: "Yogendra Kapkoti", email: "yogendrakapkoti13@gmail.com", role: "Managing Partner", initials: "YK", tone: "bg-blue-600 text-white" },
  { name: "Ashutosh Sinha", email: "02.ashutosh@gmail.com", role: "General Partner", initials: "AS", tone: "bg-purple-600 text-white" },
  { name: "Gopal Ahuja", email: "hello@gopalahuja.com", role: "Partner", initials: "GA", tone: "bg-emerald-600 text-white" },
  { name: "Sanchit Kumar", email: "sanchitkr7@gmail.com", role: "Partner", initials: "SK", tone: "bg-cyan-600 text-white" },
  { name: "Founder Test Account", email: "founder@sehatflow.io", role: "Portfolio CEO", initials: "FC", tone: "bg-amber-600 text-white" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSendMagicLink(targetEmail?: string) {
    const e = (targetEmail || email).trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, callbackUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send magic link");

      setEmail(e);
      setStep("otp");
      setInfo(`We sent a 6-digit verification code and a one-click magic link to ${e}.`);
      if (data.devOtp) {
        setOtp(data.devOtp);
      }
    } catch (err: any) {
      setError(err.message || "Failed to send login code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otp).trim();
    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, callbackUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      router.push(data.redirectUrl || "/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickPartnerLogin(partnerEmail: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: partnerEmail, callbackUrl }),
      });
      const data = await res.json();
      if (data.devOtp) {
        await handleVerifyOtp(data.devOtp);
      } else {
        setEmail(partnerEmail);
        setStep("otp");
        setInfo(`Sent code to ${partnerEmail}. Please check your inbox.`);
      }
    } catch (err: any) {
      setError(err.message || "Quick sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25">
            ▲
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">Aarka</span>
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold tracking-tight text-slate-200">
          Investment Intelligence Platform
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Partner Workspace & Founder Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-[#0f172a] py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          {error && (
            <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-5 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-300">
              {info}
            </div>
          )}

          {step === "email" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMagicLink();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                  Email address
                </label>
                <div className="mt-1.5">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@aarkavc.com or founder@company.com"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending Magic Link…" : "Send Magic Link & 6-Digit Code →"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyOtp();
              }}
              className="space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="otp" className="block text-xs font-medium text-slate-300">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Change email
                  </button>
                </div>
                <div className="mt-1.5">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setOtp(val);
                      if (val.length === 6) {
                        handleVerifyOtp(val);
                      }
                    }}
                    placeholder="e.g. 849201"
                    className="block w-full text-center tracking-[8px] font-mono text-xl font-bold rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-blue-400 placeholder-slate-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-center text-xs text-slate-500">
                  Code sent to <span className="text-slate-300">{email}</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Sign In to Workspace"}
              </button>
            </form>
          )}

          {/* Quick Partner Access Section */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                1-Click Quick Partner Access
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                Test Mode Active
              </span>
            </div>

            <div className="grid gap-2">
              {PARTNERS.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickPartnerLogin(p.email)}
                  className="flex items-center justify-between w-full p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cx("w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs", p.tone)}>
                      {p.initials}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{p.email}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 group-hover:text-blue-400">
                    {p.role} →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">
            ← Return to public website
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-xs">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
