import { driver, mergeDeals, putPitchDeck } from "@/lib/db/repository";

const MAX_MANDATE_USD = 4_000_000;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "pitch"
  );
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const founderName = String(formData.get("founderName") ?? "").trim();
    const founderEmail = String(formData.get("founderEmail") ?? "").trim();
    const linkedinUrl = String(formData.get("linkedinUrl") ?? "").trim();
    const companyName = String(formData.get("companyName") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const sector = String(formData.get("sector") ?? "").trim();
    const ref = String(formData.get("ref") ?? "").trim();
    const askRaw = String(formData.get("askAmount") ?? "").replace(/[^0-9.]/g, "");
    const askAmount = askRaw ? Number(askRaw) : NaN;
    const file = formData.get("deck");

    if (!founderName || !founderEmail || !companyName || !sector) {
      return Response.json({ error: "Please complete all required founder and company fields." }, { status: 400 });
    }
    if (!Number.isFinite(askAmount) || askAmount <= 0) {
      return Response.json({ error: "Please enter a valid funding ask amount in USD." }, { status: 400 });
    }
    if (askAmount > MAX_MANDATE_USD) {
      return Response.json({ error: "Our current fund mandate is strictly capped at $4M." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Please attach your pitch deck PDF." }, { status: 400 });
    }

    const id = `${slugify(companyName)}-${Date.now().toString(36)}`;
    const receivedAt = new Date().toISOString();
    const drv = driver();
    const fileUrl = `/api/files/${encodeURIComponent(id)}/deck_pdf`;

    const intake = {
      id,
      via: (ref ? "Referral" : "Website") as "Referral" | "Website",
      owner: ref || undefined,
      receivedAt,
      oneLiner: `${sector} · Public intake${website ? ` · ${website}` : ""}`,
      form: {
        companyName,
        website,
        country: "India",
        sector,
        stage: "Seed",
        amountUsd: askAmount,
        founders: [{ name: founderName, profileUrl: linkedinUrl }],
        email: founderEmail,
      },
      files: [{ name: file.name, size: file.size, at: receivedAt.slice(0, 10), key: `pitch:${id}`, url: fileUrl }],
    };

    if (drv !== "none") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await mergeDeals([
        {
          id,
          slug: id,
          company_name: companyName,
          sector,
          sub_category: sector,
          stage: "Seed",
          country: "India",
          city: null,
          ask_amount: askAmount,
          currency: "USD",
          status: "New",
          checks_status: "Unscreened",
          band: null,
          founder_fit: null,
          owner: ref || null,
          website,
          linkedin_url: linkedinUrl,
          founder_name: founderName,
          founder_email: founderEmail,
          received_at: receivedAt,
          is_historical: false,
          record_json: null,
          intake_json: intake,
          decision_json: null,
          research_pack_json: null,
        },
      ]);
      await putPitchDeck(id, file.name, file.type || "application/pdf", bytes);
    }

    return Response.json({ ok: true, id, receivedAt, persisted: drv === "none" ? "client" : drv, fileUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Failed to submit pitch." }, { status: 500 });
  }
}
