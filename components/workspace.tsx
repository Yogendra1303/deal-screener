"use client";

// Who is signed in (partner or analyst), and the questions between them. The sign-in stays in this
// browser; the questions are saved on the server too, laid over the sample questions that ship with the app.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_DATE } from "@/lib/portfolio/health";
import { SEED_QUESTIONS, type Answer, type Question } from "@/lib/questions";
import { signInCheck, type Session } from "@/lib/auth";
import type { Role } from "@/lib/team";
import { hydrate, persist } from "@/lib/db/client";

const KEYS = { session: "ds.session.v1", questions: "ds.questions.v1" };


interface LocalQuestions {
  added: Question[];
  answers: Record<string, Answer>;
}

const EMPTY: LocalQuestions = { added: [], answers: {} };

interface Workspace {
  ready: boolean;
  session: Session | null;
  role: Role;
  me: string;
  setDemoRole: (role: Role) => void;
  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
  questions: Question[];
  questionsFor: (companyId: string) => Question[];
  ask: (q: Omit<Question, "id" | "askedAt">) => void;
  answer: (id: string, a: Omit<Answer, "at">) => void;
  questionsChanged: boolean;
  resetQuestions: () => void;
}

const Ctx = createContext<Workspace | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as T) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the change still shows until the page reloads.
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [local, setLocal] = useState<LocalQuestions>(EMPTY);

  useEffect(() => {
    // Load this browser's choices once, after the first render, then check if a server OAuth session is active.
    const saved = read<Session | null>(KEYS.session, null);
    const localSession = saved && saved.name && saved.role ? saved : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(localSession);
    setLocal(read(KEYS.questions, EMPTY));
    hydrate<Partial<LocalQuestions>>(KEYS.questions, (v) => setLocal({ ...EMPTY, ...v }), window.localStorage.getItem(KEYS.questions) ? read(KEYS.questions, EMPTY) : null);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean; user?: { email?: string | null; name?: string | null } | null; role?: "partner" | "analyst" | null } | null) => {
        if (data?.enabled && data.user?.email && data.role) {
          const serverRole: Role = data.role === "partner" ? "Partner" : "Analyst";
          const role: Role = localSession && localSession.email === data.user.email ? localSession.role : serverRole;
          const defaultName = role === "Partner" ? "Kabir Shah" : "Riya Menon";
          const name = localSession && localSession.email === data.user.email && localSession.role === role ? localSession.name : defaultName;
          const next: Session = {
            name,
            role,
            email: data.user.email,
          };
          setSession(next);
          write(KEYS.session, next);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setDemoRole = useCallback((role: Role) => {
    setSession((prev) => {
      const name = role === "Partner" ? "Kabir Shah" : "Riya Menon";
      const next: Session = {
        name,
        role,
        email: prev?.email ?? (role === "Partner" ? "kabir@fundhub.demo" : "riya@fundhub.demo"),
      };
      write(KEYS.session, next);
      return next;
    });
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    const r = signInCheck(email, password);
    if (typeof r === "string") return r;
    setSession(r);
    write(KEYS.session, r);
    return null;
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    try {
      window.localStorage.removeItem(KEYS.session);
    } catch {
      // Nothing saved to remove.
    }
    fetch("/api/auth/csrf", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { csrfToken?: string } | null) => {
        if (d?.csrfToken) {
          return fetch("/api/auth/signout", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ csrfToken: d.csrfToken, json: "true" }),
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const update = useCallback((fn: (l: LocalQuestions) => LocalQuestions) => {
    setLocal((prev) => {
      const next = fn(prev);
      persist(KEYS.questions, next);
      return next;
    });
  }, []);

  const questions = useMemo(
    () =>
      [...SEED_QUESTIONS, ...local.added]
        .map((q) => (local.answers[q.id] && !q.answer ? { ...q, answer: local.answers[q.id] } : q))
        .sort((a, b) => b.askedAt.localeCompare(a.askedAt) || a.id.localeCompare(b.id)),
    [local],
  );

  const value = useMemo<Workspace>(
    () => ({
      ready,
      session,
      role: session?.role ?? "Analyst",
      me: session?.name ?? "",
      setDemoRole,
      signIn,
      signOut,
      questions,
      questionsFor: (companyId) => questions.filter((q) => q.companyId === companyId),
      ask: (q) =>
        update((l) => ({
          ...l,
          added: [...l.added, { ...q, id: `q-local-${Date.now().toString(36)}-${l.added.length + 1}`, askedAt: DEMO_DATE }],
        })),
      answer: (id, a) => update((l) => ({ ...l, answers: { ...l.answers, [id]: { ...a, at: DEMO_DATE } } })),
      questionsChanged: local.added.length > 0 || Object.keys(local.answers).length > 0,
      resetQuestions: () => update(() => EMPTY),
    }),
    [ready, session, setDemoRole, signIn, signOut, questions, update, local],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
