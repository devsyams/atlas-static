import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { writeAudit } from "@/lib/auth/audit";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    const user = await getSessionUser(db, token);
    await destroySession(db, token);
    if (user) {
      await writeAudit(db, { userId: user.userId, action: "auth.logout" });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
