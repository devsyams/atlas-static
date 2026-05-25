import { NextResponse } from "next/server";

import { getCurrentUser, type SessionUser } from "./index";

// Ascending privilege order; index = privilege level.
export const ROLES = ["viewer", "analyst", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** True if `have` meets or exceeds the `min` required role. Unknown role → false. */
export function roleAtLeast(have: string, min: Role): boolean {
  const h = (ROLES as readonly string[]).indexOf(have);
  return h >= 0 && h >= ROLES.indexOf(min);
}

export type Guard =
  | { user: SessionUser; response?: never }
  | { user?: never; response: NextResponse };

/**
 * Server-side route guard: resolves the session and enforces a minimum role.
 * Returns `{ user }` on success or `{ response }` (401/403) to return immediately.
 * RBAC is enforced here per-route, never by UI gating alone (spec §10).
 */
export async function requireRole(min: Role): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roleAtLeast(user.role, min)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
