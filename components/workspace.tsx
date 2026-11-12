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
    // Load this browser's choices once, after the first render.
    const saved = read<Session | null>(KEYS.session, null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(saved && saved.name && saved.role ? saved : null);
    setLocal(read(KEYS.questions, EMPTY));
    setReady(true);
    hydrate<Partial<LocalQuestions>>(KEYS.questions, (v) => setLocal({ ...EMPTY, ...v }), window.localStorage.getItem(KEYS.questions) ? read(KEYS.questions, EMPTY) : null);
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
    [ready, session, signIn, signOut, questions, update, local],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
