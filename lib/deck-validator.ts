import zlib from "node:zlib";
import type { DealRecord } from "./schema";
import type { DeckValidationSummary, Flag } from "./types";

const PITCH_SECTIONS: { id: string; label: string; patterns: RegExp[] }[] = [
  {
    id: "problem_solution",
    label: "Problem & Solution",
    patterns: [/\bproblem\b/i, /\bpain point/i, /\bsolution\b/i, /\bwhy now\b/i, /\bvalue prop/i, /\bautomates?\b/i],
  },
  {
    id: "market",
    label: "Market / TAM",
    patterns: [/\btam\b/i, /\bsam\b/i, /\bsom\b/i, /\bmarket\b/i, /\baddressable\b/i, /\bbillion\b/i, /\bindustry\b/i, /\bsector\b/i],
  },
  {
    id: "product",
    label: "Product & Architecture",
    patterns: [/\bproduct\b/i, /\bplatform\b/i, /\bworkflow\b/i, /\bhow it works\b/i, /\broadmap\b/i, /\bdemo\b/i, /\bsoftware\b/i],
  },
  {
    id: "traction",
    label: "Traction & Financials",
    patterns: [
      /\barr\b/i,
      /\bmrr\b/i,
      /\brevenue\b/i,
      /\bgrowth\b/i,
      /\bcustomers?\b/i,
      /\bretention\b/i,
      /\bchurn\b/i,
      /\bburn\b/i,
      /\brunway\b/i,
      /\bunit economics\b/i,
      /\bgross margin\b/i,
      /\btraction\b/i,
    ],
  },
  {
    id: "business_model",
    label: "Business Model",
    patterns: [/\bbusiness model\b/i, /\bpricing\b/i, /\bsubscription\b/i, /\bsaas\b/i, /\btake rate\b/i, /\bmonetiz/i, /\bacv\b/i, /\barpu\b/i, /\bmargin\b/i],
  },
  {
    id: "team",
    label: "Team & Founders",
    patterns: [/\bteam\b/i, /\bfounder/i, /\bco-founder/i, /\bceo\b/i, /\bcto\b/i, /\bpreviously\b/i, /\bexperience\b/i],
  },
  {
    id: "ask",
    label: "Round Ask & Use of Funds",
    patterns: [/\braising\b/i, /\bseed\b/i, /\bpre-seed\b/i, /\bseries a\b/i, /\bvaluation\b/i, /\buse of funds\b/i, /\bsafe\b/i, /\bround\b/i, /\bask\b/i],
  },
];

const NON_DECK_FINGERPRINTS: { label: string; pattern: RegExp }[] = [
  { label: "Resume / CV markers", pattern: /\b(curriculum vitae|resume|cgpa|references available|career objective|academic qualifications)\b/i },
  { label: "Invoice / Billing markers", pattern: /\b(tax invoice|invoice\s*#|invoice number|bill to|subtotal|amount due|gstin|remit payment)\b/i },
  { label: "Legal contract markers", pattern: /\b(whereas|witnesseth|hereinafter|indemnify|governing law|in witness whereof)\b/i },
];

type CMap = Map<string, string>;

function decodeHexToUnicode(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  if (clean.length % 4 === 0 && clean.length >= 4) {
    let out = "";
    for (let i = 0; i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (Number.isFinite(code) && code > 0) out += String.fromCharCode(code);
    }
    return out;
  }
  if (clean.length >= 2) {
    let out = "";
    for (let i = 0; i < clean.length; i += 2) {
      const code = parseInt(clean.slice(i, i + 2), 16);
      if (Number.isFinite(code) && code > 0) out += String.fromCharCode(code);
    }
    return out;
  }
  return "";
}

function parseCMap(cmapText: string): CMap {
  const map: CMap = new Map();

  // beginbfchar ... endbfchar
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bfcharRe.exec(cmapText)) !== null) {
    const pairRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(m[1])) !== null) {
      map.set(pm[1].toUpperCase(), decodeHexToUnicode(pm[2]));
    }
  }

  // beginbfrange ... endbfrange
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(cmapText)) !== null) {
    const rangeRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]+)\])/g;
    let rm: RegExpExecArray | null;
    while ((rm = rangeRe.exec(m[1])) !== null) {
      const start = parseInt(rm[1], 16);
      const end = parseInt(rm[2], 16);
      const keyLen = rm[1].length;
      if (rm[3]) {
        const destStart = parseInt(rm[3], 16);
        for (let code = start; code <= end && code - start < 256; code++) {
          const hexKey = code.toString(16).toUpperCase().padStart(keyLen, "0");
          map.set(hexKey, String.fromCharCode(destStart + (code - start)));
        }
      } else if (rm[4]) {
        const dests = [...rm[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]);
        for (let i = 0; i < dests.length && start + i <= end; i++) {
          const hexKey = (start + i).toString(16).toUpperCase().padStart(keyLen, "0");
          map.set(hexKey, decodeHexToUnicode(dests[i]));
        }
      }
    }
  }

  return map;
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

function decodeLiteralWithCMap(raw: string, cmap: CMap | undefined): string {
  const unescaped = decodePdfLiteralString(raw);
  if (!cmap || cmap.size === 0) return unescaped;
  const sampleKey = cmap.keys().next().value as string | undefined;
  const step = sampleKey && sampleKey.length === 4 ? 2 : 1;
  let out = "";
  if (step === 2) {
    for (let i = 0; i + 1 < unescaped.length; i += 2) {
      const hex =
        unescaped.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0") +
        unescaped.charCodeAt(i + 1).toString(16).toUpperCase().padStart(2, "0");
      out += cmap.get(hex) ?? unescaped.slice(i, i + 2);
    }
  } else {
    for (let i = 0; i < unescaped.length; i++) {
      const hex = unescaped.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0");
      out += cmap.get(hex) ?? unescaped[i];
    }
  }
  return out;
}

function decodeHexStringWithCMap(hexRaw: string, cmap: CMap | undefined): string {
  const clean = hexRaw.replace(/\s+/g, "").toUpperCase();
  if (!clean) return "";
  if (cmap && cmap.size > 0) {
    // Determine typical key width (2 or 4 hex chars)
    const sampleKey = cmap.keys().next().value as string | undefined;
    const step = sampleKey && sampleKey.length === 4 ? 4 : 2;
    let out = "";
    for (let i = 0; i < clean.length; i += step) {
      const chunk = clean.slice(i, i + step);
      const mapped = cmap.get(chunk);
      if (mapped !== undefined) {
        out += mapped;
      } else if (step === 2) {
        const code = parseInt(chunk, 16);
        if (code >= 32 && code <= 126) out += String.fromCharCode(code);
      }
    }
    return out;
  }
  return decodeHexToUnicode(clean);
}

function inflateStream(buf: Buffer, dict: string): string {
  if (/\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict)) return "";
  if (/\/FlateDecode\b/.test(dict)) {
    try {
      return zlib.inflateSync(buf).toString("latin1");
    } catch {
      try {
        return zlib.inflateRawSync(buf).toString("latin1");
      } catch {
        return "";
      }
    }
  }
  return buf.toString("latin1");
}

function extractTextFromContentStream(content: string, fontCMaps: Map<string, CMap>): string {
  const parts: string[] = [];
  let activeFont = "";
  let activeFontSize = 12;

  // Tokenize relevant PDF text operators in order
  const tokenRe =
    /(\/[A-Za-z0-9_+-]+)\s+([0-9.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|\b(BT|ET|T\*)\b|<([0-9a-fA-F\s]+)>\s*Tj|\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")|\[([^\]]+)\]\s*TJ/g;

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(content)) !== null) {
    if (m[1]) {
      activeFont = m[1].slice(1);
      activeFontSize = Math.max(6, parseFloat(m[2]) || 12);
    } else if (m[3] !== undefined) {
      const dx = parseFloat(m[3]) || 0;
      const dy = parseFloat(m[4]) || 0;
      if (Math.abs(dy) > 1) parts.push("\n");
      else if (dx > activeFontSize * 0.92) parts.push(" ");
    } else if (m[5] !== undefined) {
      parts.push("\n");
    } else if (m[11]) {
      if (m[11] === "ET" || m[11] === "T*") parts.push("\n");
    } else if (m[12] !== undefined) {
      const decoded = decodeHexStringWithCMap(m[12], fontCMaps.get(activeFont));
      if (decoded) parts.push(decoded);
    } else if (m[13] !== undefined) {
      // TJ array
      const body = m[13];
      const itemRe = /<([0-9a-fA-F\s]+)>|\((?:\\.|[^\\()])*\)|(-?\d+(?:\.\d+)?)/g;
      let im: RegExpExecArray | null;
      while ((im = itemRe.exec(body)) !== null) {
        if (im[1] !== undefined) {
          parts.push(decodeHexStringWithCMap(im[1], fontCMaps.get(activeFont)));
        } else if (im[2] !== undefined) {
          const kern = parseFloat(im[2]);
          if (kern < -180) parts.push(" ");
        } else {
          parts.push(decodeLiteralWithCMap(im[0].slice(1, -1), fontCMaps.get(activeFont)));
        }
      }
    } else {
      // Literal string Tj
      const inner = m[0].slice(1, m[0].lastIndexOf(")"));
      parts.push(decodeLiteralWithCMap(inner, fontCMaps.get(activeFont)));
    }
  }

  return parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Zero-dependency PDF text & page extractor supporting both uncompressed streams,
 * FlateDecode streams, and subsetted CID ToUnicode CMap fonts (Google Slides, Figma, Chrome, PowerPoint).
 */
export function extractPdfText(pdfBytes: Uint8Array | Buffer): { pageCount: number; pages: string[]; fullText: string } {
  const buf = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const latin1 = buf.toString("latin1");

  // 1. Index PDF objects: objId -> { header, streamText }
  const objects = new Map<number, { dict: string; streamText: string }>();
  const objRe = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;

  while ((match = objRe.exec(latin1)) !== null) {
    const objId = parseInt(match[1], 10);
    const body = match[2];
    const streamIdx = body.indexOf("stream");
    if (streamIdx >= 0) {
      const dict = body.slice(0, streamIdx);
      const newlineOffset = body.indexOf("\n", streamIdx);
      const endStreamIdx = body.lastIndexOf("endstream");
      let streamText = "";
      if (newlineOffset >= 0 && endStreamIdx > newlineOffset) {
        const absStart = match.index + match[0].indexOf(body) + newlineOffset + 1;
        const absEnd = match.index + match[0].indexOf(body) + endStreamIdx;
        const trimmedEnd = buf[absEnd - 1] === 0x0a ? (buf[absEnd - 2] === 0x0d ? absEnd - 2 : absEnd - 1) : absEnd;
        if (trimmedEnd > absStart) {
          streamText = inflateStream(buf.subarray(absStart, trimmedEnd), dict);
        }
      }
      objects.set(objId, { dict, streamText });
    } else {
      objects.set(objId, { dict: body, streamText: "" });
    }
  }

  // 2. Parse all ToUnicode CMap objects
  const cmapsByObj = new Map<number, CMap>();
  for (const [id, obj] of objects) {
    if (obj.streamText && (obj.streamText.includes("beginbfchar") || obj.streamText.includes("beginbfrange"))) {
      cmapsByObj.set(id, parseCMap(obj.streamText));
    }
  }

  // 3. Map Font object ID -> CMap
  const fontObjToCMap = new Map<number, CMap>();
  for (const [id, obj] of objects) {
    const toUni = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(obj.dict);
    if (toUni) {
      const cmap = cmapsByObj.get(parseInt(toUni[1], 10));
      if (cmap) fontObjToCMap.set(id, cmap);
    }
  }

  // 4. Build fallback global font map + helper to resolve per-page /Resources -> /Font maps
  const globalFontCMaps = new Map<string, CMap>();
  const fontRefRe = /\/(F[A-Za-z0-9_+-]+)\s+(\d+)\s+0\s+R/g;
  while ((match = fontRefRe.exec(latin1)) !== null) {
    const cmap = fontObjToCMap.get(parseInt(match[2], 10));
    if (cmap && !globalFontCMaps.has(match[1])) globalFontCMaps.set(match[1], cmap);
  }

  function resolveFontsFromDict(dict: string, target: Map<string, CMap>): void {
    // Direct /F... refs inside dict
    for (const m of dict.matchAll(/\/(F[A-Za-z0-9_+-]+)\s+(\d+)\s+0\s+R/g)) {
      const cmap = fontObjToCMap.get(parseInt(m[2], 10));
      if (cmap) target.set(m[1], cmap);
    }
    // Indirect /Font X 0 R
    const fontDictRef = /\/Font\s+(\d+)\s+0\s+R/.exec(dict);
    if (fontDictRef) {
      const fontDict = objects.get(parseInt(fontDictRef[1], 10))?.dict;
      if (fontDict) {
        for (const m of fontDict.matchAll(/\/(F[A-Za-z0-9_+-]+)\s+(\d+)\s+0\s+R/g)) {
          const cmap = fontObjToCMap.get(parseInt(m[2], 10));
          if (cmap) target.set(m[1], cmap);
        }
      }
    }
    // Indirect /Resources X 0 R
    const resRef = /\/Resources\s+(\d+)\s+0\s+R/.exec(dict);
    if (resRef) {
      const resDict = objects.get(parseInt(resRef[1], 10))?.dict;
      if (resDict) resolveFontsFromDict(resDict, target);
    }
  }

  // 5. Walk /Type /Page objects in order to extract per-page text
  const pages: string[] = [];
  for (const [, obj] of objects) {
    if (/\/Type\s*\/Page\b(?!s)/.test(obj.dict)) {
      const pageFonts = new Map(globalFontCMaps);
      resolveFontsFromDict(obj.dict, pageFonts);

      // Resolve /Contents ref(s)
      const contentIds: number[] = [];
      const singleRef = /\/Contents\s+(\d+)\s+0\s+R/.exec(obj.dict);
      const arrRef = /\/Contents\s*\[([^\]]+)\]/.exec(obj.dict);
      if (singleRef) {
        contentIds.push(parseInt(singleRef[1], 10));
      } else if (arrRef) {
        for (const rm of arrRef[1].matchAll(/(\d+)\s+0\s+R/g)) {
          contentIds.push(parseInt(rm[1], 10));
        }
      }

      const pageChunks: string[] = [];
      for (const cid of contentIds) {
        const stream = objects.get(cid)?.streamText;
        if (stream && (stream.includes("Tj") || stream.includes("TJ"))) {
          const text = extractTextFromContentStream(stream, pageFonts);
          if (text) pageChunks.push(text);
        }
      }
      pages.push(pageChunks.join("\n").trim());
    }
  }

  // Fallback if simple PDF has streams without standard /Page -> /Contents linking
  if (pages.every((p) => !p)) {
    const fallbackPages: string[] = [];
    for (const [, obj] of objects) {
      if (obj.streamText && (obj.streamText.includes("Tj") || obj.streamText.includes("TJ"))) {
        const text = extractTextFromContentStream(obj.streamText, globalFontCMaps);
        if (text) fallbackPages.push(text);
      }
    }
    if (fallbackPages.length > 0) {
      return {
        pageCount: Math.max(pages.length || 1, fallbackPages.length),
        pages: fallbackPages,
        fullText: fallbackPages.join("\n\n"),
      };
    }
  }

  const pageCount = Math.max(1, pages.length);
  return { pageCount, pages, fullText: pages.filter(Boolean).join("\n\n") };
}

/**
 * Evaluates whether an uploaded PDF matches standard institutional pitch deck structure.
 */
export function validatePitchDeck(pdfBytes: Uint8Array | Buffer, fileName?: string): DeckValidationSummary {
  const { pageCount, fullText } = extractPdfText(pdfBytes);
  const words = fullText.split(/\s+/).filter((w) => w.length > 1);
  const wordCount = words.length;

  const detectedSections: string[] = [];
  const missingSections: string[] = [];

  for (const sec of PITCH_SECTIONS) {
    if (sec.patterns.some((re) => re.test(fullText))) {
      detectedSections.push(sec.label);
    } else {
      missingSections.push(sec.label);
    }
  }

  const nonDeckSignals: string[] = [];
  for (const fp of NON_DECK_FINGERPRINTS) {
    if (fp.pattern.test(fullText)) {
      nonDeckSignals.push(fp.label);
    }
  }

  const warnings: string[] = [];
  let documentType: DeckValidationSummary["documentType"] = "Pitch Deck";
  let isPitchDeck = true;

  if (nonDeckSignals.length >= 1 && detectedSections.length <= 2) {
    documentType = "Incomplete / Non-Deck Document";
    isPitchDeck = false;
    warnings.push(
      `Uploaded file (${fileName || "PDF"}) appears to be a non-pitch document (${nonDeckSignals.join(", ")}) and is missing ${missingSections.length} of ${PITCH_SECTIONS.length} standard pitch deck sections.`,
    );
  } else if (wordCount < 25) {
    documentType = "Scanned / Image-Only PDF";
    isPitchDeck = pageCount >= 4;
    warnings.push(
      `PDF contains minimal machine-readable text (${wordCount} words across ${pageCount} page${pageCount === 1 ? "" : "s"}). Export slides with embedded text or upload a monthly financial CSV for automated checks.`,
    );
  } else if (pageCount <= 2 && detectedSections.length >= 3) {
    documentType = "Teaser / One-Pager";
    isPitchDeck = true;
    warnings.push("Short 1-2 page teaser detected. Request the full institutional pitch deck and monthly financial sheet before IC review.");
  } else if (detectedSections.length < 3 || (pageCount < 3 && detectedSections.length < 4)) {
    documentType = "Incomplete / Non-Deck Document";
    isPitchDeck = false;
    warnings.push(
      `Document lacks core VC pitch deck structure (only ${detectedSections.length} of ${PITCH_SECTIONS.length} standard sections found; missing: ${missingSections.join(", ")}).`,
    );
  } else if (missingSections.includes("Traction & Financials")) {
    warnings.push("Deck does not include recognizable Traction or Financial metrics slides.");
  }

  const sectionScore = Math.round((detectedSections.length / PITCH_SECTIONS.length) * 80);
  const lengthBonus = pageCount >= 5 && pageCount <= 30 ? 20 : pageCount >= 3 ? 10 : 0;
  const nonDeckPenalty = nonDeckSignals.length * 35;
  const confidence = Math.max(0, Math.min(100, sectionScore + lengthBonus - nonDeckPenalty));

  return {
    isPitchDeck,
    documentType,
    pageCount,
    wordCount,
    confidence,
    detectedSections,
    missingSections,
    warnings,
    nonDeckSignals,
  };
}

export function buildDeckValidationFlag(v: DeckValidationSummary, fileName: string): Flag | null {
  if (v.isPitchDeck && v.warnings.length === 0) return null;
  if (!v.isPitchDeck) {
    return {
      checkId: "non_pitch_deck",
      kind: "warning",
      title: `Non-standard or incomplete pitch deck (${v.documentType})`,
      detail: `${v.warnings[0] || "Uploaded PDF does not contain standard VC pitch deck sections."} Detected sections (${v.detectedSections.length}/7): ${v.detectedSections.join(", ") || "None"}. Missing: ${v.missingSections.join(", ")}.`,
      sources: [
        {
          label: "Deck",
          value: `${fileName} (${v.pageCount} page${v.pageCount === 1 ? "" : "s"}, ${v.wordCount} readable words)`,
          page: 1,
        },
      ],
    };
  }
  return null;
}

function parseMoneyValue(numStr: string, unitRaw: string | undefined, currencySym: string): { amount: number; currency: string } | null {
  const n = Number(numStr.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (unitRaw || "").toLowerCase().trim();
  const isInr = currencySym.includes("₹") || /inr|rs|cr|crore|lakh|\bl\b/i.test(`${currencySym} ${unit}`);
  let mult = 1;
  if (/^cr|crore/.test(unit)) mult = 10_000_000;
  else if (/^l$|^lakh|^lac/.test(unit)) mult = 100_000;
  else if (/^m$|^mn|^million/.test(unit)) mult = 1_000_000;
  else if (/^k$|^thousand/.test(unit)) mult = 1_000;
  else if (/^b$|^bn|^billion/.test(unit)) mult = 1_000_000_000;
  return { amount: Math.round(n * mult), currency: isInr ? "INR" : "USD" };
}

export interface LocalPdfExtractedFacts {
  mrr: { amount: number; currency: string; page: number; quote: string } | null;
  arr: { amount: number; currency: string; page: number; quote: string } | null;
  growthPct: { value: number; page: number; quote: string } | null;
  customers: { value: number; page: number; quote: string } | null;
  teamSize: { value: number; page: number; quote: string } | null;
  burn: { amount: number; currency: string; page: number; quote: string } | null;
  cash: { amount: number; currency: string; page: number; quote: string } | null;
  runwayMonths: { value: number; page: number; quote: string } | null;
  foundedYear: { value: number; page: number; quote: string } | null;
  valuation: { amount: number; currency: string; page: number; quote: string } | null;
  grossMarginPct: { value: number; page: number; quote: string } | null;
}

function snippetAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 32);
  const end = Math.min(text.length, idx + len + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Deterministic fallback metric extractor from raw PDF slide text.
 * Used when ANTHROPIC_API_KEY is not configured or an AI call fails, so uploaded pitch decks
 * still populate grounded slide metrics with page citations instead of blank records.
 */
export function extractFactsFromPdfBytes(pdfBytes: Uint8Array | Buffer): LocalPdfExtractedFacts {
  const { pages } = extractPdfText(pdfBytes);
  const out: LocalPdfExtractedFacts = {
    mrr: null,
    arr: null,
    growthPct: null,
    customers: null,
    teamSize: null,
    burn: null,
    cash: null,
    runwayMonths: null,
    foundedYear: null,
    valuation: null,
    grossMarginPct: null,
  };

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const text = pages[i].replace(/\n/g, " ");

    // MRR
    if (!out.mrr) {
      const m =
        /(?:mrr|monthly\s+(?:recurring\s+)?revenue)[^0-9$₹]{0,24}(\$|₹|USD|INR|Rs\.?)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|million|k\b)?/i.exec(text) ||
        /(\$|₹|USD|INR)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|million|k\b)?\s*(?:in\s+)?(?:mrr|monthly\s+revenue)/i.exec(text);
      if (m) {
        const parsed = parseMoneyValue(m[2], m[3], m[1]);
        if (parsed) out.mrr = { ...parsed, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
      }
    }

    // ARR
    if (!out.arr) {
      const m =
        /(?:arr|annual(?:ised|ized)?\s+(?:recurring\s+)?revenue)[^0-9$₹]{0,24}(\$|₹|USD|INR|Rs\.?)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|million|k\b)?/i.exec(text) ||
        /(\$|₹|USD|INR)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|million|k\b)?\s*(?:in\s+)?arr\b/i.exec(text);
      if (m) {
        const parsed = parseMoneyValue(m[2], m[3], m[1]);
        if (parsed) out.arr = { ...parsed, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
      }
    }

    // MoM Growth %
    if (!out.growthPct) {
      const m =
        /([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:mom|month-on-month|monthly\s+growth|cmgr)/i.exec(text) ||
        /(?:monthly\s+growth|mom\s+growth|growing)[^0-9]{0,24}([0-9]+(?:\.[0-9]+)?)\s*%/i.exec(text);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val) && val > 0 && val <= 200) {
          out.growthPct = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }

    // Paying customers
    if (!out.customers) {
      const m = /\b([0-9][0-9,]{0,5})\+?\s*(?:paying\s+customers|active\s+customers|enterprise\s+customers|paying\s+clients|b2b\s+customers|customers)/i.exec(text);
      if (m) {
        const val = Number(m[1].replace(/,/g, ""));
        if (Number.isFinite(val) && val > 0) {
          out.customers = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }

    // Team size
    if (!out.teamSize) {
      const m =
        /\b([0-9]{1,4})\+?\s*(?:full-time\s+)?(?:employees|team\s+members|people|fte)\b/i.exec(text) ||
        /\bteam\s+(?:of|size)\s*[:\-]?\s*([0-9]{1,4})\b/i.exec(text);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val) && val > 0 && val < 5000) {
          out.teamSize = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }

    // Burn
    if (!out.burn) {
      const m =
        /(?:net\s+burn|monthly\s+burn|burn\s+rate)[^0-9$₹]{0,24}(\$|₹|USD|INR|Rs\.?)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|k\b)?/i.exec(text) ||
        /(\$|₹|USD|INR)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|k\b)?\s*(?:\/\s*mo\s+)?(?:net\s+|monthly\s+)?burn/i.exec(text);
      if (m) {
        const parsed = parseMoneyValue(m[2], m[3], m[1]);
        if (parsed) out.burn = { ...parsed, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
      }
    }

    // Cash
    if (!out.cash) {
      const m =
        /(\$|₹|USD|INR|Rs\.?)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|k\b)?\s*cash\s+(?:in\s+bank|on\s+hand|balance)/i.exec(text) ||
        /(?:cash\s+(?:in\s+bank|on\s+hand|balance))[^0-9$₹]{0,16}(\$|₹|USD|INR|Rs\.?)\s*([0-9][0-9.,]*)\s*(cr|crore|lakhs?|lac|l\b|m\b|mn|k\b)?/i.exec(text);
      if (m) {
        const parsed = parseMoneyValue(m[2], m[3], m[1]);
        if (parsed) out.cash = { ...parsed, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
      }
    }

    // Runway
    if (!out.runwayMonths) {
      const m =
        /([0-9]+(?:\.[0-9]+)?)\s*(?:months?|mos?)\s*(?:of\s+)?runway/i.exec(text) ||
        /runway[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*(?:months?|mos?)/i.exec(text);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val) && val > 0 && val <= 120) {
          out.runwayMonths = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }

    // Founded year
    if (!out.foundedYear) {
      const m = /(?:founded|incorporated|established|started)\s*(?:in\s+)?(20[12][0-9]|199[0-9])\b/i.exec(text);
      if (m) {
        const val = Number(m[1]);
        if (val >= 1995 && val <= 2027) {
          out.foundedYear = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }

    // Valuation / Cap
    if (!out.valuation) {
      const m = /(?:valuation\s+cap|post-money\s+cap|pre-money\s+valuation|valuation)[^0-9$₹]{0,24}(\$|₹|USD|INR)\s*([0-9][0-9.,]*)\s*(cr|crore|m\b|mn|million|k\b)/i.exec(text);
      if (m) {
        const parsed = parseMoneyValue(m[2], m[3], m[1]);
        if (parsed) out.valuation = { ...parsed, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
      }
    }

    // Gross margin
    if (!out.grossMarginPct) {
      const m =
        /(?:gross\s+margin)[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*%/i.exec(text) ||
        /([0-9]+(?:\.[0-9]+)?)\s*%\s*gross\s+margin/i.exec(text);
      if (m) {
        const val = Number(m[1]);
        if (Number.isFinite(val) && val > 0 && val <= 100) {
          out.grossMarginPct = { value: val, page: pageNum, quote: snippetAround(text, m.index, m[0].length) };
        }
      }
    }
  }

  return out;
}

/** Merges locally extracted PDF facts into an empty/partial DealRecord without overwriting existing values. */
export function applyLocalPdfFactsToRecord(record: DealRecord, facts: LocalPdfExtractedFacts): DealRecord {
  const next: DealRecord = structuredClone(record);
  if (next.traction.mrr.amount == null && facts.mrr) {
    next.traction.mrr = { amount: facts.mrr.amount, currency: facts.mrr.currency, asOf: null, page: facts.mrr.page, quote: facts.mrr.quote };
  }
  if (next.traction.arr.amount == null && facts.arr) {
    next.traction.arr = { amount: facts.arr.amount, currency: facts.arr.currency, asOf: null, page: facts.arr.page, quote: facts.arr.quote };
  }
  if (next.traction.monthlyGrowthPct.value == null && facts.growthPct) {
    next.traction.monthlyGrowthPct = { value: facts.growthPct.value, asOf: null, page: facts.growthPct.page, quote: facts.growthPct.quote };
  }
  if (next.traction.customers.value == null && facts.customers) {
    next.traction.customers = { value: facts.customers.value, asOf: null, page: facts.customers.page, quote: facts.customers.quote };
  }
  if (next.traction.teamSize.value == null && facts.teamSize) {
    next.traction.teamSize = { value: facts.teamSize.value, asOf: null, page: facts.teamSize.page, quote: facts.teamSize.quote };
  }
  if (next.traction.monthlyBurn.amount == null && facts.burn) {
    next.traction.monthlyBurn = { amount: facts.burn.amount, currency: facts.burn.currency, asOf: null, page: facts.burn.page, quote: facts.burn.quote };
  }
  if (next.traction.cash.amount == null && facts.cash) {
    next.traction.cash = { amount: facts.cash.amount, currency: facts.cash.currency, asOf: null, page: facts.cash.page, quote: facts.cash.quote };
  }
  if (next.traction.runwayMonths.value == null && facts.runwayMonths) {
    next.traction.runwayMonths = { value: facts.runwayMonths.value, asOf: null, page: facts.runwayMonths.page, quote: facts.runwayMonths.quote };
  }
  if (next.traction.grossMarginPct.value == null && facts.grossMarginPct) {
    next.traction.grossMarginPct = { value: facts.grossMarginPct.value, asOf: null, page: facts.grossMarginPct.page, quote: facts.grossMarginPct.quote };
  }
  if (next.company.foundedYear.value == null && facts.foundedYear) {
    next.company.foundedYear = { value: facts.foundedYear.value, asOf: null, page: facts.foundedYear.page, quote: facts.foundedYear.quote };
  }
  if (next.round.valuation.amount == null && facts.valuation) {
    next.round.valuation = { amount: facts.valuation.amount, currency: facts.valuation.currency, asOf: null, page: facts.valuation.page, quote: facts.valuation.quote };
  }
  return next;
}
