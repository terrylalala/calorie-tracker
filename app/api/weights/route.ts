import { NextRequest, NextResponse } from "next/server";
import { NoDatabaseError, ensureSchema, getSql, hasDb } from "@/lib/db";
import { ownerId, requireUser } from "@/lib/session";
import { WeightEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  ts: Date | string;
  day: string;
  kg: number;
}

function toWeight(r: Row): WeightEntry {
  return {
    id: r.id,
    timestamp: r.ts instanceof Date ? r.ts.toISOString() : new Date(r.ts).toISOString(),
    date: r.day,
    kg: Number(r.kg),
  };
}

/** Parse and sanity-check a single reading. Rejects anything outside 20–500 kg. */
function parseWeight(v: unknown): WeightEntry | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : null;
  const date = typeof o.date === "string" && o.date ? o.date : null;
  const kg = typeof o.kg === "number" ? o.kg : parseFloat(String(o.kg));
  if (!id || !date || !Number.isFinite(kg) || kg < 20 || kg > 500) return null;
  const ts =
    typeof o.timestamp === "string" && !Number.isNaN(Date.parse(o.timestamp))
      ? o.timestamp
      : new Date().toISOString();
  return { id, timestamp: ts, date, kg };
}

export async function GET(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;
  if (!hasDb()) return noDb();
  const uid = ownerId(authz.user);

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      select id, ts, day, kg from weights
      where user_id = ${uid}
      order by ts desc
      limit 1000
    `) as unknown as Row[];
    return NextResponse.json({ weights: rows.map(toWeight) });
  } catch (err) {
    return fail(err, "load weights");
  }
}

export async function POST(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;
  if (!hasDb()) return noDb();
  const uid = ownerId(authz.user);

  let body: { entry?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const w = parseWeight(body.entry);
  if (!w) {
    return NextResponse.json({ error: "Invalid weight reading." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    // `where weights.user_id = uid` on the update branch stops one account
    // overwriting another's row by guessing its id.
    await sql`
      insert into weights (id, user_id, ts, day, kg)
      values (${w.id}, ${uid}, ${w.timestamp}, ${w.date}, ${w.kg})
      on conflict (id) do update set
        ts = excluded.ts, day = excluded.day, kg = excluded.kg
      where weights.user_id = ${uid}
    `;
    return NextResponse.json({ saved: w.id });
  } catch (err) {
    return fail(err, "save weight");
  }
}

export async function DELETE(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;
  if (!hasDb()) return noDb();
  const uid = ownerId(authz.user);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing 'id'." }, { status: 400 });

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`delete from weights where id = ${id} and user_id = ${uid}`;
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return fail(err, "delete weight");
  }
}

function noDb() {
  return NextResponse.json(
    { error: "No database configured.", storage: "local" },
    { status: 501 },
  );
}

function fail(err: unknown, action: string) {
  if (err instanceof NoDatabaseError) return noDb();
  console.error(`[/api/weights] failed to ${action}`, err);
  return NextResponse.json(
    { error: `Could not ${action}. Please try again.` },
    { status: 500 },
  );
}
