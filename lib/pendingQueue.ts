/**
 * A localStorage-backed queue of meal estimates that couldn't reach Gemini
 * because the device was offline. Each item holds everything needed to re-run
 * /api/analyze later — a downscaled photo, or a text description — so nothing a
 * user captured with no signal is lost. Retried when the connection returns.
 *
 * Deliberately NOT a service worker: this covers the real "no signal" gap while
 * avoiding the aggressive-caching / stuck-on-old-version failures a service
 * worker brings, which this app has been careful to steer clear of.
 */

const KEY = "act.pending.v1";
// Each queued photo is a downscaled base64 JPEG (~a few hundred KB). localStorage
// is only ~5 MB, so cap the queue rather than risk filling it and losing writes.
const MAX_ITEMS = 8;

export interface PendingItem {
  id: string;
  kind: "photo" | "text";
  /** ISO time the meal was captured (offline). */
  createdAt: string;
  // photo items:
  imageBase64?: string;
  mediaType?: string;
  thumbBase64?: string;
  /** data: URL for showing a preview without re-decoding. */
  previewDataUrl?: string;
  // text items:
  text?: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadQueue(): PendingItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: PendingItem[]): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    // QuotaExceededError (or private mode): the write didn't land.
    return false;
  }
}

export type EnqueueResult = "ok" | "full" | "error";

/** Append an item. Returns "full" if at capacity, "error" if storage rejected it. */
export function addToQueue(item: PendingItem): EnqueueResult {
  const items = loadQueue();
  if (items.length >= MAX_ITEMS) return "full";
  return save([...items, item]) ? "ok" : "error";
}

export function removeFromQueue(id: string): PendingItem[] {
  const next = loadQueue().filter((i) => i.id !== id);
  save(next);
  return next;
}
