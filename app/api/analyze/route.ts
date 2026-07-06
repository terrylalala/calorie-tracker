import { NextRequest, NextResponse } from "next/server";
import {
  Anthropic,
  CLAUDE_MODEL,
  MissingApiKeyError,
  getAnthropic,
} from "@/lib/anthropic";
import { Analysis } from "@/lib/types";

export const runtime = "nodejs";
// Photo analysis can take a few seconds; give the route room.
export const maxDuration = 60;

const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const SYSTEM_PROMPT = `You are a nutrition estimation assistant. Given a photo of food, identify each item, estimate a realistic portion size, and estimate calories and macronutrients (protein, carbs, fat in grams).

Guidelines:
- Base estimates on typical serving sizes and what is visible. Use the plate, utensils, and hands (if visible) for scale.
- The per-item macros should sum to roughly the plate totals.
- If the image does not clearly contain food, return zeros with confidence 0 and explain in "assumptions".
- Be realistic, not aspirational — restaurant portions and cooking oils add calories.
- Keep "assumptions" short and practical (what you assumed, what to adjust if wrong).

Respond with ONLY a single JSON object and nothing else — no markdown, no code fences, no commentary. Use exactly this shape:
{
  "title": string,              // short name for the whole plate, e.g. "Chicken burrito bowl"
  "items": [
    {
      "name": string,
      "portion": string,        // e.g. "1 cup", "150 g", "2 slices"
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "calories": number,           // total kcal for the whole plate
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": number,         // 0 to 1
  "assumptions": string
}
All numbers must be plain numbers (no units, no strings).`;

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json(
      { error: "Missing 'imageBase64' (base64 image data, no data: prefix)." },
      { status: 400 },
    );
  }
  if (!mediaType || !ALLOWED_MEDIA_TYPES.includes(mediaType as AllowedMediaType)) {
    return NextResponse.json(
      { error: `Unsupported media type. Use one of: ${ALLOWED_MEDIA_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  // Strip an accidental data: URL prefix if the client sent one.
  const data = imageBase64.includes(",")
    ? imageBase64.slice(imageBase64.indexOf(",") + 1)
    : imageBase64;

  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as AllowedMediaType,
                data,
              },
            },
            {
              type: "text",
              text: "Analyze this food photo and return the macro estimate as JSON.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The image could not be analyzed. Please try a different photo." },
        { status: 422 },
      );
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    const analysis = parseAnalysis(text);
    if (!analysis) {
      return NextResponse.json(
        { error: "Could not read the analysis. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    return handleError(err);
  }
}

/** Extract and normalize the JSON object from the model's text response. */
function parseAnalysis(text: string): Analysis | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const items = Array.isArray(o.items)
    ? o.items.map((it) => {
        const item = (it ?? {}) as Record<string, unknown>;
        return {
          name: str(item.name) || "Item",
          portion: str(item.portion),
          calories: num(item.calories),
          protein_g: num(item.protein_g),
          carbs_g: num(item.carbs_g),
          fat_g: num(item.fat_g),
        };
      })
    : [];

  return {
    title: str(o.title) || items[0]?.name || "Meal",
    items,
    calories: num(o.calories),
    protein_g: num(o.protein_g),
    carbs_g: num(o.carbs_g),
    fat_g: num(o.fat_g),
    confidence: Math.max(0, Math.min(1, num(o.confidence))),
    assumptions: str(o.assumptions),
  };
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
  console.error("[/api/analyze] unexpected error", err);
  return NextResponse.json(
    { error: "Unexpected server error while analyzing the photo." },
    { status: 500 },
  );
}
