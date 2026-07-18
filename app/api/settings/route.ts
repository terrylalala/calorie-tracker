import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { NoDatabaseError, ensureSchema, getSql, hasDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsRow {
  goals: unknown;
  profile: unknown;
}

export async function GET(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;
  if (!hasDb()) return noDb();

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      select goals, profile from settings where id = 1
    `) as unknown as SettingsRow[];
    const row = rows[0];
    return NextResponse.json({
      goals: row?.goals ?? null,
      profile: row?.profile ?? null,
    });
  } catch (err) {
    return fail(err, "load settings");
  }
}

export async function PUT(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;
  if (!hasDb()) return noDb();

  let body: { goals?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    // Only overwrite the keys that were actually supplied.
    const goals = body.goals === undefined ? null : JSON.stringify(body.goals);
    const profile = body.profile === undefined ? null : JSON.stringify(body.profile);
    await sql`
      insert into settings (id, goals, profile)
      values (1, ${goals}::jsonb, ${profile}::jsonb)
      on conflict (id) do update set
        goals   = coalesce(excluded.goals, settings.goals),
        profile = coalesce(excluded.profile, settings.profile)
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "save settings");
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
  console.error(`[/api/settings] failed to ${action}`, err);
  return NextResponse.json(
    { error: `Could not ${action}. Please try again.` },
    { status: 500 },
  );
}
