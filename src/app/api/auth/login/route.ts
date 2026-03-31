import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "ems_ops_auth";

type LoginPayload = {
  password?: string;
  next?: string;
};

function sha256Base64Url(value: string): string {
  const hash = createHash("sha256").update(value, "utf8").digest("base64");
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as LoginPayload;
  const provided = (payload.password ?? "").trim();

  const expectedPassword = process.env.EMS_SHARED_PASSWORD ?? "";
  const secret = process.env.EMS_AUTH_SECRET ?? "";

  if (!expectedPassword || !secret) {
    return NextResponse.json(
      { error: "Auth is not configured. Set EMS_SHARED_PASSWORD and EMS_AUTH_SECRET." },
      { status: 500 },
    );
  }

  if (!provided) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!safeEquals(provided, expectedPassword)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = sha256Base64Url(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

