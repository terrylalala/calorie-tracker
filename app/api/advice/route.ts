import { NextRequest, NextResponse } from "next/server";
import {
  GEMINI_MODEL,
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

const SYSTEM_PROMPT = `You are a supportive nutrition and wellness coach embedded in a calorie-tracking app.

You will be given a summary of the user's daily calorie/macro goals and their recent logged intake. Give personalized, practical, encouraging advice.

Rules:
- Ground every observation in the actual numbers provided. Reference specific patterns you see (e.g. protein consistently under target, calories spiking on weekends).
- Be concrete and actionable: suggest realistic food swaps, portion tweaks, or habits.
- Keep it warm and non-judgmental. Celebrate what's going well before flagging gaps.
- This is GENERAL WELLNESS guidance, not medical or clinical advice. Do not diagnose, and if the data suggests very low intake or a possible eating disorder, gently suggest speaking with a healthcare professional.
- Remember the intake numbers are AI photo estimates and are approximate.
- Format as short Markdown: a one-line summary, then 3-5 bullet points. Keep it under ~200 words. No preamble like "Here is your advice".`;

export async function POST(req: NextRequest) {
  const authz = await requireUser(req);
  if (!authz.ok) return authz.response;

  const quota = await consume(ownerId(authz.user), "advice");
  if (!quota.allowed) return rateLimited(quota.limit);

  let body: { logsSummary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { logsSummary } = body;
  if (!logsSummary || typeof logsSummary !== "string") {
    return NextResponse.json(
      { error: "Missing 'logsSummary'." },
      { status: 400 },
    );
  }

  try {
    const ai = getGemini();
    const { response } = await generateWithFallback(ai, {
      model: GEMINI_MODEL,
      contents: `Here is my tracking data. Please give me personalized advice.\n\n${logsSummary}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Disable "thinking" so the token budget goes to the actual advice text
        // instead of being consumed by internal reasoning (which truncates output).
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1200,
        temperature: 0.7,
        ...aiCallBounds(),
      },
    });

    if (response.promptFeedback?.blockReason) {
      return NextResponse.json(
        { error: "Advice could not be generated for this request." },
        { status: 422 },
      );
    }

    const advice = (response.text ?? "").trim();
    if (!advice) {
      return NextResponse.json(
        { error: "No advice returned. Please try again." },
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
    console.warn("[/api/advice] hit its deadline");
    return NextResponse.json(
      {
        error:
          "The AI service is taking longer than usual. Please try again — a second attempt often works.",
        code: "advice-timeout",
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
    console.warn("[/api/advice] Gemini returned 503 (model overloaded)");
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
    return NextResponse.json(
      { error: "The AI service returned an error. Please try again." },
      { status },
    );
  }
  console.error("[/api/advice] unexpected error", err);
  return NextResponse.json(
    { error: "Unexpected server error while generating advice." },
    { status: 500 },
  );
}
