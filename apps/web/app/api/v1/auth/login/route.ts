import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { attemptLogin } from "@/lib/auth/login";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 400 });
  }

  const result = await attemptLogin(getDb(), parsed.data.email, parsed.data.password);
  if (!result) {
    return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
