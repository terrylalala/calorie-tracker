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
