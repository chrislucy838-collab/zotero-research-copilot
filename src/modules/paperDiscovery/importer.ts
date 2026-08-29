import type { PaperCandidate, PaperAuthor, PaperImportPreview, ZoteroImportResult } from "./types";

function normalizeDoi(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[.,;)}\]]+$/, "");
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

function getField(item: Zotero.Item, field: string): string {
  try { return String(item.getField(field) || "").trim(); } catch { return ""; }
}

function existingItemFor(candidate: PaperCandidate, items: Zotero.Item[]): Zotero.Item | null {
  const candidateDoi = normalizeDoi(candidate.doi);
  const title = normalizeTitle(candidate.title);
  const firstAuthor = String(candidate.authors[0]?.lastName || "").toLowerCase();
  for (const item of items) {
    if (!item?.isRegularItem?.()) continue;
    if (candidateDoi && normalizeDoi(getField(item, "DOI")) === candidateDoi) return item;
    const itemTitle = normalizeTitle(getField(item, "title"));
    const itemFirstCreator = String(item.firstCreator || "").toLowerCase();
    const itemYear = getField(item, "year").match(/\b(19|20)\d{2}\b/)?.[0];
    if (title && itemTitle === title && (!firstAuthor || itemFirstCreator.includes(firstAuthor)) && (!candidate.year || !itemYear || String(candidate.year) === itemYear)) return item;
  }
  return null;
}

function setIfPresent(item: Zotero.Item, field: string, value: unknown): void {
  const text = String(value ?? "").trim();
  if (text) item.setField(field, text);
}

function setCreators(item: Zotero.Item, authors: PaperAuthor[]): void {
  for (const author of authors) {
    const creator = author.firstName && author.lastName
      ? { firstName: author.firstName, lastName: author.lastName, creatorType: "author" }
      : { name: author.name || author.lastName, creatorType: "author" };
    item.setCreator(item.getCreators().length, creator as any);
  }
}

export type PaperImportOptions = {
  collectionId?: number;
  attachPdf?: boolean;
  signal?: AbortSignal;
  /** Maximum time to wait for one Zotero operation. */
  operationTimeoutMs?: number;
  /** Maximum time to wait for Zotero's native PDF importer. */
  pdfTimeoutMs?: number;
  onProgress?: (message: string) => void;
  onResult?: (result: ZoteroImportResult) => void;
};

function normalizeCollectionId(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function abortError(): Error {
  return new Error("Import cancelled");
}

function timeoutError(timeoutMs: number, operation = "Zotero operation"): Error {
  return new Error(`${operation} timed out after ${Math.round(timeoutMs / 1000)}s`);
}

async function waitForZoteroOperation<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = Math.max(1000, Math.floor(timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  // Keep observing the native operation after our guard returns. This prevents
  // a late rejection from becoming an unhandled promise rejection in Zotero.
  void operation.catch(() => undefined);
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(timeoutError(timeout, operationName)), timeout);
      abortHandler = () => reject(abortError());
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      signal?.addEventListener("abort", abortHandler, { once: true });
      operation.then(resolve, reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (abortHandler) signal?.removeEventListener("abort", abortHandler);
  }
}

async function attachCandidatePdf(
  candidate: PaperCandidate,
  item: Zotero.Item,
  libraryID: number,
  collectionId?: number,
  timeoutMs = 30000,
  signal?: AbortSignal,
  onProgress?: (message: string) => void,
): Promise<{ attachmentId?: number; status: "attached" | "unavailable" | "failed"; error?: string }> {
  const pdfUrl = String(candidate.pdfUrl || "").trim();
  const label = candidate.title.trim().slice(0, 70);
  if (!pdfUrl) {
    onProgress?.(`PDF unavailable, skipping: ${label}`);
    return { status: "unavailable" };
  }
  onProgress?.(`Downloading PDF: ${label}`);
  if (!/^https:\/\//i.test(pdfUrl)) {
    return { status: "failed", error: "PDF URL is not HTTPS" };
  }
  try {
    const attachments = Zotero.Attachments as unknown as {
      importFromURL?: (options: Record<string, unknown>) => Promise<Zotero.Item>;
    };
    if (typeof attachments.importFromURL !== "function") {
      return { status: "failed", error: "Zotero attachment importer is unavailable" };
    }
    const attachment = await waitForZoteroOperation(
      attachments.importFromURL({
        url: pdfUrl,
        libraryID,
        parentItemID: item.id,
        title: `${candidate.title.trim() || "Paper"}.pdf`,
        fileBaseName: `${candidate.title.trim() || "paper"}.pdf`,
        contentType: "application/pdf",
        ...(collectionId ? { collections: [collectionId] } : {}),
      }),
      timeoutMs,
      "PDF download",
      signal,
    );
    return attachment?.id > 0
      ? { attachmentId: attachment.id, status: "attached" }
      : { status: "failed", error: "Zotero did not return a PDF attachment" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function previewPaperCandidates(
  candidates: PaperCandidate[],
  items: Zotero.Item[],
): PaperImportPreview[] {
  return candidates.map((candidate) => {
    const existing = existingItemFor(candidate, items);
    return existing
      ? { candidate, status: "duplicate", existingItemId: existing.id }
      : { candidate, status: "new" };
  });
}

export async function importPaperCandidates(
  candidates: PaperCandidate[],
  libraryID: number,
  options: PaperImportOptions = {},
): Promise<ZoteroImportResult[]> {
  const operationTimeoutMs = options.operationTimeoutMs ?? 30000;
  options.onProgress?.("Reading Zotero library…");
  const items = await waitForZoteroOperation(
    Zotero.Items.getAll(libraryID, true, false, false),
    operationTimeoutMs,
    "Reading Zotero library",
    options.signal,
  ) as Zotero.Item[];
  const results: ZoteroImportResult[] = [];
  for (const candidate of candidates) {
    if (options.signal?.aborted) {
      const cancelled: ZoteroImportResult = { candidate, status: "cancelled" };
      results.push(cancelled);
      options.onResult?.(cancelled);
      continue;
    }
    const label = candidate.title.trim().slice(0, 70);
    options.onProgress?.(`Checking duplicate: ${label}`);
    const existing = existingItemFor(candidate, items);
    if (existing) {
      options.onProgress?.(`Already in Zotero: ${label}`);
      const duplicate: ZoteroImportResult = { candidate, status: "duplicate", existingItemId: existing.id };
      results.push(duplicate);
      options.onResult?.(duplicate);
      continue;
    }
    try {
      const item = new Zotero.Item("journalArticle");
      item.libraryID = libraryID;
      const collectionId = normalizeCollectionId(options.collectionId);
      if (collectionId) item.addToCollection(collectionId);
      setIfPresent(item, "title", candidate.title);
      setIfPresent(item, "abstractNote", candidate.abstract);
      setIfPresent(item, "date", candidate.year);
      setIfPresent(item, "publicationTitle", candidate.venue);
      setIfPresent(item, "DOI", candidate.doi);
      setIfPresent(item, "url", candidate.url);
      setIfPresent(item, "extra", candidate.arxivId ? `arXiv: ${candidate.arxivId}` : "");
      setCreators(item, candidate.authors);
      options.onProgress?.(`Saving metadata: ${label}`);
      await waitForZoteroOperation(
        item.saveTx(),
        operationTimeoutMs,
        "Saving metadata",
        options.signal,
      );
      items.push(item);
      const pdf = options.attachPdf === false
        ? { status: "unavailable" as const }
        : await attachCandidatePdf(
          candidate,
          item,
          libraryID,
          collectionId,
          options.pdfTimeoutMs,
          options.signal,
          options.onProgress,
        );
      const imported: ZoteroImportResult = {
        candidate,
        status: "imported",
        itemId: item.id,
        collectionId,
        attachmentId: pdf.attachmentId,
        pdfStatus: options.attachPdf === false ? "skipped" : pdf.status,
        pdfError: pdf.error,
      };
      results.push(imported);
      options.onProgress?.(`Imported: ${label}`);
      options.onResult?.(imported);
    } catch (error) {
      const failed: ZoteroImportResult = { candidate, status: "failed", error: error instanceof Error ? error.message : String(error) };
      results.push(failed);
      options.onResult?.(failed);
    }
  }
  return results;
}

export const __paperImporterTest = {
  normalizeDoi,
  normalizeTitle,
  previewPaperCandidates,
  timeoutError,
  waitForZoteroOperation,
};
