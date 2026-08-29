import type { PaperAuthor, PaperCandidate, PaperSource } from "./types";

type JsonObject = Record<string, any>;

function getFetch(): typeof fetch {
  return ztoolkit.getGlobal("fetch") as typeof fetch;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<any> {
  const response = await getFetch()(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function text(value: unknown): string | undefined {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || undefined;
}

function safePdfUrl(value: unknown): string | undefined {
  const result = text(value);
  return result && /^https:\/\//i.test(result) ? result : undefined;
}

function year(value: unknown): number | undefined {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function doi(value: unknown): string | undefined {
  const result = String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[.,;)}\]]+$/, "");
  return /^10\.\d{4,9}\//i.test(result) ? result : undefined;
}

function authors(values: unknown): PaperAuthor[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value: any) => {
      const given = text(value?.author?.given ?? value?.given ?? value?.firstName);
      const family = text(value?.author?.family ?? value?.family ?? value?.lastName);
      const display = text(value?.author?.display_name ?? value?.name ?? value?.authorName) ||
        [given, family].filter(Boolean).join(" ");
      if (!display) return null;
      const parts = display.split(/\s+/);
      return {
        name: display,
        lastName: family || parts.pop() || display,
        firstName: given || parts.join(" ") || undefined,
        orcid: text(value?.author?.orcid ?? value?.ORCID ?? value?.orcid),
      } satisfies PaperAuthor;
    })
    .filter(Boolean) as PaperAuthor[];
}

function reconstructAbstract(invertedIndex: unknown): string | undefined {
  if (!invertedIndex || typeof invertedIndex !== "object") return undefined;
  const words: Array<{ index: number; word: string }> = [];
  for (const [word, positions] of Object.entries(invertedIndex as JsonObject)) {
    if (Array.isArray(positions)) {
      for (const index of positions) {
        if (Number.isInteger(index)) words.push({ index, word });
      }
    }
  }
  words.sort((a, b) => a.index - b.index);
  return text(words.map((entry) => entry.word).join(" "));
}

export async function searchOpenAlex(query: string, limit: number, signal?: AbortSignal): Promise<PaperCandidate[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
  const payload = await fetchJson(url, signal);
  return (Array.isArray(payload?.results) ? payload.results : []).map((row: JsonObject) => {
    const primaryLocation = row.primary_location || {};
    const source = primaryLocation.source || {};
    const bestUrl = text(primaryLocation.landing_page_url ?? row.doi);
    return {
      source: "openalex",
      sourceId: text(row.id) || text(row.doi) || "openalex-unknown",
      title: text(row.title) || "Untitled paper",
      abstract: reconstructAbstract(row.abstract_inverted_index),
      authors: authors(row.authorships),
      year: Number(row.publication_year) || year(row.publication_date),
      venue: text(source.display_name),
      doi: doi(row.doi),
      url: bestUrl,
      pdfUrl: safePdfUrl(primaryLocation.pdf_url ?? row.open_access?.oa_url),
      pdfSource: safePdfUrl(primaryLocation.pdf_url ?? row.open_access?.oa_url) ? "openalex" : undefined,
      citationCount: Number(row.cited_by_count) || undefined,
      openAccess: row.open_access?.is_oa === true,
      pdfStatus: safePdfUrl(primaryLocation.pdf_url ?? row.open_access?.oa_url)
        ? "available"
        : "unknown",
      raw: row,
    } satisfies PaperCandidate;
  });
}

export async function searchSemanticScholar(query: string, limit: number, signal?: AbortSignal): Promise<PaperCandidate[]> {
  const fields = "title,abstract,authors,year,venue,externalIds,url,openAccessPdf,citationCount";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${encodeURIComponent(fields)}`;
  const payload = await fetchJson(url, signal);
  return (Array.isArray(payload?.data) ? payload.data : []).map((row: JsonObject) => ({
    source: "semanticScholar",
    sourceId: text(row.paperId) || text(row.externalIds?.DOI) || "semantic-scholar-unknown",
    title: text(row.title) || "Untitled paper",
    abstract: text(row.abstract),
    authors: authors(row.authors?.map((author: any) => ({ name: author.name, orcid: author.externalIds?.ORCID }))),
    year: Number(row.year) || undefined,
    venue: text(row.venue),
    doi: doi(row.externalIds?.DOI),
    url: text(row.url),
    pdfUrl: safePdfUrl(row.openAccessPdf?.url),
    pdfSource: safePdfUrl(row.openAccessPdf?.url) ? "semanticScholar" : undefined,
    citationCount: Number(row.citationCount) || undefined,
    openAccess: Boolean(row.openAccessPdf?.url),
    pdfStatus: safePdfUrl(row.openAccessPdf?.url) ? "available" : "unknown",
    raw: row,
  } satisfies PaperCandidate));
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return text(match?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, ""));
}

function extractArxivId(value: string): string | undefined {
  const match = value.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv\s*:\s*)?(\d{4}\.\d{4,5})(?:v\d+)?/i);
  return match?.[1];
}

export async function fetchArxivPaper(arxivId: string, signal?: AbortSignal): Promise<PaperCandidate[]> {
  const normalizedId = extractArxivId(arxivId);
  if (!normalizedId) return [];
  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(normalizedId)}`;
  const response = await getFetch()(url, { signal, headers: { Accept: "application/atom+xml, application/xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const id = extractArxivId(extractXmlTag(entry, "id") || normalizedId) || normalizedId;
    const authorNames = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi))
      .map((match) => ({ name: text(match[1]), lastName: (text(match[1]) || "").split(/\s+/).pop() || "" }));
    const published = extractXmlTag(entry, "published");
    return {
      source: "arxiv",
      sourceId: id,
      title: extractXmlTag(entry, "title") || "Untitled paper",
      abstract: extractXmlTag(entry, "summary"),
      authors: authorNames,
      year: year(published),
      venue: "arXiv",
      url: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}`,
      pdfSource: "arxiv",
      arxivId: id,
      openAccess: true,
      pdfStatus: "available",
      raw: entry,
    } satisfies PaperCandidate;
  });
}

export async function lookupOpenAlexByDoi(doiValue: string, signal?: AbortSignal): Promise<PaperCandidate | null> {
  const normalized = doi(doiValue);
  if (!normalized) return null;
  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(normalized)}`;
  try {
    const row = await fetchJson(url, signal) as JsonObject;
    const primaryLocation = row.primary_location || {};
    const source = primaryLocation.source || {};
    const pdfUrl = safePdfUrl(primaryLocation.pdf_url ?? row.open_access?.oa_url);
    return {
      source: "openalex",
      sourceId: text(row.id) || normalized,
      title: text(row.title) || "Untitled paper",
      abstract: reconstructAbstract(row.abstract_inverted_index),
      authors: authors(row.authorships),
      year: Number(row.publication_year) || year(row.publication_date),
      venue: text(source.display_name),
      doi: doi(row.doi) || normalized,
      url: text(primaryLocation.landing_page_url ?? row.doi),
      pdfUrl,
      pdfSource: pdfUrl ? "openalex" : undefined,
      citationCount: Number(row.cited_by_count) || undefined,
      openAccess: row.open_access?.is_oa === true,
      pdfStatus: pdfUrl ? "available" : "unknown",
      raw: row,
    } satisfies PaperCandidate;
  } catch {
    return null;
  }
}

export async function lookupSemanticScholarByDoi(doiValue: string, signal?: AbortSignal): Promise<PaperCandidate | null> {
  const normalized = doi(doiValue);
  if (!normalized) return null;
  const fields = "title,abstract,authors,year,venue,externalIds,url,openAccessPdf,citationCount";
  const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(normalized)}?fields=${encodeURIComponent(fields)}`;
  try {
    const row = await fetchJson(url, signal) as JsonObject;
    const pdfUrl = safePdfUrl(row.openAccessPdf?.url);
    return {
      source: "semanticScholar",
      sourceId: text(row.paperId) || normalized,
      title: text(row.title) || "Untitled paper",
      abstract: text(row.abstract),
      authors: authors(row.authors?.map((author: any) => ({ name: author.name, orcid: author.externalIds?.ORCID }))),
      year: Number(row.year) || undefined,
      venue: text(row.venue),
      doi: doi(row.externalIds?.DOI) || normalized,
      url: text(row.url),
      pdfUrl,
      pdfSource: pdfUrl ? "semanticScholar" : undefined,
      citationCount: Number(row.citationCount) || undefined,
      openAccess: Boolean(pdfUrl),
      pdfStatus: pdfUrl ? "available" : "unknown",
      raw: row,
    } satisfies PaperCandidate;
  } catch {
    return null;
  }
}

export async function searchCrossref(query: string, limit: number, signal?: AbortSignal): Promise<PaperCandidate[]> {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${limit}`;
  const payload = await fetchJson(url, signal);
  return (Array.isArray(payload?.message?.items) ? payload.message.items : []).map((row: JsonObject) => ({
    source: "crossref",
    sourceId: doi(row.DOI) || text(row.URL) || "crossref-unknown",
    title: text(Array.isArray(row.title) ? row.title[0] : row.title) || "Untitled paper",
    authors: authors(row.author),
    year: year(row.published?.["date-parts"]?.[0]?.[0] ?? row.publishedPrint?.["date-parts"]?.[0]?.[0]),
    venue: text(row["container-title"]?.[0]),
    doi: doi(row.DOI),
    url: text(row.URL),
    citationCount: Number(row["is-referenced-by-count"]) || undefined,
    pdfStatus: "unknown",
    raw: row,
  } satisfies PaperCandidate));
}

export const providerSearchers: Record<PaperSource, (query: string, limit: number, signal?: AbortSignal) => Promise<PaperCandidate[]>> = {
  openalex: searchOpenAlex,
  semanticScholar: searchSemanticScholar,
  crossref: searchCrossref,
  arxiv: async () => [],
};

export { extractArxivId, safePdfUrl };
