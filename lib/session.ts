import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkAuth } from "./auth";
import { ensureSchema, getSql, hasDb } from "./db";

/**
 * Authorization for API routes.
 *
 * Two modes:
 *  - Database configured  → real accounts. The caller must be signed in AND
 *    registered (admitted with the invite code). Everything is scoped to their
 *    user id, so one account can never see another's data.
 *  - No database          → single-user local mode. Falls back to the legacy
 *    APP_PASSWORD header check so local development still works.
 */

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

export type AuthResult =
  | { ok: true; user: SessionUser | null }
  | { ok: false; response: NextResponse };

/** The single-user id used when running without a database. */
export const LOCAL_USER: SessionUser = {
  id: "local",
  email: "local@localhost",
  name: "Local",
};

export async function requireUser(req: NextRequest): Promise<AuthResult> {
  // No database → legacy shared-password mode, single user.
  if (!hasDb()) {
    const legacy = checkAuth(req);
    if (legacy) return { ok: false, response: legacy };
    return { ok: true, user: null };
  }

  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;

  if (!id || !email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Please sign in.", code: "signed-out" },
        { status: 401 },
      ),
    };
  }

  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`select id from users where id = ${id}`) as unknown as {
    id: string;
  }[];

  if (rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This account needs an invite code.", code: "needs-invite" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: { id, email, name: session?.user?.name ?? undefined },
  };
}

/**
 * The owner id to scope queries by. `null` (no-database mode) maps to the
 * fixed LOCAL_USER id so the same SQL works in both modes.
 */
export function ownerId(user: SessionUser | null): string {
  return user ? user.id : LOCAL_USER.id;
}
