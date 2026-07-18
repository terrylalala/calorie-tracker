import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { NoDatabaseError, ensureSchema, getSql, hasDb } from "@/lib/db";
import { FoodEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  ts: Date | string;
  day: string;
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  note: string | null;
}

function toEntry(r: Row): FoodEntry {
  return {
    id: r.id,
    timestamp: r.ts instanceof Date ? r.ts.toISOString() : new Date(r.ts).toISOString(),
    date: r.day,
    name: r.name,
    portion: r.portion,
    calories: Number(r.calories),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    source: r.source === "photo" ? "photo" : "manual",
    note: r.note ?? undefined,
  };
}

/** Coerce arbitrary JSON into a safe FoodEntry, or null if unusable. */
function parseEntry(v: unknown): FoodEntry | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : null;
  const date = typeof o.date === "string" && o.date ? o.date : null;
  const name = typeof o.name === "string" && o.name ? o.name : null;
  if (!id || !date || !name) return null;
  const num = (x: unknown) => {
    const n = typeof x === "number" ? x : parseFloat(String(x));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const ts =
    typeof o.timestamp === "string" && !Number.isNaN(Date.parse(o.timestamp))
      ? o.timestamp
      : new Date().toISOString();
  return {
    id,
    timestamp: ts,
    date,
    name,
    portion: typeof o.portion === "string" ? o.portion : "",
    calories: num(o.calories),
    protein_g: num(o.protein_g),
    carbs_g: num(o.carbs_g),
    fat_g: num(o.fat_g),
    source: o.source === "photo" ? "photo" : "manual",
    note: typeof o.note === "string" ? o.note : undefined,
  };
}

export async function GET(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;
  if (!hasDb()) return noDb();

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      select id, ts, day, name, portion, calories, protein_g, carbs_g, fat_g, source, note
      from entries
      order by ts desc
      limit 2000
    `) as unknown as Row[];
    return NextResponse.json({ entries: rows.map(toEntry) });
  } catch (err) {
    return fail(err, "load entries");
  }
}

/** Accepts a single entry `{entry}` or a batch `{entries:[...]}` (used by migration). */
export async function POST(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;
  if (!hasDb()) return noDb();

  let body: { entry?: unknown; entries?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = Array.isArray(body.entries) ? body.entries : [body.entry];
  const parsed = raw.map(parseEntry).filter((e): e is FoodEntry => e !== null);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid entries supplied." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    for (const e of parsed) {
      await sql`
        insert into entries (id, ts, day, name, portion, calories, protein_g, carbs_g, fat_g, source, note)
        values (${e.id}, ${e.timestamp}, ${e.date}, ${e.name}, ${e.portion},
                ${e.calories}, ${e.protein_g}, ${e.carbs_g}, ${e.fat_g}, ${e.source}, ${e.note ?? null})
        on conflict (id) do update set
          ts = excluded.ts, day = excluded.day, name = excluded.name,
          portion = excluded.portion, calories = excluded.calories,
          protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
          fat_g = excluded.fat_g, source = excluded.source, note = excluded.note
      `;
    }
    return NextResponse.json({ saved: parsed.length });
  } catch (err) {
    return fail(err, "save entries");
  }
}

export async function DELETE(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;
  if (!hasDb()) return noDb();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing 'id'." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`delete from entries where id = ${id}`;
    return NextResponse.json({ deleted: id });
  } catch (err) {
    return fail(err, "delete entry");
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
  console.error(`[/api/entries] failed to ${action}`, err);
  return NextResponse.json(
    { error: `Could not ${action}. Please try again.` },
    { status: 500 },
  );
}
