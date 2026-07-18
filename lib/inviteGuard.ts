import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getSql, hasDb } from "./db";

/**
 * Brute-force protection for the invite code.
 *
 * Once the Google app is published, anyone can reach the registration endpoint,
 * so the invite code is the only thing standing between a stranger and an
 * account. Failed attempts are counted per IP and locked out after a threshold,
 * which makes guessing impractical without meaningfully inconveniencing anyone
 * typing their code in wrong once or twice.
 */

const MAX_FAILS = 10;
const LOCK_MINUTES = 15;
/** Failures older than this are forgiven (sliding window). */
const WINDOW_MINUTES = 60;

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

interface AttemptRow {
  fails: number;
  locked_until: Date | string | null;
}

/**
 * Returns a 429 response if this IP is currently locked out, otherwise null.
 */
export async function checkLockout(ip: string): Promise<NextResponse | null> {
  if (!hasDb()) return null;
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    select fails, locked_until from invite_attempts where ip = ${ip}
  `) as unknown as AttemptRow[];

  const row = rows[0];
  if (!row?.locked_until) return null;

  const until = new Date(row.locked_until).getTime();
  if (Number.isNaN(until) || until <= Date.now()) return null;

  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return NextResponse.json(
    {
      error: `Too many incorrect codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      code: "locked-out",
    },
    { status: 429, headers: { "Retry-After": String(minutes * 60) } },
  );
}

/** Record a failed attempt, locking the IP out once the threshold is hit. */
export async function recordFailure(ip: string): Promise<void> {
  if (!hasDb()) return;
  await ensureSchema();
  const sql = getSql();

  // Reset the counter if the previous failure window has expired.
  const rows = (await sql`
    insert into invite_attempts (ip, fails, first_at)
    values (${ip}, 1, now())
    on conflict (ip) do update set
      fails = case
        when invite_attempts.first_at < now() - interval '60 minutes' then 1
        else invite_attempts.fails + 1
      end,
      first_at = case
        when invite_attempts.first_at < now() - interval '60 minutes' then now()
        else invite_attempts.first_at
      end
    returning fails
  `) as unknown as { fails: number }[];

  if ((rows[0]?.fails ?? 0) >= MAX_FAILS) {
    await sql`
      update invite_attempts
      set locked_until = now() + interval '15 minutes', fails = 0, first_at = now()
      where ip = ${ip}
    `;
  }
}

/** Clear the record for an IP after a successful registration. */
export async function clearFailures(ip: string): Promise<void> {
  if (!hasDb()) return;
  await ensureSchema();
  const sql = getSql();
  await sql`delete from invite_attempts where ip = ${ip}`;
}

export const inviteGuardConfig = {
  MAX_FAILS,
  LOCK_MINUTES,
  WINDOW_MINUTES,
};
