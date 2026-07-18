import { NextRequest, NextResponse } from "next/server";
import { NoDatabaseError, ensureSchema, getSql, hasDb } from "@/lib/db";
import { ownerId, requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsRow {
  goals: unknown;
  profile: unknown;
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
      select goals, profile from user_settings where user_id = ${uid}
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
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;
  if (!hasDb()) return noDb();
  const uid = ownerId(authz.user);

  let body: { goals?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const goals = body.goals === undefined ? null : JSON.stringify(body.goals);
    const profile = body.profile === undefined ? null : JSON.stringify(body.profile);
    await sql`
      insert into user_settings (user_id, goals, profile)
      values (${uid}, ${goals}::jsonb, ${profile}::jsonb)
      on conflict (user_id) do update set
        goals   = coalesce(excluded.goals, user_settings.goals),
        profile = coalesce(excluded.profile, user_settings.profile)
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
