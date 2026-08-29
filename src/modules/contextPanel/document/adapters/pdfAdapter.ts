import type {
  DocumentAdapter,
  DocumentExtraction,
  DocumentSegment,
} from "../types";
import {
  getAttachmentContentType,
  getAttachmentSourceRevision,
  getDocumentTitle,
} from "./shared";

export const PDF_CONTENT_TYPE = "application/pdf";

const capabilities: DocumentAdapter["capabilities"] = {
  selectionText: true,
  panelChat: true,
  structuredSections: false,
  navigableLocators: false,
  screenshot: true,
  fullDocumentTranslation: true,
};

function buildPdfPageSegments(text: string): DocumentSegment[] | undefined {
  // Zotero's PDFWorker uses form-feed separators for page boundaries. Only
  // attach page locators when that delimiter is actually present; a plain
  // aggregate text response must remain page-unknown rather than guessed.
  if (!text.includes("\f")) return undefined;
  const pages = text.split("\f");
  const segments: DocumentSegment[] = [];
  pages.forEach((pageText, pageIndex) => {
    const normalized = String(pageText || "").trim();
    if (!normalized) return;
    segments.push({
      id: `pdf-page-${pageIndex + 1}`,
      title: `Page ${pageIndex + 1}`,
      text: normalized,
      locator: { kind: "pdf-page", pageIndex },
      role: "content",
      source: "zotero-pdfworker-page-boundary",
      confidence: "authoritative",
      linear: true,
      readingOrder: pageIndex + 1,
    });
  });
  return segments.length ? segments : undefined;
}

async function extractPdfText(item: Zotero.Item): Promise<DocumentExtraction> {
  let text = "";
  try {
    const result = await Zotero.PDFWorker.getFullText(item.id);
    if (result?.text) {
      text = String(result.text);
    }
  } catch (err) {
    ztoolkit.log("PDF extraction failed:", err);
  }

  const sourceSegments = buildPdfPageSegments(text);
  const normalizedText = sourceSegments
    ? sourceSegments.map((segment) => segment.text).join("\n\n")
    : text;
  return {
    text: normalizedText,
    segments: sourceSegments,
    completeness: normalizedText ? "complete" : "unavailable",
  };
}

export const pdfDocumentAdapter: DocumentAdapter = {
  kind: "pdf",
  contentTypes: [PDF_CONTENT_TYPE],
  capabilities,
  presentation: {
    noun: "paper",
    fullTextHeading: "Paper Full Text (complete document):",
    excerptsHeading: "Paper Text:",
    relevantSectionsNotice: "Relevant sections extracted from the document",
  },
  contextPolicy: {
    strategy: "full-or-retrieval",
    useEmbeddings: true,
    eagerWarmup: true,
  },
  selectionContextPolicy: {
    strategy: "cold-start-cache",
    allowUnattributedSelection: false,
  },
  supports(item): item is Zotero.Item {
    return Boolean(
      item?.isAttachment?.() &&
      getAttachmentContentType(item) === PDF_CONTENT_TYPE,
    );
  },
  describe(item) {
    return {
      item,
      kind: "pdf",
      title: getDocumentTitle(item),
      capabilities,
    };
  },
  getSourceRevision: getAttachmentSourceRevision,
  extract: extractPdfText,
};
