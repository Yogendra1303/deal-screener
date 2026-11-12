import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DealRecordWireSchema, toRecord, type DealRecord } from "./schema";
import { EXTRACT_SYSTEM } from "./prompts";
import { EFFORT, MODEL, assertFinished, getClient, stepFrom } from "./ai";
import type { RunStep } from "./types";

export async function extractRecord(pdfBase64: string): Promise<{ record: DealRecord; step: RunStep }> {
  const client = getClient();
  const startedAt = Date.now();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: EXTRACT_SYSTEM,
    output_config: { effort: EFFORT, format: zodOutputFormat(DealRecordWireSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: "Fill the standard deal record from this pitch deck." },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  assertFinished(message.stop_reason);
  const wire = message.parsed_output;
  if (!wire) throw new Error("The AI's answer didn't match the deal record format. Re-run this deck.");
  return { record: toRecord(wire), step: stepFrom("Read the deck", startedAt, MODEL, message.usage) };
}
