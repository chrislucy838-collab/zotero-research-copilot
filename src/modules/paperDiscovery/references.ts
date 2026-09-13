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
  arxivId?: string;
  title?: string;
};

const REFERENCE_HEADING =
  /^(?:references?|bibliography|works cited|literature cited|references and notes)\s*:?$/i;
const ENTRY_PREFIX = /^\s*(?:\[(\d{1,4})\]|(\d{1,4})[.)])(?=\s|[^\d])\s*/;
const DOI_PATTERN = /\b10\.\d{4,9}\/[\w.!#$%&'*+/=?^_`{|}~-]+/i;
const ARXIV_PATTERN =
  /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv\s*:\s*|abs\/)(\d{4}\.\d{4,5})(?:v\d+)?/i;

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

function normalizeArxivId(value: unknown): string | undefined {
  const match = String(value ?? "").match(ARXIV_PATTERN);
  return match?.[1];
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

  // A preprint or repository marker usually follows the title directly.
  // Taking the last sentence before that marker removes the author list.
  const repositoryMarker = value.search(
    /\b(?:arxiv(?:\s+preprint)?|coRR|corr)\b/i,
  );
  const beforeRepository =
    repositoryMarker >= 0 ? value.slice(0, repositoryMarker).trim() : "";
  const repositoryTitle = beforeRepository
    ? beforeRepository.split(/\.\s+/).filter(Boolean).pop()
    : undefined;

  // Many extracted references put the venue after a title sentence. Looking
  // for that boundary avoids sending author lists and page ranges as a query.
  const venueBoundary = value.match(
    /(?:^|\.\s+)(.{8,240}?)\.\s+(?=(?:in|ieee|acm|nature|science|journal|proceedings|advances|transactions|letters|review|conference|neural computation|nips|iclr|cvpr|acl|emnlp|wmt|icml)\b)/i,
  )?.[1];

  // For author-year citations, the first sentence after the publication year
  // is usually the title. This removes author lists and venue/page tails from
  // the query sent to academic indexes.
  const afterYear = value.match(/\b(?:19|20)\d{2}\b[).,:;\s-]*(.+)/)?.[1];
  const firstSentence = afterYear?.match(/^(.{8,240}?)(?:\.\s+|$)/)?.[1];
  const title = (
    quoted?.[1] ||
    repositoryTitle ||
    firstSentence ||
    venueBoundary ||
    afterYear ||
    value
  )
    .replace(/^[\s.,;:()-]+|[\s.,;:()-]+$/g, "")
    .trim();
  if (!title) return undefined;
  return title.length > 240 ? `${title.slice(0, 237)}…` : title;
}

function buildReferenceQueries(
  text: string,
  title: string | undefined,
  doi: string | undefined,
  arxivId?: string,
): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  const shortPhrase = compact
    .replace(ENTRY_PREFIX, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/[()\[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\.\s+/)[0]
    .trim();
  const queries = [
    arxivId ? `arXiv:${arxivId}` : undefined,
    doi,
    title,
    shortPhrase,
    compact,
  ]
    .map((value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((value) => value.length >= 3);
  return Array.from(new Set(queries)).slice(0, 4);
}

function locateReferencesStart(lines: string[]): number {
  const minimumStart = Math.floor(lines.length * 0.35);
  for (let index = lines.length - 1; index >= minimumStart; index -= 1) {
    if (REFERENCE_HEADING.test(cleanLine(lines[index]))) return index + 1;
  }
  return -1;
}

function expandInlineReferenceMarkers(lines: string[]): string[] {
  const joined = lines.join("\n");
  const markerPattern =
    /(?:^|\s)(?:\[\s*(\d{1,4})\s*\]|(\d{1,3})[.)])(?=\s|$)/g;
  const markers: Array<{ start: number; number: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(joined))) {
    const number = Number(match[1] || match[2]);
    if (!Number.isInteger(number) || number <= 0) continue;
    const previous = markers[markers.length - 1]?.number;
    // A bibliography normally increases monotonically. This filters out
    // page numbers and years that happen to look like numbered markers.
    if (
      previous !== undefined &&
      (number <= previous || number - previous > 100)
    ) {
      continue;
    }
    markers.push({
      start: match.index + match[0].search(/\S/),
      number,
    });
  }
  if (markers.length < 2) return lines;
  const chunks: string[] = [];
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index].start;
    const end = markers[index + 1]?.start ?? joined.length;
    const chunk = joined.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function referenceNumber(text: string, fallback: number): number {
  const match = text.match(ENTRY_PREFIX);
  const parsed = Number(match?.[1] || match?.[2]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

  const body = expandInlineReferenceMarkers(lines.slice(start));
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
      const arxivId = normalizeArxivId(text);
      const title = referenceTitle(text, doi);
      const queries = buildReferenceQueries(text, title, doi, arxivId);
      return {
        index: referenceNumber(text, position + 1),
        text,
        query: queries[0] || text,
        queries,
        doi,
        arxivId,
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
  normalizeArxivId,
  referenceTitle,
  buildReferenceQueries,
  locateReferencesStart,
};
