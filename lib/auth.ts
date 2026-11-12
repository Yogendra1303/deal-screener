// Demo sign-in. The accounts below exist only to show the two roles; the check runs in the browser,
// so this is not security. A real build would use the fund's Google or Microsoft sign-in, with roles
// held on the server and every request checked there.
import type { Role } from "./team";

export interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: Role;
  sees: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "kabir@fundhub.demo",
    password: "partner123",
    name: "Kabir Shah",
    role: "Partner",
    sees: "The whole fund: decisions, every company, and each analyst's work",
  },
  {
    email: "riya@fundhub.demo",
    password: "analyst123",
    name: "Riya Menon",
    role: "Analyst",
    sees: "Her own companies and pitches: numbers to check, reports to read, founders to chase",
  },
  {
    email: "arjun@fundhub.demo",
    password: "analyst123",
    name: "Arjun Bhat",
    role: "Analyst",
    sees: "His own companies and pitches: numbers to check, reports to read, founders to chase",
  },
];

export interface Session {
  name: string;
  role: Role;
  email: string;
}

export function signInCheck(email: string, password: string): Session | string {
  const a = DEMO_ACCOUNTS.find((x) => x.email === email.trim().toLowerCase());
  if (!a || a.password !== password) return "That email and password don't match a demo account.";
  return { name: a.name, role: a.role, email: a.email };
}
