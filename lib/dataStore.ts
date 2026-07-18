import { FoodEntry, Goals, DEFAULT_GOALS } from "./types";
import { Profile } from "./goalsCalc";
import { apiHeaders } from "./api";
import {
  loadEntries,
  saveEntries,
  loadGoals,
  saveGoals,
  loadProfile,
  saveProfile,
} from "./storage";

/**
 * Storage abstraction: uses Neon Postgres when the server reports one is
 * configured, otherwise falls back to localStorage. localStorage is always kept
 * updated as a local mirror so synchronous readers (and offline viewing) work.
 */

export type StorageMode = "db" | "local";

const MIGRATED_KEY = "act.migrated.v1";

function migratedFlag(): boolean {
  try {
    return window.localStorage.getItem(MIGRATED_KEY) === "1";
  } catch {
    return false;
  }
}

function setMigrated(): void {
  try {
    window.localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Ask the server which backend to use. Falls back to local on any failure. */
export async function detectMode(): Promise<StorageMode> {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return "local";
    const data = await res.json();
    return data.storage === "db" ? "db" : "local";
  } catch {
    return "local";
  }
}

export interface LoadedData {
  entries: FoodEntry[];
  goals: Goals;
  /** Set when we wanted the DB but couldn't reach it. */
  error?: string;
  /** Mode actually used (may downgrade to local if the DB call failed). */
  mode: StorageMode;
  migrated?: number;
}

/**
 * Load everything for startup. In db mode this also performs a one-time upload
 * of any pre-existing localStorage entries so nothing already logged is lost.
 */
export async function loadAll(mode: StorageMode): Promise<LoadedData> {
  if (mode === "local") {
    return { entries: loadEntries(), goals: loadGoals(), mode: "local" };
  }

  try {
    const [entriesRes, settingsRes] = await Promise.all([
      fetch("/api/entries", { headers: apiHeaders() }),
      fetch("/api/settings", { headers: apiHeaders() }),
    ]);

    if (!entriesRes.ok) {
      const data = await entriesRes.json().catch(() => ({}));
      // Fall back to local so the app still works (e.g. wrong access password).
      return {
        entries: loadEntries(),
        goals: loadGoals(),
        mode: "local",
        error: data.error || "Could not reach the database; showing local data.",
      };
    }

    let entries: FoodEntry[] = (await entriesRes.json()).entries ?? [];
    let migrated = 0;

    // One-time upload of this device's pre-existing local logs.
    //
    // We MERGE rather than only-migrate-when-empty: each device may hold meals
    // the database has never seen (e.g. phone synced first, then laptop). We
    // upload only the ids the server doesn't already have, so nothing is lost
    // and nothing is duplicated.
    const local = loadEntries();
    if (local.length > 0 && !migratedFlag()) {
      const known = new Set(entries.map((e) => e.id));
      const missing = local.filter((e) => !known.has(e.id));
      if (missing.length > 0) {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ entries: missing }),
        });
        if (res.ok) {
          migrated = missing.length;
          entries = [...missing, ...entries].sort(
            (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
          );
        }
      }
    }
    setMigrated();

    // Settings: prefer the DB, but seed it from local values on first run.
    let goals = DEFAULT_GOALS;
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      if (s.goals) {
        goals = { ...DEFAULT_GOALS, ...s.goals };
      } else {
        goals = loadGoals();
        await putSettings("db", { goals, profile: loadProfile() });
      }
      if (s.profile) saveProfile(s.profile as Partial<Profile>);
    } else {
      goals = loadGoals();
    }

    // Mirror locally for offline viewing / synchronous readers.
    saveEntries(entries);
    saveGoals(goals);

    return { entries, goals, mode: "db", migrated };
  } catch {
    return {
      entries: loadEntries(),
      goals: loadGoals(),
      mode: "local",
      error: "Could not reach the database; showing local data.",
    };
  }
}

/** Persist a new entry. Always mirrors to localStorage. */
export async function addEntry(
  mode: StorageMode,
  entry: FoodEntry,
  next: FoodEntry[],
): Promise<void> {
  saveEntries(next);
  if (mode !== "db") return;
  const res = await fetch("/api/entries", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ entry }),
  });
  if (!res.ok) throw new Error("Could not save to the database.");
}

export async function removeEntry(
  mode: StorageMode,
  id: string,
  next: FoodEntry[],
): Promise<void> {
  saveEntries(next);
  if (mode !== "db") return;
  const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Could not delete from the database.");
}

export async function putSettings(
  mode: StorageMode,
  data: { goals?: Goals; profile?: Partial<Profile> },
): Promise<void> {
  if (data.goals) saveGoals(data.goals);
  if (data.profile) saveProfile(data.profile);
  if (mode !== "db") return;
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: apiHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Could not save settings to the database.");
}
