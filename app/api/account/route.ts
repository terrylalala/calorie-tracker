import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { inviteRequired, verifyInvite } from "@/lib/auth";
import { ensureSchema, getSql, hasDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CountRow {
  n: number;
}

/** Current sign-in / registration status for the visitor. */
export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({ accounts: false });
  }

  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email ?? null;

  if (!id) {
    return NextResponse.json({
      accounts: true,
      signedIn: false,
      registered: false,
      inviteRequired: inviteRequired(),
    });
  }

  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`select id from users where id = ${id}`) as unknown as {
    id: string;
  }[];

  return NextResponse.json({
    accounts: true,
    signedIn: true,
    registered: rows.length > 0,
    inviteRequired: inviteRequired(),
    user: { email, name: session?.user?.name ?? null },
  });
}

/** Register the signed-in Google account, gated by the invite code. */
export async function POST(req: NextRequest) {
  if (!hasDb()) {
    return NextResponse.json({ error: "Accounts are not enabled." }, { status: 501 });
  }

  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  const name = session?.user?.name ?? null;

  if (!id || !email) {
    return NextResponse.json(
      { error: "Please sign in first.", code: "signed-out" },
      { status: 401 },
    );
  }

  let body: { inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!verifyInvite(body.inviteCode ?? "")) {
    return NextResponse.json(
      { error: "That invite code isn't right." },
      { status: 403 },
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();

    await sql`
      insert into users (id, email, name)
      values (${id}, ${email}, ${name})
      on conflict (id) do update set email = excluded.email, name = excluded.name
    `;

    // The first registered account adopts any data created before accounts
    // existed, so the original owner keeps their history.
    const counts = (await sql`select count(*)::int as n from users`) as unknown as CountRow[];
    let claimed = 0;
    if (counts[0]?.n === 1) {
      const res = (await sql`
        update entries set user_id = ${id} where user_id is null
      `) as unknown as { rowCount?: number };
      claimed = res?.rowCount ?? 0;

      const legacy = (await sql`
        select goals, profile from settings where id = 1
      `) as unknown as { goals: unknown; profile: unknown }[];
      if (legacy[0]) {
        await sql`
          insert into user_settings (user_id, goals, profile)
          values (${id}, ${JSON.stringify(legacy[0].goals ?? null)}::jsonb,
                        ${JSON.stringify(legacy[0].profile ?? null)}::jsonb)
          on conflict (user_id) do nothing
        `;
      }
    }

    return NextResponse.json({ registered: true, claimed });
  } catch (err) {
    console.error("[/api/account] registration failed", err);
    return NextResponse.json(
      { error: "Could not complete registration. Please try again." },
      { status: 500 },
    );
  }
}
