"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface LiveToast {
  id: string;
  title: string;
  detail: string;
  href?: string;
  type: "deal" | "file" | "update";
}

export function RealtimeListener() {
  const { data: session } = useSession();
  const isVc = session?.role === "VC";
  const [toasts, setToasts] = useState<LiveToast[]>([]);

  useEffect(() => {
    if (!isVc) return;
    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    function connect() {
      try {
        es = new EventSource("/api/realtime/stream");

        es.addEventListener("message", (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === "deal.created") {
              const d = payload.data;
              const companyName = d.company_name || "New Company";
              const ask = d.ask_amount ? `$${(d.ask_amount / 1_000_000).toFixed(1)}M` : "";
              const toast: LiveToast = {
                id: payload.id || String(Date.now()),
                title: `🚀 Inbound Pitch: ${companyName}`,
                detail: `${d.sector || "Tech"} · ${d.stage || "Seed"} ${ask ? `· Ask ${ask}` : ""}`,
                href: `/deals/${d.id || d.slug}`,
                type: "deal",
              };

              setToasts((prev) => [toast, ...prev.slice(0, 3)]);
              window.dispatchEvent(new CustomEvent("aarka:deal_created", { detail: d }));

              // Auto dismiss after 7 seconds
              setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }, 7000);
            } else if (payload.type === "file.uploaded") {
              const d = payload.data;
              const toast: LiveToast = {
                id: payload.id || String(Date.now()),
                title: `📁 Data Room File: ${d.companyName || "Company"}`,
                detail: `Uploaded: ${d.fileName || "New Document"}`,
                href: "/dataroom",
                type: "file",
              };
              setToasts((prev) => [toast, ...prev.slice(0, 3)]);
              window.dispatchEvent(new CustomEvent("aarka:file_uploaded", { detail: d }));
              setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }, 7000);
            }
          } catch (err) {
            console.error("[RealtimeListener] parse error:", err);
          }
        });

        es.onerror = () => {
          if (es) es.close();
          // Retry after 5s
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.warn("[RealtimeListener] SSE unavailable:", err);
      }
    }

    connect();

    const onDetectedLiveDeal = (ev: Event) => {
      const d = (ev as CustomEvent<{ id?: string; slug?: string; company_name?: string; sector?: string; stage?: string; ask_amount?: number }>).detail;
      if (!d) return;
      const companyName = d.company_name || "New Company";
      const ask = d.ask_amount ? `$${(d.ask_amount / 1_000_000).toFixed(1)}M` : "";
      const toast: LiveToast = {
        id: `poll-${d.id || Date.now()}`,
        title: `🚀 New Pitch: ${companyName}`,
        detail: `${d.sector || "Tech"} · ${d.stage || "Seed"} ${ask ? `· Ask ${ask}` : ""}`,
        href: `/deals/${d.id || d.slug}`,
        type: "deal",
      };
      setToasts((prev) => (prev.some((x) => x.id === toast.id) ? prev : [toast, ...prev.slice(0, 3)]));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 9000);
    };
    window.addEventListener("aarka:new_live_deal", onDetectedLiveDeal);

    return () => {
      if (es) es.close();
      clearTimeout(retryTimeout);
      window.removeEventListener("aarka:new_live_deal", onDetectedLiveDeal);
    };
  }, [isVc]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-blue-500/30 bg-[#0c1322]/95 backdrop-blur-md p-3.5 shadow-2xl shadow-blue-900/30 text-white animate-in slide-in-from-bottom-5 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
            {t.type === "deal" ? "🚀" : "📄"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-100 flex items-center justify-between">
              <span>{t.title}</span>
              <span className="text-[10px] font-normal text-blue-400 uppercase tracking-wider ml-2">Just now</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.detail}</div>
            {t.href && (
              <Link
                href={t.href}
                className="inline-block mt-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Review deal now →
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="text-slate-500 hover:text-slate-300 text-xs p-1"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
