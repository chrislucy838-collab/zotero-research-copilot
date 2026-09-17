import type { PaperContextRef } from "./types";
import { getZoteroItem } from "../../utils/zoteroItems";
import { updateReaderChatWorkspaceNavigation } from "./state";

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

  const mainWindow = Zotero.getMainWindow?.() as Window | null;
  const targetID = Math.floor(attachmentID);

  // Mark the destination before calling Reader.open(). Zotero may synchronously
  // select an existing target tab and invoke the panel render hooks from inside
  // open(), so setting this flag afterwards is too late.
  if (mainWindow) {
    updateReaderChatWorkspaceNavigation(mainWindow, {
      activeAttachmentId: targetID,
      pendingAttachmentId: targetID,
    });
  }

  // Let Zotero select an existing target tab when one exists. When it does
  // not, Zotero creates a normal same-window Reader tab. We deliberately do
  // not pass the current tab ID: doing so would mount a second Reader iframe
  // into the current tab instead of opening a clean document surface.
  try {
    const reader = await readerAPI.open(
      targetID,
      undefined,
      buildReaderOpenOptions(null),
    );
    try {
      await reader?.focus?.();
    } catch (_error) {
      void _error;
    }
  } catch (error) {
    if (mainWindow) {
      updateReaderChatWorkspaceNavigation(mainWindow, {
        pendingAttachmentId: null,
        activeAttachmentId: null,
      });
    }
    throw error;
  }
  return targetID;
}
