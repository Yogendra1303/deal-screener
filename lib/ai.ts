import Anthropic from "@anthropic-ai/sdk";

// Default to Claude Sonnet 4.5 which supports native PDF vision, structured output_config, and 16k output tokens.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const EFFORT: Effort = (["low", "medium", "high", "xhigh", "max"] as const).includes(
  process.env.AI_EFFORT as Effort,
)
  ? (process.env.AI_EFFORT as Effort)
  : "medium";

/** Model capability bounds so older env overrides (e.g. claude-3-5-sonnet) never fail with 400 errors. */
export function modelCapabilities(model: string = MODEL): { maxTokens: number; supportsEffort: boolean } {
  const m = model.toLowerCase();
  if (m.includes("claude-3-5") || m.includes("claude-3-opus") || m.includes("claude-3-haiku")) {
    return { maxTokens: 8192, supportsEffort: false };
  }
  return { maxTokens: 16000, supportsEffort: true };
}

export class MissingKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local when running locally, or to the project's environment variables on Vercel.",
    );
  }
}

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClient(): Anthropic {
  if (!hasKey()) throw new MissingKeyError();
  return new Anthropic({ maxRetries: 3 });
}

// List prices in USD per million tokens. Used only for the cost estimate shown in the app.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-3-7-sonnet-20250219": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-3-opus-20240229": { input: 15, output: 75 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function costUsd(model: string, usage: UsageLike): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-4-5-20250929"];
  const input =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.05;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  return (input * p.input + usage.output_tokens * p.output) / 1_000_000 + searches * 0.01;
}

export function stepFrom(step: string, startedAt: number, model: string, usage: UsageLike) {
  return {
    step,
    ms: Date.now() - startedAt,
    inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
    webSearches: usage.server_tool_use?.web_search_requests ?? 0,
    costUsd: +costUsd(model, usage).toFixed(4),
  };
}

export function assertFinished(stopReason: string | null): void {
  if (stopReason === "refusal") throw new Error("The AI declined to process this request.");
  if (stopReason === "max_tokens") throw new Error("The AI ran out of output room before finishing. Try again.");
}
