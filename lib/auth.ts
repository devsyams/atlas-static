/**
 * Demo-grade auth + per-user dashboard scoping. NOT real security — credentials
 * are visible client-side and the cookie is a presence flag. Its only job here is
 * to keep a scoped demo account (e.g. a BUMN CEO) from wandering into the other
 * dashboards during a live demo.
 *
 * Plain TS (no React / Node APIs) so it can be imported by both the Edge
 * middleware and client components.
 */

import { getBumn, listBumn } from "./bumn/registry";

/** `all` = super-admin; `danantara` = the CEO wall; `bumn:<slug>` = one BUMN CEO. */
export type Scope = "all" | "danantara" | `bumn:${string}`;

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

/** One scoped CEO login per registered BUMN (e.g. pln@nexorus.io / pln2026). */
const BUMN_USERS: DemoUser[] = listBumn().map((b) => ({
  email: `${b.slug}@nexorus.io`,
  password: `${b.slug}2026`,
  scope: `bumn:${b.slug}`,
  home: `/bumn/${b.slug}`,
  name: `${b.name} CEO`,
  role: "BUMN CEO",
}));

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
  ...BUMN_USERS,
];

export function findUser(email: string, password: string): DemoUser | null {
  const e = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === e && u.password === password) ?? null;
}

/** The `<slug>` of a `bumn:<slug>` scope, or null for any other scope. */
function bumnSlug(scope: Scope): string | null {
  return scope.startsWith("bumn:") ? scope.slice("bumn:".length) : null;
}

export function homeForScope(scope: Scope): string {
  if (scope === "danantara") return "/danantara";
  const slug = bumnSlug(scope);
  if (slug) return `/bumn/${slug}`;
  return "/";
}

/** Whether a given scope may view a page path. (API/_next/static are gated elsewhere.) */
export function scopeAllowsPath(scope: Scope, pathname: string): boolean {
  if (scope === "all") return true;
  if (scope === "danantara") return pathname.startsWith("/danantara");
  const slug = bumnSlug(scope);
  if (slug) {
    // A BUMN CEO only ever sees their own dashboard — not the index, not others.
    return pathname === `/bumn/${slug}` || pathname.startsWith(`/bumn/${slug}/`);
  }
  return false;
}

/** Read the scope cookie value into a typed Scope (client or server). */
export function parseScope(value: string | undefined | null): Scope {
  if (value === "danantara") return "danantara";
  if (value && value.startsWith("bumn:")) {
    // Only honour a bumn scope for a registered slug; otherwise treat as all.
    return getBumn(value.slice("bumn:".length)) ? (value as Scope) : "all";
  }
  return "all";
}
