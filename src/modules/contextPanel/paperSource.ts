import type { DocumentContextRef } from "./document/types";
import type { PaperContextRef, PaperSourceAvailability } from "./types";

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function positiveId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : 0;
}

/** Stable identity for one bibliographic item/document pair. */
export function getPaperSourceId(ref: {
  itemId?: unknown;
  contextItemId?: unknown;
}): string {
  const itemId = positiveId(ref.itemId);
  const contextItemId = positiveId(ref.contextItemId);
  return `zotero-paper:${itemId || contextItemId}:${contextItemId || itemId}`;
}

export function getPaperSourceLabel(index: number): string {
  return `Paper ${Math.max(1, Math.floor(index) + 1)}`;
}

export function inferPaperSourceAvailability(
  ref: Pick<PaperContextRef, "availability" | "contextItemId" | "itemId">,
): PaperSourceAvailability {
  if (ref.availability) return ref.availability;
  if (ref.contextItemId > 0 && ref.contextItemId !== ref.itemId) {
    return "full-text";
  }
  return "metadata-only";
}

export function normalizePaperSourceRef(
  ref: PaperContextRef,
  index: number,
  sourceKind: "active-document" | "supplemental-paper" =
    "supplemental-paper",
): PaperContextRef {
  const sourceId = normalizeText(ref.sourceId) || getPaperSourceId(ref);
  const sourceLabel = normalizeText(ref.sourceLabel) || getPaperSourceLabel(index);
  return {
    ...ref,
    sourceId,
    sourceLabel,
    sourceKind,
    availability: inferPaperSourceAvailability(ref),
  };
}

export function normalizePaperSourceRefs(
  refs: PaperContextRef[],
  sourceKind: "active-document" | "supplemental-paper" =
    "supplemental-paper",
  labelOffset = 0,
): PaperContextRef[] {
  const seen = new Set<string>();
  const output: PaperContextRef[] = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    const sourceId = normalizeText(ref.sourceId) || getPaperSourceId(ref);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    output.push(
      normalizePaperSourceRef(ref, output.length + labelOffset, sourceKind),
    );
  }
  return output;
}

/** Apply the display order for the current source set, including legacy refs. */
export function relabelPaperSourceRefs(
  refs: PaperContextRef[],
  labelOffset = 0,
  sourceKind: "active-document" | "supplemental-paper" =
    "supplemental-paper",
): PaperContextRef[] {
  return normalizePaperSourceRefs(refs, sourceKind).map((ref, index) => ({
    ...ref,
    sourceLabel: getPaperSourceLabel(index + labelOffset),
    sourceKind,
  }));
}

export function paperSourceToDocumentRef(
  ref: PaperContextRef,
): DocumentContextRef {
  const normalized = normalizePaperSourceRef(ref, 0, "active-document");
  return {
    kind: "pdf",
    itemId: normalized.itemId,
    contextItemId: normalized.contextItemId,
    title: normalized.title,
    sourceId: normalized.sourceId,
    sourceLabel: normalized.sourceLabel,
    availability: normalized.availability,
  };
}

export function formatPaperSourceHeader(
  ref: PaperContextRef | DocumentContextRef,
): string {
  const sourceLabel = normalizeText(ref.sourceLabel) || "Paper";
  const title = normalizeText(ref.title) || "Untitled paper";
  const paperRef = ref as PaperContextRef;
  const metadata = [
    normalizeText(paperRef.firstCreator),
    normalizeText(paperRef.year),
  ]
    .filter(Boolean)
    .join(" · ");
  const availability = ref.availability
    ? ref.availability
    : inferPaperSourceAvailability(ref);
  return [
    `[${sourceLabel}]`,
    title,
    metadata,
    `sourceId=${normalizeText(ref.sourceId) || getPaperSourceId(ref)}`,
    `availability=${availability === "full-text" ? "full text" : availability}`, 
  ]
    .filter(Boolean)
    .join("\n");
}

export const __paperSourceTest = {
  getPaperSourceId,
  getPaperSourceLabel,
  inferPaperSourceAvailability,
  normalizePaperSourceRef,
  formatPaperSourceHeader,
};
