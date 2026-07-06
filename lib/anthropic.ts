import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client. The SDK reads ANTHROPIC_API_KEY from the
 * environment automatically. This module must never be imported from client
 * components — it exists purely for the /api routes.
 */

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

let client: Anthropic | null = null;

/** Returns a singleton client, or throws a clear error if the key is missing. */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and add your key, then restart the dev server.",
    );
    this.name = "MissingApiKeyError";
  }
}

export { Anthropic };
