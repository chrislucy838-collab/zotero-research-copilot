import { renderMarkdownForNote } from "../../utils/markdown";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  sanitizeText,
  escapeNoteHtml,
  getCurrentLocalTimestamp,
} from "./textUtils";
import { MAX_SELECTED_IMAGES } from "./constants";
import {
  getTrackedAssistantNoteForParent,
  removeAssistantNoteMapEntry,
  rememberAssistantNoteForParent,
} from "./prefHelpers";
import type { Message } from "./types";

function resolveParentItemForNote(item: Zotero.Item): Zotero.Item | null {
  if (item.isAttachment() && item.parentID) {
    const parent = getZoteroItem(item.parentID);
    return parent && parent.isRegularItem() ? parent : null;
  }
  return item.isRegularItem() ? item : null;
}

function renderNoteMarkdown(text: string): string {
  const normalized = sanitizeText(text || "").trim();
  if (!normalized) return "";
  try {
    return renderMarkdownForNote(normalized);
  } catch (err) {
    ztoolkit.log("Note markdown render error:", err);
    return escapeNoteHtml(normalized).replace(/\n/g, "<br/>");
  }
}

function buildAssistantNoteHtml(contentText: string, modelName: string): string {
  const timestamp = getCurrentLocalTimestamp();
  const source = modelName.trim() || "unknown";
  return `<p><strong>${escapeNoteHtml(timestamp)}</strong></p><p><strong>${escapeNoteHtml(source)}:</strong></p><div>${renderNoteMarkdown(contentText)}</div><hr/><p>Written by Zotero Research Copilot</p>`;
}

function normalizeScreenshotImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(value))
    .slice(0, MAX_SELECTED_IMAGES);
}

function screenshotHtml(images: string[]): string {
  if (!images.length) return "";
  const blocks = images
    .map(
      (src, index) =>
        `<p><img src="${escapeNoteHtml(src)}" alt="${escapeNoteHtml(`Screenshot ${index + 1}`)}"/></p>`,
    )
    .join("");
  return `<div><p>Screenshots (${images.length}) are embedded below</p>${blocks}</div>`;
}

export function buildChatHistoryNotePayload(messages: Message[]): {
  noteHtml: string;
  noteText: string;
} {
  const timestamp = getCurrentLocalTimestamp();
  const textLines: string[] = [];
  const htmlBlocks: string[] = [];
  for (const message of messages) {
    const text = sanitizeText(message.text || "").trim();
    const images = normalizeScreenshotImages(message.screenshotImages);
    if (!text && !images.length) continue;
    const speaker =
      message.role === "user"
        ? "user"
        : sanitizeText(message.modelName || "").trim() || "model";
    const rendered = renderNoteMarkdown(text);
    const imagesHtml = message.role === "user" ? screenshotHtml(images) : "";
    if (!rendered && !imagesHtml) continue;
    textLines.push(`${speaker}: ${text}`);
    htmlBlocks.push(
      `<p><strong>${escapeNoteHtml(speaker)}:</strong></p>${rendered ? `<div>${rendered}</div>` : ""}${imagesHtml}`,
    );
  }
  return {
    noteText: textLines.join("\n\n"),
    noteHtml: `<p><strong>Chat history saved at ${escapeNoteHtml(timestamp)}</strong></p><div>${htmlBlocks.join("<hr/>")}</div><hr/><p>Written by Zotero Research Copilot</p>`,
  };
}

function appendNoteHtml(existingHtml: string, additionHtml: string): string {
  const existing = (existingHtml || "").trim();
  const addition = (additionHtml || "").trim();
  if (!existing) return addition;
  if (!addition) return existing;
  return `${existing}<hr/>${addition}`;
}

export async function createNoteFromAssistantText(
  item: Zotero.Item,
  contentText: string,
  modelName: string,
): Promise<"created" | "appended"> {
  const parent = resolveParentItemForNote(item);
  const parentId = parent?.id;
  const html = buildAssistantNoteHtml(contentText, modelName);
  if (parentId) {
    const existing = getTrackedAssistantNoteForParent(parentId);
    if (existing) {
      try {
        existing.setNote(appendNoteHtml(existing.getNote() || "", html));
        await existing.saveTx();
        return "appended";
      } catch (err) {
        ztoolkit.log("Failed to append to existing note:", err);
        removeAssistantNoteMapEntry(parentId);
      }
    }
  }
  const note = new Zotero.Item("note");
  note.libraryID = (parent || item).libraryID;
  if (parentId) note.parentID = parentId;
  note.setNote(html);
  const result = await note.saveTx();
  const noteId = typeof result === "number" && result > 0 ? result : note.id;
  if (parentId && noteId > 0) rememberAssistantNoteForParent(parentId, noteId);
  return "created";
}

export async function createNoteFromChatHistory(
  item: Zotero.Item,
  history: Message[],
): Promise<number> {
  const parent = resolveParentItemForNote(item);
  const note = new Zotero.Item("note");
  note.libraryID = (parent || item).libraryID;
  if (parent) note.parentID = parent.id;
  note.setNote(buildChatHistoryNotePayload(history).noteHtml);
  const result = await note.saveTx();
  const noteId = typeof result === "number" && result > 0 ? result : note.id;
  if (!Number.isFinite(noteId) || noteId <= 0) {
    throw new Error("Zotero did not return a valid note ID");
  }
  return noteId;
}

export async function createStandaloneNoteFromChatHistory(
  libraryID: number,
  history: Message[],
): Promise<number> {
  const normalizedLibraryID = Number.isFinite(libraryID) ? Math.floor(libraryID) : 0;
  if (normalizedLibraryID <= 0) throw new Error("Invalid library ID for standalone note export");
  const note = new Zotero.Item("note");
  note.libraryID = normalizedLibraryID;
  note.setNote(buildChatHistoryNotePayload(history).noteHtml);
  const result = await note.saveTx();
  const noteId = typeof result === "number" && result > 0 ? result : note.id;
  if (!Number.isFinite(noteId) || noteId <= 0) {
    throw new Error("Zotero did not return a valid note ID");
  }
  return noteId;
}

