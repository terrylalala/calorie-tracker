import { GoogleGenAI, ApiError } from "@google/genai";

/**
 * Server-only Google Gen AI (Gemini) client. Reads the API key from the
 * environment. Must never be imported from client components — it exists purely
 * for the /api routes.
 */

// `gemini-flash-latest` is an alias that always resolves to the current Flash
// model, so pinned versions being retired won't break the app. Override with the
// GEMINI_MODEL env var to pin a specific version (e.g. gemini-3.5-flash).
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

/**
 * Used when GEMINI_MODEL returns 503 (overloaded).
 *
 * Flash has now been overloaded twice in two days — five hours on 20-21 July
 * and again that evening — during which the app could do nothing but apologise.
 * Probed at 22:50 on 21 July while Flash was returning 503 on every call:
 * flash-lite answered in 813ms and pro-latest in 1761ms, so the outage is
 * per-model rather than account-wide, and is survivable.
 *
 * Lite rather than pro: it was the faster of the two, and pro's free-tier
 * limits are tighter, so leaning on it during a long outage risks trading a
 * 503 for a 429. Lite is a smaller model, so estimates may be slightly less
 * accurate — the routes report which model answered so the UI can say so.
 *
 * Only alias names work on this key. Pinned names (gemini-2.5-flash,
 * gemini-2.0-flash) all returned 404 in the same probe.
 */
export const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";

// Accept either GEMINI_API_KEY (preferred) or GOOGLE_API_KEY as a fallback.
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

let client: GoogleGenAI | null = null;

/** Returns a singleton client, or throws a clear error if the key is missing. */
export function getGemini(): GoogleGenAI {
  const key = apiKey();
  if (!key) {
    throw new MissingApiKeyError();
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
}

/**
 * Deadline for any Gemini call, comfortably inside the routes' maxDuration = 60
 * so a route still gets to return a useful message instead of being killed.
 *
 * This exists because of a real failure: on 20 July /api/analyze was terminated
 * by the platform at 60s ("Vercel Runtime Timeout Error") and the user saw a
 * generic error after a full minute of waiting. /api/advice returned a 503 in
 * the same window.
 *
 * Two mechanisms, and they are NOT interchangeable:
 * - `abortSignal` is client-side and is the authoritative bound. It fires on
 *   time and throws. The SDK otherwise retries 5 times by default
 *   (HttpRetryOptions.attempts), which inside a 60s budget silently stacks
 *   attempts until the platform kills the function — so slowness and timeouts
 *   are the same fault, not two.
 * - `httpOptions.timeout` is a server-side deadline sent to Google, and it has
 *   a 10-SECOND FLOOR: below 10_000 it returns an immediate HTTP 400
 *   INVALID_ARGUMENT rather than timing out quickly, which looks nothing like a
 *   timeout and sends you hunting in the wrong place.
 */
export const AI_TIMEOUT_MS = 45_000;

/**
 * Two attempts, not the SDK default of five. A call that has already run ~14s
 * (the measured healthy latency) cannot fit four more into a 45s deadline; the
 * retries simply eat the budget that would have produced an answer.
 */
export const AI_ATTEMPTS = 2;

/**
 * Spread into a generateContent `config` to bound the call.
 *
 * Deliberately shared rather than copied per route: this guard was written for
 * /api/prices in the sibling project and never brought across, which is exactly
 * why /api/analyze and /api/advice were still unbounded when they failed. One
 * definition means the next route added cannot quietly miss it.
 */
export function aiCallBounds(timeoutMs: number = AI_TIMEOUT_MS) {
  return {
    // The authoritative bound, and the only one allowed to go short.
    abortSignal: AbortSignal.timeout(timeoutMs),
    httpOptions: {
      // Clamped to the 10s floor described above. A caller asking for less is
      // asking for a fast failure, and passing it straight through would give
      // them an immediate HTTP 400 INVALID_ARGUMENT instead — a failure that
      // looks nothing like a timeout. The abortSignal above still fires at the
      // requested time, so a short deadline behaves as intended either way.
      timeout: Math.max(timeoutMs, 10_000),
      retryOptions: { attempts: AI_ATTEMPTS },
    },
  };
}

/**
 * Runs a generateContent call, retrying once on a different model if the
 * primary one is overloaded.
 *
 * Shared here rather than written into a route for the same reason
 * aiCallBounds is: the last four bugs in this project were a fix that lived in
 * one place and never reached its twin.
 *
 * ONLY 503 falls back. A timeout, a 429 or a 4xx means something else is wrong,
 * and firing a second model at it would double the cost of the failure while
 * making the logs harder to read.
 *
 * The fallback gets its own bounds, because the original abortSignal has
 * usually already been consumed — and if the first attempt burned most of the
 * budget, the retry needs a fresh one to have any chance of finishing.
 *
 * Returns which model actually answered, so a route can tell the client its
 * numbers came from the smaller model.
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  request: { model?: string; contents: unknown; config?: Record<string, unknown> },
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<{ response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>; model: string; usedFallback: boolean }> {
  const primary = request.model ?? GEMINI_MODEL;
  const base = { ...request } as Parameters<GoogleGenAI["models"]["generateContent"]>[0];
  const startedAt = Date.now();

  try {
    const response = await ai.models.generateContent({ ...base, model: primary });
    return { response, model: primary, usedFallback: false };
  } catch (err) {
    if (!isOverloadedError(err) || GEMINI_FALLBACK_MODEL === primary) throw err;

    // The fallback gets what is LEFT of the budget, not a fresh copy of it.
    // Giving it a full timeoutMs meant a 503 arriving late could put the two
    // attempts past the routes' maxDuration = 60, and the platform kills the
    // function rather than letting it answer — the exact failure the bounds in
    // this file were written to prevent.
    const spent = Date.now() - startedAt;
    const remaining = Math.max(timeoutMs - spent, 0);
    if (remaining < 8_000) {
      console.warn(
        `[gemini] ${primary} returned 503 after ${spent}ms; too little budget left to retry`,
      );
      throw err;
    }

    console.warn(
      `[gemini] ${primary} returned 503 after ${spent}ms; retrying on ${GEMINI_FALLBACK_MODEL} with ${remaining}ms left`,
    );
    const response = await ai.models.generateContent({
      ...base,
      model: GEMINI_FALLBACK_MODEL,
      config: { ...(request.config ?? {}), ...aiCallBounds(remaining) },
    });
    return { response, model: GEMINI_FALLBACK_MODEL, usedFallback: true };
  }
}

/**
 * True when a call hit its deadline.
 *
 * Matches on the error NAME rather than the type, and accepts both spellings.
 * Verified against the live API with @google/genai 1.52.0: an
 * `AbortSignal.timeout()` deadline surfaces here as **AbortError**, not the
 * TimeoutError that AbortSignal.timeout() is documented to raise. Matching only
 * TimeoutError would fall through to the generic error branch and look exactly
 * like no fix at all.
 */
export function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown })?.name;
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * True when Gemini itself is overloaded rather than anything being wrong here.
 *
 * Observed for five straight hours on 20-21 July 2026: every call returned
 * HTTP 503 "This model is currently experiencing high demand". The app reported
 * that as "The AI service returned an error", which reads like the app is
 * broken and gives the user nothing to act on.
 *
 * 503 is the one error where "try again" is genuinely the right advice - it is
 * transient, it is not the user's fault, and it costs nothing to retry because
 * these fail in 2-7s rather than consuming the request budget.
 *
 * Distinct from 429, which the routes already handle separately: 429 is quota
 * exhaustion and retrying immediately makes it worse. Do not merge the two.
 */
export function isOverloadedError(err: unknown): boolean {
  return (err as { status?: unknown })?.status === 503;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Copy .env.local.example to .env.local and add your key, then restart the dev server.",
    );
    this.name = "MissingApiKeyError";
  }
}

export { GoogleGenAI, ApiError };
