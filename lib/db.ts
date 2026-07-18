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

  // Single-row table: this is a personal, single-user app.
  await sql`
    create table if not exists settings (
      id      int primary key default 1,
      goals   jsonb,
      profile jsonb
    )
  `;
}
