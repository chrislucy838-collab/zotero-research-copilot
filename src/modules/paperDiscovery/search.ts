import {
  extractArxivId,
  fetchArxivPaper,
  lookupCrossrefByDoi,
  lookupOpenAlexByDoi,
  lookupSemanticScholarByDoi,
  providerSearchers,
} from "./providers";
import type {
  PaperCandidate,
  PaperSearchOptions,
  PaperSearchResult,
  PaperSource,
} from "./types";

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
  return String(candidate.authors[0]?.lastName || "")
    .toLowerCase()
    .trim();
}

function mergeCandidate(
  target: PaperCandidate,
  incoming: PaperCandidate,
): void {
  target.sources = Array.from(
    new Set([...(target.sources || [target.source]), incoming.source]),
  );
  target.abstract ||= incoming.abstract;
  target.venue ||= incoming.venue;
  target.doi ||= incoming.doi;
  target.url ||= incoming.url;
  target.pdfUrl ||= incoming.pdfUrl;
  target.pdfSource ||= incoming.pdfSource;
  target.year ||= incoming.year;
  target.citationCount ||= incoming.citationCount;
  target.openAccess ||= incoming.openAccess;
  if (target.pdfStatus !== "available")
    target.pdfStatus = incoming.pdfStatus || target.pdfStatus || "unknown";
  if (target.authors.length < incoming.authors.length)
    target.authors = incoming.authors;
  if (target.source === "crossref" && incoming.source !== "crossref") {
    target.source = incoming.source;
  }
}

export function mergePaperCandidates(
  candidates: PaperCandidate[],
): PaperCandidate[] {
  const byDoi = new Map<string, PaperCandidate>();
  const byTitleAuthorYear = new Map<string, PaperCandidate>();
  const merged: PaperCandidate[] = [];
  for (const candidate of candidates) {
    candidate.doi = normalizeDoi(candidate.doi);
    candidate.sources ||= [candidate.source];
    const doiKey = candidate.doi;
    const titleKey = `${normalizeTitle(candidate.title)}|${authorKey(candidate)}|${candidate.year || ""}`;
    const existing =
      (doiKey && byDoi.get(doiKey)) || byTitleAuthorYear.get(titleKey);
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

export async function searchPapers(
  query: string,
  options: PaperSearchOptions = {},
): Promise<PaperSearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { query, candidates: [], providerErrors: {} };
  const arxivId = extractArxivId(normalizedQuery);
  if (arxivId) {
    try {
      return {
        query,
        candidates: mergePaperCandidates(
          await fetchArxivPaper(arxivId, options.signal),
        ),
        providerErrors: {},
      };
    } catch (error) {
      return {
        query,
        candidates: [],
        providerErrors: {
          arxiv: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  const sources: PaperSource[] = options.sources?.length
    ? options.sources
    : ["semanticScholar", "openalex", "crossref"];
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 10)));
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return {
          source,
          candidates: await providerSearchers[source](
            normalizedQuery,
            limit,
            options.signal,
          ),
        };
      } catch (error) {
        return {
          source,
          candidates: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  const providerErrors: Partial<Record<PaperSource, string>> = {};
  const all: PaperCandidate[] = [];
  for (const result of results) {
    all.push(...result.candidates);
    if (result.error) providerErrors[result.source] = result.error;
  }
  const merged = mergePaperCandidates(all);
  const allowOpenAlexFallback = sources.includes("openalex");
  const allowSemanticScholarFallback = sources.includes("semanticScholar");
  const fallbackCandidates = merged.filter(
    (candidate) =>
      candidate.source === "crossref" && candidate.doi && !candidate.pdfUrl,
  );
  if (fallbackCandidates.length) {
    const fallbackResults = await Promise.all(
      fallbackCandidates.map(async (candidate) => {
        const doi = candidate.doi as string;
        const [openAlex, semanticScholar] = await Promise.all([
          allowOpenAlexFallback
            ? lookupOpenAlexByDoi(doi, options.signal)
            : Promise.resolve(null),
          allowSemanticScholarFallback
            ? lookupSemanticScholarByDoi(doi, options.signal)
            : Promise.resolve(null),
        ]);
        return { candidate, openAlex, semanticScholar };
      }),
    );
    for (const { candidate, openAlex, semanticScholar } of fallbackResults) {
      const fallback = openAlex?.pdfUrl
        ? openAlex
        : semanticScholar?.pdfUrl
          ? semanticScholar
          : null;
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

export type PaperReferenceQuery = {
  query: string;
  queries?: string[];
  doi?: string;
  arxivId?: string;
  title?: string;
};

function scoreReferenceCandidate(
  candidate: PaperCandidate,
  reference: PaperReferenceQuery,
): number {
  const expectedDoi = normalizeDoi(reference.doi);
  const candidateDoi = normalizeDoi(candidate.doi);
  if (expectedDoi && candidateDoi === expectedDoi) return 10000;
  if (reference.arxivId && candidate.arxivId === reference.arxivId)
    return 10000;
  const expectedTitle = normalizeTitle(reference.title || reference.query);
  const actualTitle = normalizeTitle(candidate.title);
  if (!expectedTitle || !actualTitle) return 0;
  if (actualTitle === expectedTitle) return 5000;
  if (
    actualTitle.includes(expectedTitle) ||
    expectedTitle.includes(actualTitle)
  ) {
    return 3000 + Math.min(expectedTitle.length, actualTitle.length);
  }
  const expectedTokens = new Set(
    expectedTitle.split(" ").filter((token) => token.length > 2),
  );
  const actualTokens = new Set(actualTitle.split(" "));
  let overlap = 0;
  for (const token of expectedTokens) {
    if (actualTokens.has(token)) overlap += 1;
  }
  return overlap * 100;
}

function sortReferenceCandidates(
  candidates: PaperCandidate[],
  reference: PaperReferenceQuery,
): PaperCandidate[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreReferenceCandidate(candidate, reference),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ candidate }) => candidate);
}

/** Search one extracted bibliography entry with DOI-aware and title-aware fallbacks. */
export async function searchPaperReference(
  reference: PaperReferenceQuery,
  options: PaperSearchOptions = {},
): Promise<PaperSearchResult> {
  const sources = options.sources?.length
    ? options.sources
    : (["semanticScholar", "openalex", "crossref"] as PaperSource[]);

  if (reference.arxivId) {
    try {
      const arxivCandidates = await fetchArxivPaper(
        reference.arxivId,
        options.signal,
      );
      if (arxivCandidates.length) {
        return {
          query: `arXiv:${reference.arxivId}`,
          candidates: arxivCandidates,
          providerErrors: {},
        };
      }
    } catch {
      // arXiv may rate-limit or be temporarily unavailable. Continue with
      // DOI/provider/title fallbacks instead of failing the whole reference.
    }
  }

  if (reference.doi) {
    const exactResults = await Promise.all([
      sources.includes("openalex")
        ? lookupOpenAlexByDoi(reference.doi, options.signal)
        : Promise.resolve(null),
      sources.includes("semanticScholar")
        ? lookupSemanticScholarByDoi(reference.doi, options.signal)
        : Promise.resolve(null),
      sources.includes("crossref")
        ? lookupCrossrefByDoi(reference.doi, options.signal)
        : Promise.resolve(null),
    ]);
    const exactCandidates = exactResults.filter(
      (candidate): candidate is PaperCandidate => Boolean(candidate),
    );
    if (exactCandidates.length) {
      return {
        query: reference.doi,
        candidates: sortReferenceCandidates(
          mergePaperCandidates(exactCandidates),
          reference,
        ),
        providerErrors: {},
      };
    }
  }

  const queries = Array.from(
    new Set(
      [
        reference.arxivId ? `arXiv:${reference.arxivId}` : undefined,
        reference.title,
        ...(reference.queries || []),
        reference.query,
      ]
        .map((value) =>
          String(value || "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter((value) => value.length >= 3),
    ),
  );
  let last: PaperSearchResult = {
    query: reference.query,
    candidates: [],
    providerErrors: {},
  };
  for (const query of queries) {
    last = await searchPapers(query, options);
    if (last.candidates.length) {
      last.candidates = sortReferenceCandidates(last.candidates, reference);
      const bestScore = reference.title
        ? scoreReferenceCandidate(last.candidates[0], reference)
        : 1;
      // Do not present an arbitrary first result as a match when the title
      // evidence is too weak. It is safer to report "unmatched" than to
      // import a different paper under the current reference.
      if (bestScore >= (reference.title ? 300 : 1)) return last;
      last = {
        ...last,
        candidates: [],
      };
    }
  }
  return last;
}

export const __paperDiscoveryTest = {
  normalizeDoi,
  normalizeTitle,
  mergePaperCandidates,
  extractArxivId,
  searchPaperReference,
  scoreReferenceCandidate,
};
