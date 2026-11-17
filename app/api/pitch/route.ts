import { driver, mergeDeals, putFinancialFile, putPitchDeck } from "@/lib/db/repository";

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

function splitLocation(location: string): { city: string | null; country: string } {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] };
  }
  return { city: parts[0] || null, country: "India" };
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
    const oneLinePitch = String(formData.get("oneLinePitch") ?? "").trim().slice(0, 60);
    const stage = String(formData.get("stage") ?? "").trim() || "Seed";
    const location = String(formData.get("location") ?? "").trim();
    const priorRaw = String(formData.get("priorFunding") ?? "").replace(/[^0-9.]/g, "");
    const priorFunding = priorRaw ? Number(priorRaw) : null;
    const ref = String(formData.get("ref") ?? "").trim();
    const askRaw = String(formData.get("askAmount") ?? "").replace(/[^0-9.]/g, "");
    const askAmount = askRaw ? Number(askRaw) : NaN;
    const file = formData.get("deck");
    const fin = formData.get("financials");

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
    const hasFin = fin instanceof File && fin.size > 0;
    const finFileType = hasFin && /\.csv$/i.test(fin.name) ? "monthly_csv" : "financial_sheet";
    const financialFileUrl = hasFin ? `/api/files/${encodeURIComponent(id)}/${finFileType}` : null;
    const { city, country } = splitLocation(location);

    const files = [
      { name: file.name, size: file.size, at: receivedAt.slice(0, 10), key: `pitch:${id}`, url: fileUrl },
      ...(hasFin
        ? [{ name: fin.name, size: fin.size, at: receivedAt.slice(0, 10), key: `fin:${id}`, url: financialFileUrl! }]
        : []),
    ];

    const intake = {
      id,
      via: (ref ? "Referral" : "Website") as "Referral" | "Website",
      owner: ref || undefined,
      receivedAt,
      oneLiner: oneLinePitch || `${sector} · ${stage}${location ? ` · ${location}` : ""}`,
      form: {
        companyName,
        website,
        country,
        sector,
        stage,
        amountUsd: askAmount,
        founders: [{ name: founderName, profileUrl: linkedinUrl }],
        email: founderEmail,
      },
      files,
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
          stage,
          country,
          city,
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
          one_line_pitch: oneLinePitch || null,
          location: location || null,
          prior_funding: Number.isFinite(priorFunding) ? priorFunding : null,
          financial_file_url: financialFileUrl,
          received_at: receivedAt,
          is_historical: false,
          record_json: null,
          intake_json: intake,
          decision_json: null,
          research_pack_json: null,
        },
      ]);
      await putPitchDeck(id, file.name, file.type || "application/pdf", bytes);
      if (hasFin) {
        const finBytes = new Uint8Array(await fin.arrayBuffer());
        await putFinancialFile(id, finFileType, fin.name, fin.type || "text/csv", finBytes);
      }
    }

    return Response.json({ ok: true, id, receivedAt, persisted: drv === "none" ? "client" : drv, fileUrl, financialFileUrl });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Failed to submit pitch." }, { status: 500 });
  }
}
