import type { DocumentChunkMetadata, DocumentLocator } from "./document/types";

export type EvidenceStatus =
  | "direct"
  | "metadata-only"
  | "location-unknown"
  | "unavailable";

/** The modality of evidence represented by this block. */
export type EvidenceKind = "text" | "figure" | "table" | "mixed" | "unknown";

/** A bounded source excerpt actually included in a model request. */
export type EvidenceBlock = {
  evidenceId: string;
  sourceId?: string;
  sourceLabel?: string;
  itemId?: number;
  contextItemId?: number;
  quote: string;
  /** Origin of the evidence, kept separate from the PDF page locator. */
  evidenceKind?: EvidenceKind;
  locator?: DocumentLocator;
  pageIndex?: number;
  pageLabel?: string;
  section?: string;
  chunkIndex?: number;
  /** Optional exact text span inside the source chunk, when available. */
  quoteStart?: number;
  quoteEnd?: number;
  segmentId?: string;
  score?: number;
  status: EvidenceStatus;
};

export function normalizeEvidenceBlocks(value: unknown): EvidenceBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is EvidenceBlock =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as EvidenceBlock).evidenceId === "string" &&
      typeof (entry as EvidenceBlock).quote === "string",
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function inferEvidenceKind(
  quote: string,
  metadata?: DocumentChunkMetadata,
): EvidenceKind {
  const roles = (metadata?.semanticRoles || []).map((role) =>
    text(role).toLowerCase(),
  );
  if (roles.some((role) => /table|tabular/.test(role))) return "table";
  if (roles.some((role) => /figure|chart|diagram|illustration|graphic/.test(role))) {
    return "figure";
  }
  // A caption is still text evidence. Without a visual region or image
  // payload, never claim that the figure itself was located.
  return quote ? "text" : "unknown";
}

export function getEvidencePageLabel(
  locator: DocumentLocator | undefined,
): string | undefined {
  if (!locator || locator.kind !== "pdf-page") return undefined;
  if (text(locator.pageLabel)) return text(locator.pageLabel);
  if (Number.isFinite(locator.pageIndex) && locator.pageIndex >= 0) {
    return `${Math.floor(locator.pageIndex) + 1}`;
  }
  return undefined;
}

export function formatEvidenceLocator(
  evidence: Pick<EvidenceBlock, "sourceLabel" | "locator" | "pageIndex" | "pageLabel">,
): string {
  const source = text(evidence.sourceLabel) || "Source";
  const page = text(evidence.pageLabel) ||
    (Number.isFinite(evidence.pageIndex) && (evidence.pageIndex as number) >= 0
      ? `${Math.floor(evidence.pageIndex as number) + 1}`
      : "");
  if (page) return `${source}, p. ${page}`;
  if (evidence.locator?.kind === "epub-location") {
    return evidence.locator.locationLabel
      ? `${source}, ${text(evidence.locator.locationLabel)}`
      : `${source}, location unavailable`;
  }
  return `${source}, page unavailable`;
}

export function createEvidenceBlock(params: {
  sourceId?: string;
  sourceLabel?: string;
  itemId?: number;
  contextItemId?: number;
  quote: string;
  locator?: DocumentLocator;
  metadata?: DocumentChunkMetadata;
  chunkIndex?: number;
  quoteStart?: number;
  quoteEnd?: number;
  score?: number;
}): EvidenceBlock {
  const quote =
    typeof params.quote === "string"
      ? params.quote.replace(/\r\n?/g, "\n").trim()
      : "";
  const locator = params.locator || params.metadata?.locator;
  const pageLabel = getEvidencePageLabel(locator);
  const pageIndex = locator?.kind === "pdf-page" ? locator.pageIndex : undefined;
  const section = text(
    params.metadata?.headingPath?.filter(Boolean).join(" > ") ||
      params.metadata?.title,
  );
  const evidenceId = [
    text(params.sourceId) || "source-unknown",
    params.metadata?.segmentId || `chunk-${params.chunkIndex ?? 0}`,
    pageIndex ?? "no-page",
  ].join(":");
  return {
    evidenceId,
    sourceId: text(params.sourceId) || undefined,
    sourceLabel: text(params.sourceLabel) || undefined,
    itemId: params.itemId,
    contextItemId: params.contextItemId,
    quote,
    evidenceKind: inferEvidenceKind(quote, params.metadata),
    locator,
    pageIndex,
    pageLabel,
    section: section || undefined,
    chunkIndex: params.chunkIndex,
    quoteStart: params.quoteStart,
    quoteEnd: params.quoteEnd,
    segmentId: params.metadata?.segmentId,
    score: Number.isFinite(params.score) ? params.score : undefined,
    status: quote ? (locator ? "direct" : "location-unknown") : "unavailable",
  };
}

export function formatEvidenceInstruction(blocks: EvidenceBlock[]): string {
  if (!blocks.length) return "";
  const lines = blocks.map((block) => {
    const locator = formatEvidenceLocator(block);
    const section = block.section ? ` · ${block.section}` : "";
    const kind = block.evidenceKind ? ` · kind=${block.evidenceKind}` : "";
    return `[evidence:${block.evidenceId}] ${locator}${section}${kind} · status=${block.status}`;
  });
  return [
    "Evidence blocks below are source excerpts included with this request.",
    "The evidence text is included in the source blocks above. Use only those blocks for factual claims. Cite the source label and page when available; never invent a page number.",
    ...lines,
  ].join("\n\n");
}

export const __evidenceTest = {
  getEvidencePageLabel,
  formatEvidenceLocator,
  createEvidenceBlock,
  formatEvidenceInstruction,
};
