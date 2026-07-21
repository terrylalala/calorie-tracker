import { neon, NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Server-only Neon Postgres access.
 *
 * The app works with or without a database: when no connection string is
 * configured the client falls back to localStorage (see lib/dataStore.ts).
 */

export function dbUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function hasDb(): boolean {
  return !!dbUrl();
}

/**
 * Whether Blob storage is usable.
 *
 * On Vercel the project authenticates to Blob with OIDC (workload identity),
 * where only BLOB_STORE_ID is present and no static token exists. Locally we
 * fall back to a read-write token. Requiring the token alone would silently
 * disable photo uploads in production once the token is revoked.
 */
export function hasBlob(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export class NoDatabaseError extends Error {
  constructor() {
    super("No database configured (DATABASE_URL / POSTGRES_URL is unset).");
    this.name = "NoDatabaseError";
  }
}

let client: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  const url = dbUrl();
  if (!url) throw new NoDatabaseError();
  if (!client) client = neon(url);
  return client;
}

// Create tables on first use per server instance. `if not exists` makes this
// safe to run repeatedly, so no separate migration step is needed on deploy.
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) schemaPromise = initSchema();
  return schemaPromise;
}

async function initSchema(): Promise<void> {
  const sql = getSql();

  // `double precision` (not numeric) so the driver returns JS numbers, not strings.
  await sql`
    create table if not exists entries (
      id          text primary key,
      ts          timestamptz      not null,
      day         text             not null,
      name        text             not null,
      portion     text             not null default '',
      calories    double precision not null default 0,
      protein_g   double precision not null default 0,
      carbs_g     double precision not null default 0,
      fat_g       double precision not null default 0,
      source      text             not null default 'manual',
      note        text
    )
  `;
  await sql`create index if not exists entries_day_idx on entries (day)`;
  await sql`create index if not exists entries_ts_idx on entries (ts desc)`;

  // --- Multi-user support ---

  // Registered accounts. Signing in with Google is not enough: an account only
  // appears here once it has been admitted with the invite code.
  await sql`
    create table if not exists users (
      id         text primary key,
      email      text not null,
      name       text,
      created_at timestamptz not null default now()
    )
  `;

  // Owner of each entry. Nullable so rows created before accounts existed can
  // be claimed by the first registered user.
  await sql`alter table entries add column if not exists user_id text`;
  await sql`create index if not exists entries_user_ts_idx on entries (user_id, ts desc)`;

  // Meal photo (Blob URL) and the model's per-item breakdown. photo_url is
  // server-side only — it is never sent to the browser; images are served
  // through /api/photo/[id], which checks ownership first.
  await sql`alter table entries add column if not exists photo_url text`;
  await sql`alter table entries add column if not exists items jsonb`;

  // A small copy of the photo for list rows. Separate blob object, so it must
  // also be removed on delete or it is orphaned but still billed. Null on rows
  // saved before this existed; /api/photo falls back to the full image.
  await sql`alter table entries add column if not exists thumb_url text`;

  // Per-user settings. A new table rather than migrating the old single-row
  // `settings` table, which is left untouched as legacy.
  await sql`
    create table if not exists user_settings (
      user_id text primary key,
      goals   jsonb,
      profile jsonb
    )
  `;

  // Daily AI usage counters, for per-user rate limiting.
  await sql`
    create table if not exists usage (
      user_id text not null,
      day     text not null,
      kind    text not null,
      count   int  not null default 0,
      primary key (user_id, day, kind)
    )
  `;

  // Failed invite-code attempts per IP, for brute-force protection.
  await sql`
    create table if not exists invite_attempts (
      ip           text primary key,
      fails        int  not null default 0,
      first_at     timestamptz not null default now(),
      locked_until timestamptz
    )
  `;

  // Legacy single-user table (pre-accounts). Kept so nothing is destroyed.
  await sql`
    create table if not exists settings (
      id      int primary key default 1,
      goals   jsonb,
      profile jsonb
    )
  `;
}
