import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AssessmentSchema, type Assessment } from "./schema";
import { EFFORT, MODEL, assertFinished, getClient, modelCapabilities, stepFrom } from "./ai";
import type { RunStep } from "./types";
import { ASSESS_SYSTEM, assessContext, type AssessArgs } from "./prompts";

export async function assessDeal(args: AssessArgs): Promise<{ assessment: Assessment; step: RunStep }> {
  const context = assessContext(args);

  const client = getClient();
  const startedAt = Date.now();
  const caps = modelCapabilities(MODEL);
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: caps.maxTokens,
    system: ASSESS_SYSTEM,
    output_config: {
      ...(caps.supportsEffort ? { effort: EFFORT } : {}),
      format: zodOutputFormat(AssessmentSchema),
    },
    messages: [
      {
        role: "user",
        content: `Assess this deal.\n\n${JSON.stringify(context, null, 1)}`,
      },
    ],
  });
  const message = await stream.finalMessage();
  assertFinished(message.stop_reason);
  const assessment = message.parsed_output;
  if (!assessment) throw new Error("The AI's assessment didn't match the expected format. Re-run this deck.");
  return { assessment, step: stepFrom("Score and write questions", startedAt, MODEL, message.usage) };
}
