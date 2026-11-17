export interface UploadedFileMeta {
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  previewCsv?: string;
}

export interface DirectUploadResult {
  direct: boolean;
  meta?: UploadedFileMeta;
  fallbackFile?: File;
}

/**
 * Uploads a file directly to Supabase Storage using a server-generated presigned URL.
 * Bypasses Vercel's 4.5 MB request body limit, allowing 50MB+ decks.
 */
export async function uploadFileDirect(
  file: File,
  fileType: "deck_pdf" | "monthly_csv" | "financial_sheet",
  dealSlug: string
): Promise<DirectUploadResult> {
  try {
    const urlRes = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType,
        dealSlug,
      }),
    });

    const urlData = (await urlRes.json().catch(() => null)) as {
      ok?: boolean;
      direct?: boolean;
      signedUrl?: string;
      storagePath?: string;
    } | null;

    if (!urlRes.ok || !urlData?.ok || !urlData.direct || !urlData.signedUrl || !urlData.storagePath) {
      // Direct upload unavailable (e.g. offline fallback); use standard FormData
      return { direct: false, fallbackFile: file };
    }

    // Direct PUT to Supabase Storage signed URL from the browser
    const uploadRes = await fetch(urlData.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || (fileType === "deck_pdf" ? "application/pdf" : "application/octet-stream"),
      },
      body: file,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      throw new Error(`Direct upload failed (${uploadRes.status}): ${errText.slice(0, 100)}`);
    }

    let previewCsv: string | undefined;
    if (fileType === "monthly_csv" || /\.csv$/i.test(file.name)) {
      try {
        previewCsv = (await file.slice(0, 64 * 1024).text()) || undefined;
      } catch {
        // non-blocking
      }
    }

    return {
      direct: true,
      meta: {
        storagePath: urlData.storagePath,
        fileName: file.name,
        mimeType: file.type || (fileType === "deck_pdf" ? "application/pdf" : "text/csv"),
        size: file.size,
        previewCsv,
      },
    };
  } catch (err) {
    console.warn("[direct-upload] falling back to FormData upload:", err);
    return { direct: false, fallbackFile: file };
  }
}
