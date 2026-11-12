import { processDeal } from "@/lib/pipeline";
import { parseSheet } from "@/lib/sheet";
import { MissingKeyError, hasKey } from "@/lib/ai";
import { sampleById } from "@/lib/data";
import type { FormInput, SheetRow } from "@/lib/types";

// A deck takes one to a few minutes. Vercel stops the function after this many seconds.
export const maxDuration = 300;

const MAX_PDF_BYTES = 32 * 1024 * 1024; // Claude's PDF limit

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!hasKey()) return bad(new MissingKeyError().message, 503);

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return bad("Send the deck as a multipart form upload.");
  }

  const deck = fd.get("deck");
  if (!(deck instanceof File) || deck.size === 0) return bad("Attach the pitch deck as a PDF.");
  if (deck.size > MAX_PDF_BYTES) return bad("The deck is larger than 32 MB.");
  const bytes = Buffer.from(await deck.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== "%PDF-") return bad("The deck must be a PDF file.");

  let sheet: SheetRow[] | null = null;
  const sheetFile = fd.get("sheet");
  if (sheetFile instanceof File && sheetFile.size > 0) {
    try {
      sheet = parseSheet(await sheetFile.text());
    } catch (e) {
      return bad(`Monthly sheet: ${(e as Error).message}`);
    }
  }

  // Sample decks use their stored form answers; uploads send their own.
  const sampleId = String(fd.get("sampleId") ?? "");
  const sample = sampleId ? sampleById(sampleId) : undefined;
  let form: FormInput;
  if (sample) {
    form = sample.form;
  } else {
    try {
      form = JSON.parse(String(fd.get("form") ?? "")) as FormInput;
    } catch {
      return bad("The form answers are missing.");
    }
    if (!form.companyName?.trim()) return bad("Company name is required.");
  }

  const id = sample ? sample.id : `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const encoder = new TextEncoder();

  // Stream progress as one JSON object per line, then the finished deal.
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const deal = await processDeal({
          id,
          source: sample ? "sample" : "upload",
          receivedAt: sample ? sample.receivedAt : new Date().toISOString(),
          form,
          pdfBase64: bytes.toString("base64"),
          fileName: deck.name || "deck.pdf",
          deckUrl: sample ? `/samples/${sample.deckFile}` : null,
          sheet,
          onStep: (message) => send({ type: "step", message }),
        });
        send({ type: "result", deal });
      } catch (e) {
        console.error("process failed", e);
        send({ type: "error", error: (e as Error).message || "Processing failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
