import { NextRequest, NextResponse } from "next/server";
import {
  GEMINI_MODEL,
  MINIMAL_THINKING,
  MissingApiKeyError,
  aiCallBounds,
  generateWithFallback,
  getGemini,
  isAbortError,
  isOverloadedError,
} from "@/lib/gemini";
import { ownerId, requireUser } from "@/lib/session";
import { consume, rateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a supportive nutrition and wellness coach.

The app has already CALCULATED daily calorie and macro targets for the user from their profile using the Mifflin-St Jeor equation. Your job is to explain those targets in warm, plain language — do NOT recalculate or contradict the numbers you are given.

Rules:
- Briefly explain why these targets fit their stated goal (lose / maintain / gain) and profile.
- Give 2-3 concrete, encouraging tips for hitting them (e.g. protein sources, meal timing, consistency).
- This is GENERAL WELLNESS guidance, not medical or clinical advice. Add a short note to consult a doctor or dietitian before big changes, and especially if pregnant, under 18, managing a health condition, or with any history of disordered eating.
- Keep it under ~160 words. Format as short Markdown: a one-line summary then a few bullet points. No preamble like "Here is".`;

export async function POST(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;

  const quota = await consume(ownerId(authz.user), "advice");
  if (!quota.allowed) return rateLimited(quota.limit);

  let body: { summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { summary } = body;
  if (!summary || typeof summary !== "string") {
    return NextResponse.json({ error: "Missing 'summary'." }, { status: 400 });
  }

  try {
    const ai = getGemini();
    const { response } = await generateWithFallback(ai, {
      model: GEMINI_MODEL,
      contents: `Here is my profile and the targets the app calculated. Please explain them.\n\n${summary}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        thinkingConfig: MINIMAL_THINKING,
        // Doubled to leave room if generateOnce has to drop thinkingConfig.
        maxOutputTokens: 1800,
        temperature: 0.7,
        ...aiCallBounds(),
      },
    });

    if (response.promptFeedback?.blockReason) {
      return NextResponse.json(
        { error: "Explanation could not be generated." },
        { status: 422 },
      );
    }

    const advice = (response.text ?? "").trim();
    if (!advice) {
      return NextResponse.json(
        { error: "No explanation returned. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ advice });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof MissingApiKeyError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  if (isAbortError(err)) {
    console.warn("[/api/goal-advice] hit its deadline");
    return NextResponse.json(
      {
        error:
          "The AI service is taking longer than usual. Please try again — a second attempt often works.",
        code: "goal-advice-timeout",
      },
      { status: 504 },
    );
  }
  const status = typeof (err as { status?: unknown })?.status === "number"
    ? (err as { status: number }).status
    : undefined;
  // Gemini is overloaded. Distinct from the generic 4xx/5xx branch below,
  // because this one is transient and retrying really is the right advice.
  if (isOverloadedError(err)) {
    console.warn("[/api/goal-advice] Gemini returned 503 (model overloaded)");
    return NextResponse.json(
      {
        error:
          "The AI service is very busy right now. Please try again in a moment \u2014 this is on their side, not yours.",
        code: "ai-overloaded",
      },
      { status: 503 },
    );
  }

  if (status === 429) {
    return NextResponse.json(
      { error: "Rate limited by the AI service. Please wait a moment and retry." },
      { status: 429 },
    );
  }
  if (status && status >= 400 && status < 600) {
    // Log the real cause. This branch used to swallow it, so a Gemini 400 that
    // broke every AI feature at once left nothing in the logs but the status
    // code, and the cause had to be reproduced by hand against the live API.
    console.error(`[/api/goal-advice] Gemini returned ${status}`, err);
    return NextResponse.json(
      { error: "The AI service returned an error. Please try again." },
      { status },
    );
  }
  console.error("[/api/goal-advice] unexpected error", err);
  return NextResponse.json(
    { error: "Unexpected server error while generating the explanation." },
    { status: 500 },
  );
}
