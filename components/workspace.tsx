"use client";

// Who is signed in (partner or analyst), and the questions between them. The sign-in stays in this
// browser; the questions are saved on the server too, laid over the sample questions that ship with the app.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_DATE } from "@/lib/portfolio/health";
import { SEED_QUESTIONS, type Answer, type Question } from "@/lib/questions";
import { signInCheck, type Session } from "@/lib/auth";
import type { Role } from "@/lib/team";
import { hydrate, persist } from "@/lib/db/client";

export const ROLE_STORAGE_KEY = "ds.role.v1";
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
  userName: string;
  userEmail: string;
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

function readStoredRole(): Role | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get("role")?.toLowerCase();
    if (urlRole === "partner") return "Partner";
    if (urlRole === "analyst") return "Analyst";
    const s = (window.sessionStorage.getItem(ROLE_STORAGE_KEY) ?? window.localStorage.getItem(ROLE_STORAGE_KEY) ?? "").toLowerCase();
    if (s === "partner") return "Partner";
    if (s === "analyst") return "Analyst";
  } catch {
    // Ignore storage read errors.
  }
  return null;
}

function persistRole(role: Role) {
  try {
    window.sessionStorage.setItem(ROLE_STORAGE_KEY, role.toLowerCase());
    window.localStorage.setItem(ROLE_STORAGE_KEY, role.toLowerCase());
  } catch {
    // Ignore storage write errors.
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [local, setLocal] = useState<LocalQuestions>(EMPTY);

  useEffect(() => {
    const saved = read<Session | null>(KEYS.session, null);
    let urlOverride: Role | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("role")?.toLowerCase();
      if (r === "partner") urlOverride = "Partner";
      if (r === "analyst") urlOverride = "Analyst";
      if (urlOverride) {
        persistRole(urlOverride);
        params.delete("role");
        const cleanSearch = params.toString();
        const cleanUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", cleanUrl);
      }
    } catch {
      // Ignore URL cleanup errors.
    }
    const preferredRole = urlOverride ?? readStoredRole();
    const localSession = saved && saved.name && saved.role ? saved : null;
    if (localSession && preferredRole && localSession.role !== preferredRole) {
      localSession.role = preferredRole;
      localSession.name = preferredRole === "Partner" ? "Kabir Shah" : "Riya Menon";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(localSession);
    setLocal(read(KEYS.questions, EMPTY));
    hydrate<Partial<LocalQuestions>>(KEYS.questions, (v) => setLocal({ ...EMPTY, ...v }), window.localStorage.getItem(KEYS.questions) ? read(KEYS.questions, EMPTY) : null);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean; user?: { email?: string | null; name?: string | null } | null; role?: "partner" | "analyst" | null } | null) => {
        if (data?.enabled && data.user?.email && data.role) {
          const serverRole: Role = data.role === "partner" ? "Partner" : "Analyst";
          const currentRole = readStoredRole();
          const role: Role = urlOverride ?? currentRole ?? (localSession && localSession.email === data.user.email ? localSession.role : serverRole);
          persistRole(role);
          const defaultName = role === "Partner" ? "Kabir Shah" : "Riya Menon";
          const realName = data.user.name?.trim() || data.user.email.split("@")[0];
          const next: Session = {
            name: defaultName,
            role,
            email: data.user.email,
            userName: realName,
          };
          setSession(next);
          write(KEYS.session, next);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setDemoRole = useCallback((role: Role) => {
    persistRole(role);
    setSession((prev) => {
      const name = role === "Partner" ? "Kabir Shah" : "Riya Menon";
      const next: Session = {
        name,
        role,
        email: prev?.email ?? (role === "Partner" ? "kabir@fundhub.demo" : "riya@fundhub.demo"),
        userName: prev?.userName,
      };
      write(KEYS.session, next);
      return next;
    });
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    const r = signInCheck(email, password);
    if (typeof r === "string") return r;
    persistRole(r.role);
    setSession(r);
    write(KEYS.session, r);
    return null;
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    try {
      window.localStorage.removeItem(KEYS.session);
      window.sessionStorage.removeItem(ROLE_STORAGE_KEY);
      window.localStorage.removeItem(ROLE_STORAGE_KEY);
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
      userName: session?.userName || session?.name || "",
      userEmail: session?.email || "",
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
