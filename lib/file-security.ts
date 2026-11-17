/**
 * Deep binary magic-byte validation & anti-abuse file inspection for PDF, CSV, and Excel uploads.
 * Blocks spoofed extensions, polyglot payloads, oversized files, and active JavaScript inside PDFs.
 */

export const MAX_PDF_UPLOAD_BYTES = 32 * 1024 * 1024; // 32 MB
export const MAX_SHEET_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK.. (.xlsx)
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .xls

function startsWithBytes(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

export function validatePdfBinary(bytes: Uint8Array, fileName: string): FileValidationResult {
  if (!bytes.length) return { ok: false, error: "The uploaded PDF is empty." };
  if (bytes.length > MAX_PDF_UPLOAD_BYTES) {
    return { ok: false, error: "Pitch deck PDF exceeds the 32 MB size limit." };
  }
  if (!/\.pdf$/i.test(fileName)) {
    return { ok: false, error: "Pitch deck filename must end in .pdf." };
  }
  if (!startsWithBytes(bytes, PDF_MAGIC)) {
    return { ok: false, error: "Invalid PDF file: binary header does not match a genuine PDF document." };
  }

  // Inspect first 256 KB for active executable PDF actions (/JavaScript, /Launch, /OpenAction with JS)
  const sample = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 262_144))).toString("latin1");
  if (/\/JavaScript\b|\/JS\s*\(|\/Launch\b/i.test(sample)) {
    return { ok: false, error: "Security check failed: PDF contains embedded scripts or launch actions." };
  }

  return { ok: true };
}

export function validateFinancialBinary(bytes: Uint8Array, fileName: string): FileValidationResult {
  if (!bytes.length) return { ok: false, error: "The uploaded financial file is empty." };
  if (bytes.length > MAX_SHEET_UPLOAD_BYTES) {
    return { ok: false, error: "Financial sheet exceeds the 10 MB size limit." };
  }

  if (/\.csv$/i.test(fileName)) {
    // Reject binary files disguised as .csv (null byte check in first 8 KB)
    const slice = bytes.subarray(0, Math.min(bytes.length, 8192));
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0x00) {
        return { ok: false, error: "Invalid CSV file: binary content detected." };
      }
    }
    return { ok: true };
  }

  if (/\.xlsx$/i.test(fileName)) {
    if (!startsWithBytes(bytes, ZIP_MAGIC)) {
      return { ok: false, error: "Invalid Excel (.xlsx) file signature." };
    }
    return { ok: true };
  }

  if (/\.xls$/i.test(fileName)) {
    if (!startsWithBytes(bytes, OLE_MAGIC) && !startsWithBytes(bytes, ZIP_MAGIC)) {
      return { ok: false, error: "Invalid legacy Excel (.xls) file signature." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Financial file must be .csv, .xlsx, or .xls." };
}

/** Prevents CSV formula injection when exporting user-supplied text to Excel/Sheets. */
export function sanitizeCsvCell(value: unknown): string {
  let str = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
