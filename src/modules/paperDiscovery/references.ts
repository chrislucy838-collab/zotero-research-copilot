import {
  extractEpubTextFromAttachment,
  resolveReaderDocument,
} from "../contextPanel/documentContext";

export type ExtractedReference = {
  index: number;
  text: string;
  query: string;
  queries?: string[];
  doi?: string;
  title?: string;
};

const REFERENCE_HEADING =
  /^(?:references?|bibliography|works cited|literature cited|references and notes)\s*:?$/i;
const ENTRY_PREFIX = /^\s*(?:\[(\d{1,4})\]|(\d{1,4})[.)])\s+/;
const DOI_PATTERN = /\b10\.\d{4,9}\/[\w.!#$%&'*+/=?^_`{|}~-]+/i;

function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000\u000b\u000c\u000d]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeDoi(value: unknown): string | undefined {
  const match = String(value ?? "").match(DOI_PATTERN);
  if (!match) return undefined;
  return match[0].replace(/[.,;:)}\]]+$/, "").toLowerCase();
}

function normalizeReferenceText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\f/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function referenceTitle(text: string, doi?: string): string | undefined {
  let value = text.replace(ENTRY_PREFIX, "").trim();
  if (doi)
    value = value.replace(
      new RegExp(doi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      "",
    );
  value = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();

  // Quoted titles are common in IEEE, ACM, and humanities bibliographies.
  const quoted = value.match(/["“](.{8,240}?)["”]/);
  if (quoted?.[1]) return quoted[1].trim();

  // For author-year citations, the first sentence after the publication year
  // is usually the title. This removes author lists and venue/page tails from
  // the query sent to academic indexes.
  const afterYear = value.match(/\b(?:19|20)\d{2}\b[).,:;\s-]*(.+)/)?.[1];
  if (!afterYear) return value.length > 240 ? `${value.slice(0, 237)}…` : value;
  const firstSentence = afterYear.match(/^(.{8,240}?)(?:\.\s+|$)/)?.[1];
  const title = (firstSentence || afterYear)
    .replace(/^[\s.,;:()-]+|[\s.,;:()-]+$/g, "")
    .trim();
  if (!title) return undefined;
  return title.length > 240 ? `${title.slice(0, 237)}…` : title;
}

function buildReferenceQueries(
  text: string,
  title: string | undefined,
  doi: string | undefined,
): string[] {
  const queries = [doi, title, text]
    .map((value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((value) => value.length >= 3);
  return Array.from(new Set(queries)).slice(0, 3);
}

function locateReferencesStart(lines: string[]): number {
  const minimumStart = Math.floor(lines.length * 0.35);
  for (let index = lines.length - 1; index >= minimumStart; index -= 1) {
    if (REFERENCE_HEADING.test(cleanLine(lines[index]))) return index + 1;
  }
  return -1;
}

/**
 * Extract bibliography entries from Zotero PDFWorker text.
 *
 * Numbered references are split at [n], n., or n) prefixes. When a PDF has
 * lost those prefixes, blank-line-separated entries are retained as a safe
 * fallback instead of inventing boundaries between citations.
 */
export function extractReferences(documentText: string): ExtractedReference[] {
  const normalized = normalizeReferenceText(documentText);
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const start = locateReferencesStart(lines);
  if (start < 0) return [];

  const body = lines.slice(start);
  const numbered: string[] = [];
  let current = "";
  for (const rawLine of body) {
    const line = cleanLine(rawLine);
    if (!line) {
      if (current) current += " ";
      continue;
    }
    if (ENTRY_PREFIX.test(line)) {
      if (current.trim()) numbered.push(current.trim());
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }
  }
  if (current.trim()) numbered.push(current.trim());

  let entries = numbered;
  if (!entries.length) {
    entries = body
      .join("\n")
      .split(/\n\s*\n+/)
      .map((entry) => entry.replace(/\s+/g, " ").trim())
      .filter((entry) => entry.length >= 20);
  }

  const seen = new Set<string>();
  return entries
    .map((entry, position) => {
      const text = cleanLine(entry);
      const doi = normalizeDoi(text);
      const title = referenceTitle(text, doi);
      const queries = buildReferenceQueries(text, title, doi);
      return {
        index: position + 1,
        text,
        query: queries[0] || text,
        queries,
        doi,
        title,
      } satisfies ExtractedReference;
    })
    .filter((entry) => {
      const key = entry.doi || entry.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function extractReferencesFromItem(
  item: Zotero.Item | null | undefined,
): Promise<ExtractedReference[]> {
  const document = resolveReaderDocument(item);
  if (!document) {
    throw new Error("No supported PDF or EPUB attachment found for this paper");
  }

  let text = "";
  if (document.kind === "epub") {
    text = await extractEpubTextFromAttachment(document.item);
  } else {
    const result = await Zotero.PDFWorker.getFullText(document.item.id);
    text = String(result?.text || "");
  }
  const references = extractReferences(text);
  if (!references.length) {
    throw new Error(
      "No numbered reference section was detected in the extracted document text",
    );
  }
  return references;
}

export const __referenceExtractorTest = {
  cleanLine,
  normalizeDoi,
  referenceTitle,
  buildReferenceQueries,
  locateReferencesStart,
};
