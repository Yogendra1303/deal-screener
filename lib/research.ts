import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ResearchSchema, type DealRecord, type Research } from "./schema";
import { EFFORT, MODEL, assertFinished, costUsd, getClient } from "./ai";
import type { FormInput, RunStep } from "./types";
import { RESEARCH_SYSTEM, researchBrief } from "./prompts";

function toolSchema(): Anthropic.Tool["input_schema"] {
  const schema = z.toJSONSchema(ResearchSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema as Anthropic.Tool["input_schema"];
}

export async function runResearch(args: {
  form: FormInput;
  record: DealRecord;
}): Promise<{ research: Research; step: RunStep }> {
  const { form, record } = args;
  const client = getClient();
  const startedAt = Date.now();
  const brief = researchBrief(form, record);

  const tools: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 8 },
    {
      name: "submit_research",
      description: "Submit the finished research pack. Call this once, at the end.",
      strict: true,
      input_schema: toolSchema(),
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Research this company.\n\n${JSON.stringify(brief, null, 1)}` },
  ];
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 0 } };

  for (let turn = 0; turn < 5; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: RESEARCH_SYSTEM,
      output_config: { effort: EFFORT },
      tools,
      messages,
    });
    const message = await stream.finalMessage();
    usage.input_tokens += message.usage.input_tokens;
    usage.output_tokens += message.usage.output_tokens;
    usage.cache_creation_input_tokens += message.usage.cache_creation_input_tokens ?? 0;
    usage.cache_read_input_tokens += message.usage.cache_read_input_tokens ?? 0;
    usage.server_tool_use.web_search_requests += message.usage.server_tool_use?.web_search_requests ?? 0;
    assertFinished(message.stop_reason);

    const call = message.content.find((b) => b.type === "tool_use" && b.name === "submit_research");
    if (call && call.type === "tool_use") {
      const parsed = ResearchSchema.safeParse(call.input);
      if (!parsed.success) throw new Error("The research pack didn't match the expected format. Try again.");
      return {
        research: parsed.data,
        step: {
          step: "Research pack",
          ms: Date.now() - startedAt,
          inputTokens: usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
          outputTokens: usage.output_tokens,
          webSearches: usage.server_tool_use.web_search_requests,
          costUsd: +costUsd(MODEL, usage).toFixed(4),
        },
      };
    }

    // Long searches can pause; send the turn back so the model carries on.
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason !== "pause_turn") {
      messages.push({ role: "user", content: "Please call submit_research now with what you have found." });
    }
  }
  throw new Error("The research didn't finish. Try again.");
}
