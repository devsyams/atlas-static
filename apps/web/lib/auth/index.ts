import { cookies } from "next/headers";

import { getDb } from "../db/client";
import { getSessionUser, type SessionUser } from "./session";

export const SESSION_COOKIE = "atlas_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export type { SessionUser };

/** Read the current user from the session cookie (server components / route handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(getDb(), token);
}
