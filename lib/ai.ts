import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const EFFORT: Effort = (["low", "medium", "high", "xhigh", "max"] as const).includes(
  process.env.AI_EFFORT as Effort,
)
  ? (process.env.AI_EFFORT as Effort)
  : "medium";

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
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
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
