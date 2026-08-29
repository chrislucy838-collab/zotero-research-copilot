import {
  extractArxivId,
  fetchArxivPaper,
  lookupOpenAlexByDoi,
  lookupSemanticScholarByDoi,
  providerSearchers,
} from "./providers";
import type { PaperCandidate, PaperSearchOptions, PaperSearchResult, PaperSource } from "./types";

function normalizeDoi(value: unknown): string | undefined {
  const result = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[.,;)}\]]+$/, "");
  return /^10\.\d{4,9}\//.test(result) ? result : undefined;
}

function normalizeTitle(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function authorKey(candidate: PaperCandidate): string {
  return String(candidate.authors[0]?.lastName || "").toLowerCase().trim();
}

function mergeCandidate(target: PaperCandidate, incoming: PaperCandidate): void {
  target.sources = Array.from(new Set([...(target.sources || [target.source]), incoming.source]));
  target.abstract ||= incoming.abstract;
  target.venue ||= incoming.venue;
  target.doi ||= incoming.doi;
  target.url ||= incoming.url;
  target.pdfUrl ||= incoming.pdfUrl;
  target.pdfSource ||= incoming.pdfSource;
  target.year ||= incoming.year;
  target.citationCount ||= incoming.citationCount;
  target.openAccess ||= incoming.openAccess;
  if (target.pdfStatus !== "available") target.pdfStatus = incoming.pdfStatus || target.pdfStatus || "unknown";
  if (target.authors.length < incoming.authors.length) target.authors = incoming.authors;
  if (target.source === "crossref" && incoming.source !== "crossref") {
    target.source = incoming.source;
  }
}

export function mergePaperCandidates(candidates: PaperCandidate[]): PaperCandidate[] {
  const byDoi = new Map<string, PaperCandidate>();
  const byTitleAuthorYear = new Map<string, PaperCandidate>();
  const merged: PaperCandidate[] = [];
  for (const candidate of candidates) {
    candidate.doi = normalizeDoi(candidate.doi);
    candidate.sources ||= [candidate.source];
    const doiKey = candidate.doi;
    const titleKey = `${normalizeTitle(candidate.title)}|${authorKey(candidate)}|${candidate.year || ""}`;
    const existing = (doiKey && byDoi.get(doiKey)) || byTitleAuthorYear.get(titleKey);
    if (existing) {
      mergeCandidate(existing, candidate);
      if (existing.doi) byDoi.set(existing.doi, existing);
      continue;
    }
    merged.push(candidate);
    if (doiKey) byDoi.set(doiKey, candidate);
    byTitleAuthorYear.set(titleKey, candidate);
  }
  return merged;
}

export async function searchPapers(query: string, options: PaperSearchOptions = {}): Promise<PaperSearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { query, candidates: [], providerErrors: {} };
  const arxivId = extractArxivId(normalizedQuery);
  if (arxivId) {
    try {
      return { query, candidates: mergePaperCandidates(await fetchArxivPaper(arxivId, options.signal)), providerErrors: {} };
    } catch (error) {
      return { query, candidates: [], providerErrors: { arxiv: error instanceof Error ? error.message : String(error) } };
    }
  }
  const sources: PaperSource[] = options.sources?.length
    ? options.sources
    : ["semanticScholar", "openalex", "crossref"];
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 10)));
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return { source, candidates: await providerSearchers[source](normalizedQuery, limit, options.signal) };
    } catch (error) {
      return { source, candidates: [], error: error instanceof Error ? error.message : String(error) };
    }
  }));
  const providerErrors: Partial<Record<PaperSource, string>> = {};
  const all: PaperCandidate[] = [];
  for (const result of results) {
    all.push(...result.candidates);
    if (result.error) providerErrors[result.source] = result.error;
  }
  const merged = mergePaperCandidates(all);
  const allowOpenAlexFallback = sources.includes("openalex");
  const allowSemanticScholarFallback = sources.includes("semanticScholar");
  const fallbackCandidates = merged.filter((candidate) =>
    candidate.source === "crossref" && candidate.doi && !candidate.pdfUrl,
  );
  if (fallbackCandidates.length) {
    const fallbackResults = await Promise.all(fallbackCandidates.map(async (candidate) => {
      const doi = candidate.doi as string;
      const [openAlex, semanticScholar] = await Promise.all([
        allowOpenAlexFallback ? lookupOpenAlexByDoi(doi, options.signal) : Promise.resolve(null),
        allowSemanticScholarFallback ? lookupSemanticScholarByDoi(doi, options.signal) : Promise.resolve(null),
      ]);
      return { candidate, openAlex, semanticScholar };
    }));
    for (const { candidate, openAlex, semanticScholar } of fallbackResults) {
      const fallback = openAlex?.pdfUrl ? openAlex : semanticScholar?.pdfUrl ? semanticScholar : null;
      if (!fallback?.pdfUrl) continue;
      candidate.pdfUrl = fallback.pdfUrl;
      candidate.pdfSource = fallback.pdfSource;
      candidate.pdfStatus = "available";
      candidate.openAccess ||= fallback.openAccess;
      candidate.url ||= fallback.url;
    }
  }
  return { query, candidates: merged, providerErrors };
}

export const __paperDiscoveryTest = { normalizeDoi, normalizeTitle, mergePaperCandidates, extractArxivId };
