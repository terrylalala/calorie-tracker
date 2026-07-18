import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Optional shared-secret guard for the AI routes.
 *
 * If APP_PASSWORD is set in the environment, callers must send a matching
 * `x-app-password` header, otherwise the request is rejected with 401. If
 * APP_PASSWORD is unset, auth is disabled (frictionless local use).
 *
 * Returns a 401 NextResponse to return early, or null when the request is
 * allowed to proceed.
 */
export function checkAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return null; // auth disabled

  const provided = req.headers.get("x-app-password") ?? "";
  if (!safeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Incorrect or missing access password. Set it in the Goals tab." },
      { status: 401 },
    );
  }
  return null;
}

/**
 * Verify an invite code against APP_PASSWORD. Used when registering a new
 * account. If APP_PASSWORD is unset, registration is open (no invite needed).
 */
export function verifyInvite(code: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  return safeEqual(code ?? "", expected);
}

/** Whether an invite code is required to register. */
export function inviteRequired(): boolean {
  return !!process.env.APP_PASSWORD;
}

/** Constant-time string comparison to avoid leaking length/content via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
