import type { PaperContextRef } from "./types";

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function field(item: Zotero.Item, name: string): string {
  try {
    return text(item.getField(name));
  } catch {
    return "";
  }
}

function firstPdfAttachment(item: Zotero.Item): Zotero.Item | null {
  if (!item?.isRegularItem?.()) return null;
  for (const attachmentID of item.getAttachments?.() || []) {
    const attachment = Zotero.Items.get(attachmentID) as Zotero.Item | false;
    if (
      attachment &&
      attachment.isAttachment?.() &&
      String(attachment.attachmentContentType || "").toLowerCase() === "application/pdf"
    ) {
      return attachment;
    }
  }
  return null;
}

export type CollectionPaperEntry = {
  ref: PaperContextRef;
  hasPdf: boolean;
};

export type CollectionPaperOption = {
  id: number;
  name: string;
  depth: number;
  paperCount: number;
  pdfCount: number;
};

export function getLibraryCollectionOptions(libraryID: number): CollectionPaperOption[] {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return [];
  try {
    const collections = Zotero.Collections.getByLibrary(Math.floor(libraryID), true) || [];
    const byParent = new Map<number, Zotero.Collection[]>();
    for (const collection of collections) {
      const parentID = Number(collection.parentID) || 0;
      const entries = byParent.get(parentID) || [];
      entries.push(collection);
      byParent.set(parentID, entries);
    }
    const output: CollectionPaperOption[] = [];
    const walk = (parentID: number, depth: number) => {
      for (const collection of byParent.get(parentID) || []) {
        const childItems = collection.getChildItems(false, false) || [];
        const regularItems = childItems.filter((item) => item?.isRegularItem?.());
        const pdfCount = regularItems.reduce((count, item) => count + (firstPdfAttachment(item) ? 1 : 0), 0);
        output.push({
          id: collection.id,
          name: `${"\u00a0\u00a0".repeat(depth)}${collection.name}`,
          depth,
          paperCount: regularItems.length,
          pdfCount,
        });
        walk(collection.id, depth + 1);
      }
    };
    walk(0, 0);
    return output;
  } catch (error) {
    ztoolkit.log("LLM: Failed to list collections for research workspace", error);
    return [];
  }
}

export function getCollectionPaperEntries(collectionID: number): CollectionPaperEntry[] {
  if (!Number.isFinite(collectionID) || collectionID <= 0) return [];
  try {
    const collection = Zotero.Collections.get(Math.floor(collectionID));
    if (!collection) return [];
    const entries: CollectionPaperEntry[] = [];
    for (const item of collection.getChildItems(false, false) || []) {
      if (!item?.isRegularItem?.()) continue;
      const attachment = firstPdfAttachment(item);
      entries.push({
        ref: {
          itemId: item.id,
          contextItemId: attachment?.id || item.id,
          title: field(item, "title") || `Item ${item.id}`,
          citationKey: field(item, "citationKey") || undefined,
          firstCreator: text(item.firstCreator) || undefined,
          year: field(item, "year") || field(item, "date") || undefined,
        },
        hasPdf: Boolean(attachment),
      });
    }
    return entries;
  } catch (error) {
    ztoolkit.log("LLM: Failed to load collection papers", error);
    return [];
  }
}

export function getCollectionPaperContextRefs(
  collectionID: number,
  limit = 20,
): PaperContextRef[] {
  return getCollectionPaperEntries(collectionID)
    .slice(0, Math.max(1, Math.floor(limit)))
    .map((entry) => entry.ref);
}

export const __paperWorkspaceTest = { text };
