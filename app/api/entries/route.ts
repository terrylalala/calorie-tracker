import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { NoDatabaseError, ensureSchema, getSql, hasBlob, hasDb } from "@/lib/db";
import { ownerId, requireUser } from "@/lib/session";
import { AnalyzedItem, FoodEntry } from "@/lib/types";

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
  items: unknown;
  has_photo: boolean;
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
    items: Array.isArray(r.items) ? (r.items as AnalyzedItem[]) : undefined,
    // Note we expose only a boolean — never the underlying Blob URL.
    hasPhoto: !!r.has_photo,
  };
}

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BASE64 = 10_000_000;

/** Upload a meal photo to Blob storage. Returns the URL, or null on failure. */
async function uploadPhoto(
  entryId: string,
  userId: string,
  base64: string,
  mediaType: string,
): Promise<string | null> {
  if (!hasBlob()) {
    console.warn("[/api/entries] photo skipped: Blob storage is not configured");
    return null;
  }
  if (!ALLOWED_PHOTO_TYPES.includes(mediaType)) return null;
  const data = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  if (!data || data.length > MAX_PHOTO_BASE64) return null;

  try {
    const bytes = Buffer.from(data, "base64");
    const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    // Private store: the object cannot be read without the store token, so even
    // a leaked URL is useless. Reads go through /api/photo/[id], which checks
    // ownership first.
    const blob = await put(`meals/${userId}/${entryId}.${ext}`, bytes, {
      access: "private",
      contentType: mediaType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[/api/entries] photo upload failed", err);
    return null;
  }
}

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
    items: Array.isArray(o.items)
      ? (o.items as unknown[]).map((it) => {
          const i = (it ?? {}) as Record<string, unknown>;
          return {
            name: typeof i.name === "string" ? i.name : "Item",
            portion: typeof i.portion === "string" ? i.portion : "",
            calories: num(i.calories),
            protein_g: num(i.protein_g),
            carbs_g: num(i.carbs_g),
            fat_g: num(i.fat_g),
          };
        })
      : undefined,
  };
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
      select id, ts, day, name, portion, calories, protein_g, carbs_g, fat_g, source, note,
             items, (photo_url is not null) as has_photo
      from entries
      where user_id = ${uid}
      order by ts desc
      limit 2000
    `) as unknown as Row[];
    return NextResponse.json({ entries: rows.map(toEntry) });
  } catch (err) {
    return fail(err, "load entries");
  }
}

export async function POST(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;
  if (!hasDb()) return noDb();
  const uid = ownerId(authz.user);

  let body: {
    entry?: unknown;
    entries?: unknown;
    photoBase64?: string;
    photoMediaType?: string;
  };
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

  // A photo only applies to a single-entry save (not the bulk migration path).
  let photoUrl: string | null = null;
  if (parsed.length === 1 && body.photoBase64 && body.photoMediaType) {
    photoUrl = await uploadPhoto(
      parsed[0].id,
      uid,
      body.photoBase64,
      body.photoMediaType,
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    for (const e of parsed) {
      const items = e.items ? JSON.stringify(e.items) : null;
      // `where entries.user_id = uid` on the update branch stops one account
      // overwriting another's row by guessing its id.
      await sql`
        insert into entries (id, user_id, ts, day, name, portion, calories, protein_g, carbs_g, fat_g, source, note, items, photo_url)
        values (${e.id}, ${uid}, ${e.timestamp}, ${e.date}, ${e.name}, ${e.portion},
                ${e.calories}, ${e.protein_g}, ${e.carbs_g}, ${e.fat_g}, ${e.source}, ${e.note ?? null},
                ${items}::jsonb, ${photoUrl})
        on conflict (id) do update set
          ts = excluded.ts, day = excluded.day, name = excluded.name,
          portion = excluded.portion, calories = excluded.calories,
          protein_g = excluded.protein_g, carbs_g = excluded.carbs_g,
          fat_g = excluded.fat_g, source = excluded.source, note = excluded.note,
          items = coalesce(excluded.items, entries.items),
          photo_url = coalesce(excluded.photo_url, entries.photo_url)
        where entries.user_id = ${uid}
      `;
    }
    return NextResponse.json({ saved: parsed.length });
  } catch (err) {
    return fail(err, "save entries");
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
    // Scoped delete: you can only remove your own rows. Returning photo_url
    // lets us clean up the stored image instead of leaving it orphaned.
    const removed = (await sql`
      delete from entries where id = ${id} and user_id = ${uid}
      returning photo_url
    `) as unknown as { photo_url: string | null }[];

    const photo = removed[0]?.photo_url;
    if (photo && hasBlob()) {
      try {
        await del(photo);
      } catch (err) {
        // Non-fatal: the row is gone, the blob is just left behind.
        console.error("[/api/entries] blob delete failed", err);
      }
    }
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
