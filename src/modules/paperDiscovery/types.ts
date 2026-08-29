export type PaperSource = "openalex" | "semanticScholar" | "crossref" | "arxiv";

export type PaperAuthor = {
  firstName?: string;
  lastName: string;
  name?: string;
  orcid?: string;
};

export type PaperCandidate = {
  source: PaperSource;
  sourceId: string;
  title: string;
  abstract?: string;
  authors: PaperAuthor[];
  year?: number;
  venue?: string;
  doi?: string;
  url?: string;
  pdfUrl?: string;
  arxivId?: string;
  citationCount?: number;
  openAccess?: boolean;
  pdfStatus?: "available" | "unavailable" | "unknown";
  pdfSource?: "openalex" | "semanticScholar" | "arxiv" | "crossref";
  sources?: PaperSource[];
  duplicateOf?: number;
  raw?: unknown;
};

export type PaperSearchOptions = {
  sources?: PaperSource[];
  limit?: number;
  signal?: AbortSignal;
};

export type PaperSearchResult = {
  query: string;
  candidates: PaperCandidate[];
  providerErrors: Partial<Record<PaperSource, string>>;
};

export type ZoteroImportStatus = "imported" | "duplicate" | "failed" | "cancelled";

export type PaperImportPreview = {
  candidate: PaperCandidate;
  status: "new" | "duplicate";
  existingItemId?: number;
};

export type ZoteroImportResult = {
  candidate: PaperCandidate;
  status: ZoteroImportStatus;
  itemId?: number;
  existingItemId?: number;
  collectionId?: number;
  attachmentId?: number;
  pdfStatus?: "attached" | "unavailable" | "failed" | "skipped";
  error?: string;
  pdfError?: string;
};
