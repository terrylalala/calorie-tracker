import { FoodEntry, Goals, DEFAULT_GOALS } from "./types";

// Versioned localStorage keys so we can migrate later without collisions.
const ENTRIES_KEY = "act.entries.v1";
const GOALS_KEY = "act.goals.v1";
const PASSWORD_KEY = "act.pw.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

// ---- Entries ----

export function loadEntries(): FoodEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FoodEntry[];
  } catch {
    return [];
  }
}

export function saveEntries(entries: FoodEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be full or blocked (private mode); fail silently.
  }
}

// ---- Goals ----

export function loadGoals(): Goals {
  if (!isBrowser()) return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_GOALS, ...parsed } as Goals;
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(goals: Goals): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch {
    // ignore
  }
}

// ---- Access password (only needed when the app is deployed with APP_PASSWORD) ----

export function loadPassword(): string {
  if (!isBrowser()) return "";
  try {
    return window.localStorage.getItem(PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

export function savePassword(pw: string): void {
  if (!isBrowser()) return;
  try {
    if (pw) window.localStorage.setItem(PASSWORD_KEY, pw);
    else window.localStorage.removeItem(PASSWORD_KEY);
  } catch {
    // ignore
  }
}
