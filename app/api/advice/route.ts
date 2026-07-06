import { NextRequest, NextResponse } from "next/server";
import {
  Anthropic,
  CLAUDE_MODEL,
  MissingApiKeyError,
  getAnthropic,
} from "@/lib/anthropic";

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
    const client = getAnthropic();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is my tracking data. Please give me personalized advice.\n\n${logsSummary}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Advice could not be generated for this request." },
        { status: 422 },
      );
    }

    const advice = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

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
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "Rate limited by the AI service. Please wait a moment and retry." },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json(
      { error: `AI service error: ${err.message}` },
      { status: err.status ?? 502 },
    );
  }
  console.error("[/api/advice] unexpected error", err);
  return NextResponse.json(
    { error: "Unexpected server error while generating advice." },
    { status: 500 },
  );
}
