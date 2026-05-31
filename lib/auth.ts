/**
 * Demo-grade auth + per-user dashboard scoping. NOT real security — credentials
 * are visible client-side and the cookie is a presence flag. Its only job here is
 * to keep a scoped demo account (e.g. the Danantara client) from wandering into
 * the other dashboards during a live demo.
 *
 * Plain TS (no React / Node APIs) so it can be imported by both the Edge
 * middleware and client components.
 */

export type Scope = "all" | "danantara";

export interface DemoUser {
  email: string;
  password: string;
  scope: Scope;
  /** Landing route after sign-in. */
  home: string;
  /** Display name + role label shown in the app shell. */
  name: string;
  role: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    email: "atlasadmin@nexorus.io",
    password: "adminatlas",
    scope: "all",
    home: "/",
    name: "Operator",
    role: "Super Admin",
  },
  {
    email: "danantara@nexorus.io",
    password: "danantara2026",
    scope: "danantara",
    home: "/danantara",
    name: "Danantara Analyst",
    role: "Sovereign Analyst",
  },
];

export function findUser(email: string, password: string): DemoUser | null {
  const e = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === e && u.password === password) ?? null;
}

export function homeForScope(scope: Scope): string {
  return scope === "danantara" ? "/danantara" : "/";
}

/** Whether a given scope may view a page path. (API/_next/static are gated elsewhere.) */
export function scopeAllowsPath(scope: Scope, pathname: string): boolean {
  if (scope === "all") return true;
  // Danantara-scoped users only ever see the Danantara dashboard.
  return pathname === "/danantara" || pathname.startsWith("/danantara/");
}

/** Read the scope cookie value into a typed Scope (client or server). */
export function parseScope(value: string | undefined | null): Scope {
  return value === "danantara" ? "danantara" : "all";
}
