import type { PaperContextRef, ChatAttachment } from "./types";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  activePaperConversationByItem,
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  selectedImageCache,
  selectedImagePreviewExpandedCache,
  selectedPaperContextCache,
  selectedPaperPreviewExpandedCache,
} from "./state";

export type ReaderOpenOptions = {
  tabID?: string;
  openInBackground: boolean;
  openInWindow: boolean;
  allowDuplicate: boolean;
};

/**
 * Build options that keep navigation inside Zotero's existing reader tab.
 * Keeping this pure makes the no-new-window contract easy to test.
 */
export function buildReaderOpenOptions(
  tabID?: string | number | null,
): ReaderOpenOptions {
  const options: ReaderOpenOptions = {
    openInBackground: false,
    openInWindow: false,
    allowDuplicate: false,
  };
  if (tabID !== undefined && tabID !== null && `${tabID}`.trim()) {
    options.tabID = `${tabID}`;
  }
  return options;
}

function getItem(itemId: number): Zotero.Item | null {
  if (!Number.isFinite(itemId) || itemId <= 0) return null;
  try {
    return getZoteroItem(Math.floor(itemId));
  } catch (_error) {
    void _error;
    return null;
  }
}

function isReaderAttachment(item: Zotero.Item | null | undefined): boolean {
  if (!item?.isAttachment?.()) return false;
  return Boolean(
    (item as Zotero.Item & { attachmentReaderType?: string })
      .attachmentReaderType ||
    item.attachmentContentType === "application/pdf" ||
    item.attachmentContentType === "application/epub+zip",
  );
}

/** Resolve the attachment Zotero.Reader.open expects from a paper reference. */
export function resolvePaperNavigationAttachment(
  paperContext: PaperContextRef,
): Zotero.Item | null {
  const contextItem = getItem(paperContext.contextItemId);
  if (isReaderAttachment(contextItem)) return contextItem;

  const item = getItem(paperContext.itemId);
  if (isReaderAttachment(item)) return item;
  if (!item?.getAttachments) return null;

  for (const attachmentId of item.getAttachments()) {
    const attachment = getItem(Number(attachmentId));
    if (isReaderAttachment(attachment)) return attachment;
  }
  return null;
}

function getTabsCandidate(): any | null {
  const candidates: any[] = [];
  try {
    candidates.push((Zotero as unknown as { Tabs?: any }).Tabs);
  } catch (_error) {
    void _error;
  }
  try {
    const mainWindow = Zotero.getMainWindow?.() as any;
    candidates.push(mainWindow?.Zotero_Tabs, mainWindow?.Zotero?.Tabs);
  } catch (_error) {
    void _error;
  }
  try {
    const paneWindow = Zotero.getActiveZoteroPane?.()?.document
      ?.defaultView as any;
    candidates.push(paneWindow?.Zotero_Tabs, paneWindow?.Zotero?.Tabs);
  } catch (_error) {
    void _error;
  }
  return (
    candidates.find((candidate) => candidate && candidate.selectedID != null) ||
    null
  );
}

export function getSelectedReaderTabID(): string | null {
  const tabs = getTabsCandidate();
  if (!tabs) return null;
  const selectedType = `${tabs.selectedType || ""}`.toLowerCase();
  if (selectedType && !selectedType.includes("reader")) return null;
  const selectedID = tabs.selectedID;
  return selectedID === undefined || selectedID === null
    ? null
    : `${selectedID}`;
}

/**
 * Carry the compose state into the Reader item that Zotero will render next.
 * The source item remains untouched, so returning to it does not lose state.
 */
export function preserveReaderConversationState(
  sourceItemId: number,
  targetAttachmentId: number,
  conversationKey: number | null | undefined,
): void {
  const sourceId = Math.floor(Number(sourceItemId) || 0);
  const targetId = Math.floor(Number(targetAttachmentId) || 0);
  const key = Math.floor(Number(conversationKey) || 0);
  if (sourceId <= 0 || targetId <= 0 || sourceId === targetId || key <= 0) {
    return;
  }

  activePaperConversationByItem.set(targetId, key);

  const papers = selectedPaperContextCache.get(sourceId);
  if (papers) selectedPaperContextCache.set(targetId, [...papers]);
  const files = selectedFileAttachmentCache.get(sourceId);
  if (files)
    selectedFileAttachmentCache.set(targetId, [...files] as ChatAttachment[]);
  const images = selectedImageCache.get(sourceId);
  if (images) selectedImageCache.set(targetId, [...images]);

  if (selectedPaperPreviewExpandedCache.has(sourceId)) {
    selectedPaperPreviewExpandedCache.set(
      targetId,
      selectedPaperPreviewExpandedCache.get(sourceId) === true,
    );
  }
  if (selectedFilePreviewExpandedCache.has(sourceId)) {
    selectedFilePreviewExpandedCache.set(
      targetId,
      selectedFilePreviewExpandedCache.get(sourceId) === true,
    );
  }
  if (selectedImagePreviewExpandedCache.has(sourceId)) {
    selectedImagePreviewExpandedCache.set(
      targetId,
      selectedImagePreviewExpandedCache.get(sourceId) === true,
    );
  }
}

/**
 * Open a referenced paper in the current Zotero reader surface. This changes
 * the Reader document only; it never mutates PaperContextRef or chat state.
 */
export async function openPaperContextInReader(
  paperContext: PaperContextRef,
): Promise<number | null> {
  const attachment = resolvePaperNavigationAttachment(paperContext);
  const attachmentID = Number(attachment?.id);
  if (!Number.isFinite(attachmentID) || attachmentID <= 0) return null;

  const readerAPI = (
    Zotero as unknown as {
      Reader?: {
        open?: (
          itemID: number,
          location?: unknown,
          options?: ReaderOpenOptions,
        ) => Promise<any>;
      };
    }
  ).Reader;
  if (!readerAPI?.open) return null;

  const reader = await readerAPI.open(
    Math.floor(attachmentID),
    undefined,
    buildReaderOpenOptions(getSelectedReaderTabID()),
  );
  try {
    await reader?.focus?.();
  } catch (_error) {
    void _error;
  }
  return Math.floor(attachmentID);
}
