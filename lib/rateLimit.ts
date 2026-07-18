import { NextResponse } from "next/server";
import { ensureSchema, getSql, hasDb } from "./db";

/**
 * Per-user daily caps on AI calls, so a single account can't run up the whole
 * Gemini bill. Counts live in the `usage` table, keyed by (user, day, kind).
 */

export type UsageKind = "analyze" | "advice";

function limitFor(kind: UsageKind): number {
  const fromEnv =
    kind === "analyze"
      ? process.env.DAILY_ANALYZE_LIMIT
      : process.env.DAILY_ADVICE_LIMIT;
  const n = Number(fromEnv);
  if (Number.isFinite(n) && n > 0) return n;
  return kind === "analyze" ? 40 : 20;
}

/**
 * Record one use and report whether it is allowed. Without a database (local
 * single-user mode) there is nothing to meter, so everything is allowed.
 */
export async function consume(
  userId: string,
  kind: UsageKind,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = limitFor(kind);
  if (!hasDb()) return { allowed: true, used: 0, limit };

  await ensureSchema();
  const sql = getSql();
  const day = new Date().toISOString().slice(0, 10);

  const rows = (await sql`
    insert into usage (user_id, day, kind, count)
    values (${userId}, ${day}, ${kind}, 1)
    on conflict (user_id, day, kind) do update set count = usage.count + 1
    returning count
  `) as unknown as { count: number }[];

  const used = rows[0]?.count ?? 1;
  return { allowed: used <= limit, used, limit };
}

export function rateLimited(limit: number): NextResponse {
  return NextResponse.json(
    {
      error: `Daily limit reached (${limit} per day). Try again tomorrow.`,
      code: "rate-limited",
    },
    { status: 429 },
  );
}
