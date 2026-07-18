import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client which storage backend to use. Deliberately unauthenticated
 * and secret-free — it only reports whether a database is configured.
 */
export async function GET() {
  return NextResponse.json({ storage: hasDb() ? "db" : "local" });
}
